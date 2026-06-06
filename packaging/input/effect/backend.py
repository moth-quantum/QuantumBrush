"""Hardware backend selection and pre-flight cost estimation.

The Java app writes a `hardware` block into each stroke JSON describing the
chosen backend (Aer simulator or IQM Garnet), shots, transpiler optimization
level, and a per-stroke QPU-seconds cap. `apply_effect.py` calls `get_backend`
to instantiate the right Qiskit backend; `utils.run_estimator` calls
`estimate_qpu_seconds` after transpilation and raises `CostExceededError`
when the conservative estimate exceeds the cap.

The IQM API token is read from the `IQM_TOKEN` environment variable that the
Java side sets on the subprocess. It is never written to disk.
"""

import os


class MissingTokenError(RuntimeError):
    """IQM backend selected but the IQM_TOKEN env var is missing or empty."""


class CostExceededError(RuntimeError):
    """Pre-flight cost estimate exceeded the configured per-stroke cap."""

    def __init__(self, estimate_seconds, cap_seconds, device):
        self.estimate_seconds = estimate_seconds
        self.cap_seconds = cap_seconds
        self.device = device
        super().__init__(
            f"Estimated cost {estimate_seconds:.3f} QPU-seconds exceeds "
            f"per-stroke cap of {cap_seconds:.3f} (device: {device}). "
            f"Reduce shots/radius or raise the cap in the Hardware tab."
        )


# Wall-clock gate timings used for the pre-flight cost estimate. These are
# intentionally conservative — they describe one shot's worth of execution at
# the device's typical rates. A 20% margin is added on top in
# `estimate_qpu_seconds` to absorb idle/reset cycles. Sourced from the IQM
# Garnet 20Q whitepaper.
DEVICE_TIMINGS = {
    "garnet": {
        # Gate name sets — after transpilation to the IQM ISA the circuit is
        # mostly PRX and CZ, but tolerating common aliases keeps the
        # estimator useful even if transpilation leaves intermediate forms.
        "single_qubit_gates": {
            "r", "prx", "rx", "ry", "rz",
            "x", "y", "z", "h",
            "s", "sdg", "t", "tdg", "sx", "sxdg", "id",
        },
        "two_qubit_gates": {"cz", "cx"},
        "t_single_q_s": 40e-9,    # ~40 ns single-qubit gate
        "t_two_q_s": 80e-9,       # ~80 ns CZ
        "t_measure_s": 1.5e-6,    # ~1.5 µs per qubit measurement
    },
}


def _import_iqm_provider():
    try:
        from iqm.qiskit_iqm import IQMProvider
        return IQMProvider
    except ImportError:
        pass
    try:
        from qiskit_iqm import IQMProvider
        return IQMProvider
    except ImportError as e:
        raise ImportError(
            "Neither `iqm.qiskit_iqm` nor `qiskit_iqm` is installed. "
            "Install with `pip install 'iqm-client[qiskit]'` (or re-run "
            "./setup.sh) and try again."
        ) from e


def get_backend(hw):
    """Return a Qiskit BackendV2 matching the user's choice.

    `hw` is the `hardware` block from the stroke JSON: a dict with at least
    `provider` ("aer" | "iqm") and (when iqm) `device`.

    For IQM, reads the token from os.environ["IQM_TOKEN"]; raises
    `MissingTokenError` if absent.
    """
    provider = (hw or {}).get("provider", "aer")

    if provider == "aer":
        from qiskit_aer import AerSimulator
        return AerSimulator()

    if provider != "iqm":
        raise ValueError(
            f"Unknown hardware provider {provider!r}. Supported: 'aer', 'iqm'."
        )

    token = os.environ.get("IQM_TOKEN", "").strip()
    if not token:
        raise MissingTokenError(
            "IQM backend selected but IQM_TOKEN is empty. Enter your API "
            "token in the Hardware tab of the app before submitting strokes."
        )

    device = hw.get("device", "garnet")
    url = os.environ.get("IQM_BASE_URL", "https://resonance.iqm.tech")

    # IQM's TokenManager forbids passing the token both via env var and via
    # the constructor kwarg. Since the Java side always injects IQM_TOKEN into
    # the subprocess env, we only validate the env var here and let the client
    # pick it up on its own — never forwarding it as a kwarg.
    IQMProvider = _import_iqm_provider()
    return IQMProvider(url, quantum_computer=device).get_backend()


def estimate_qpu_seconds(isa_circuits, hw):
    """Conservative pre-flight estimate of QPU-seconds for a batch of
    already-transpiled (ISA) circuits.

    Returns 0.0 for the Aer simulator (the cap is not meaningful there) and
    for unknown devices (we don't pretend to know their timings). For known
    IQM devices, computes
        sum_per_circuit((#1q * t_1q + #2q * t_2q + nq * t_meas) * shots) * 1.20
    """
    if not isa_circuits:
        return 0.0

    hw = hw or {}
    provider = hw.get("provider", "aer")
    if provider != "iqm":
        return 0.0

    device = hw.get("device", "garnet")
    if device not in DEVICE_TIMINGS:
        return 0.0

    shots = int(hw.get("shots", 1024) or 1024)
    timings = DEVICE_TIMINGS[device]

    total = 0.0
    for circ in isa_circuits:
        ops = circ.count_ops()
        n_1q = sum(c for g, c in ops.items() if g in timings["single_qubit_gates"])
        n_2q = sum(c for g, c in ops.items() if g in timings["two_qubit_gates"])
        n_meas = ops.get("measure", 0) or circ.num_qubits
        per_shot = (
            n_1q * timings["t_single_q_s"]
            + n_2q * timings["t_two_q_s"]
            + n_meas * timings["t_measure_s"]
        )
        total += per_shot * shots

    return total * 1.20  # 20% margin
