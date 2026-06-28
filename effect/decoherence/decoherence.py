"""
Quantum Decoherence Brush Effect Module.

Models open-system quantum dynamics on stroke colors using amplitude damping
(T1 energy relaxation) and phase damping (T2 dephasing). Each path segment
is encoded as a qubit state; repeated damping steps simulate how quantum
information dissolves into an environment on NISQ hardware.
"""

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, SparsePauliOp
import importlib.util
from scipy.stats import circmean

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)


def build_decoherence_circuit(initial_angles, env_angles, amp_rate, phase_rate, steps):
    """
    Build a quantum circuit applying Trotterized amplitude and phase damping.

    T1 (amplitude damping): ancilla-coupled Stinespring dilation. T1_ancilla starts in
    |0>, CRY(2*arcsin(sqrt(gamma))) + CX implements the exact Kraus map; CRY/CRZ after
    the CX steer relaxation toward the environment color rather than pure |0> ground state.

    T2 (phase damping): separate T2_ancilla starts in |0>, CRY(2*arcsin(sqrt(lambda)))
    controlled on each qubit contracts the off-diagonal density-matrix elements by
    sqrt(1-lambda) per step without changing the Z/lightness component.

    Both ancillae are shared across all data qubits per step (same single-ancilla
    approximation used in damping.py). Circuit size: n_qubits + 2.
    """
    n_qubits = len(initial_angles)
    t1_ancilla = n_qubits
    t2_ancilla = n_qubits + 1
    env_phi, env_theta = env_angles

    # Ancillae default to |0> — do NOT pre-rotate t1_ancilla to env state;
    # env-steering is handled by the CRY/CRZ gates inside the Trotter loop.
    qc = QuantumCircuit(n_qubits + 2)

    for i, (phi, theta) in enumerate(initial_angles):
        qc.ry(theta, i)
        qc.rz(phi, i)

    per_step_amp = amp_rate / max(steps, 1)
    per_step_phase = phase_rate / max(steps, 1)
    # Stinespring rotation: sin(theta/2) = sqrt(gamma)  =>  theta = 2*arcsin(sqrt(gamma))
    amp_rotation = 2 * np.arcsin(np.sqrt(np.clip(per_step_amp, 0.0, 1.0)))
    phase_rotation = 2 * np.arcsin(np.sqrt(np.clip(per_step_phase, 0.0, 1.0)))

    for _ in range(steps):
        for i in range(n_qubits):
            if amp_rate > 0:
                # T1: Stinespring unitary for amplitude damping toward env color
                qc.cry(amp_rotation, control_qubit=i, target_qubit=t1_ancilla)
                qc.cx(control_qubit=t1_ancilla, target_qubit=i)
                qc.cry(per_step_amp * env_theta, control_qubit=t1_ancilla, target_qubit=i)
                qc.crz(per_step_amp * env_phi, control_qubit=t1_ancilla, target_qubit=i)

            if phase_rate > 0:
                # T2: Stinespring unitary for phase damping (contracts XY Bloch components)
                qc.cry(phase_rotation, control_qubit=i, target_qubit=t2_ancilla)

    return qc


def run_decoherence_circuit(initial_angles, env_angles, amp_rate, phase_rate, steps, params=None):
    """
    Run decoherence simulation on quantum hardware simulator.

    Args:
        initial_angles: List of (phi, theta) Bloch angles per segment
        env_angles: (phi, theta) of the environment bath
        amp_rate: Amplitude damping strength in [0, 1]
        phase_rate: Phase damping strength in [0, 1]
        steps: Number of Trotter damping iterations

    Returns:
        List of (phi, theta) after decoherence evolution
    """
    try:
        num_qubits = len(initial_angles)
        print(f"Decoherence: {num_qubits} qubits, amp={amp_rate}, phase={phase_rate}, steps={steps}")
        print(f"initial angles: {initial_angles}")
        print(f"environment angles: {env_angles}")

        qc = build_decoherence_circuit(initial_angles, env_angles, amp_rate, phase_rate, steps)

        # Circuit has n_qubits + 2 qubits (T1 ancilla + T2 ancilla); Pauli strings
        # must be length n_qubits + 2 with ancilla positions as 'I'.
        ops = [
            SparsePauliOp(Pauli('I' * (num_qubits + 1 - i) + p + 'I' * i))
            for p in ['X', 'Y', 'Z']
            for i in range(num_qubits)
        ]

        p = params or {}
        obs = utils.run_estimator(
            qc, ops,
            backend=p.get("backend"),
            hw=p.get("hw"),
            cost_estimate_out=p.get("cost_accumulator"),
        )

        x_expectations = obs[:num_qubits]
        y_expectations = obs[num_qubits:2 * num_qubits]
        z_expectations = obs[2 * num_qubits:]

        # phi = arctan2(Y, X), theta = arctan2(r_xy, Z)
        phi_expectations = [np.arctan2(y, x) % (2 * np.pi) for x, y in zip(x_expectations, y_expectations)]
        theta_expectations = [np.arctan2(np.sqrt(x ** 2 + y ** 2), z) for x, y, z in zip(x_expectations, y_expectations, z_expectations)]

        final_angles = list(zip(phi_expectations, theta_expectations))
        print(f"final angles: {final_angles}")
        return final_angles

    except Exception as e:
        print(f"Quantum simulation failed: {e}")
        raise


def classical_decoherence(initial_angles, env_angles, amp_rate, phase_rate, steps):
    """
    Classical fallback when qubit count exceeds simulator budget.

    T1 (amplitude damping): hue and lightness interpolate toward the environment
    color — both channels decay because amplitude damping contracts the full Bloch
    vector toward the thermal-bath fixed point.

    T2 (phase damping): hue decays toward the maximally-mixed azimuthal value (0.5)
    without a target color, mirroring Bloch-vector XY contraction. Lightness is
    unchanged by T2 (Z component is preserved under pure dephasing).

    ponytail: scalar HLS can't represent Bloch-vector shortening (mixed states).
    This is the best single-color approximation. Upgrade: per-pixel density matrix.
    """
    env_phi, env_theta = env_angles
    env_h = env_phi / (2 * np.pi)
    env_l = env_theta / np.pi

    final_angles = []
    per_step_amp = amp_rate / max(steps, 1)
    per_step_phase = phase_rate / max(steps, 1)

    for phi, theta in initial_angles:
        h = phi / (2 * np.pi)
        lum = theta / np.pi

        for _ in range(steps):
            # T1: both hue and lightness drift toward env (full Bloch-vector relaxation)
            h = (1 - per_step_amp) * h + per_step_amp * env_h
            h = h % 1.0
            lum = (1 - per_step_amp) * lum + per_step_amp * env_l

            # T2: hue loses azimuthal coherence (no env target), lightness unchanged
            h = (1 - per_step_phase) * h + per_step_phase * 0.5
            h = h % 1.0

        final_angles.append((h * 2 * np.pi, lum * np.pi))

    return final_angles


# The only thing that you need to change is this function
def run(params):
    """
    Executes the decoherence effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values or None if the effect failed
    """

    image = params["stroke_input"]["image_rgba"].copy()
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height = image.shape[0]
    width = image.shape[1]

    path = params["stroke_input"]["path"]
    if len(path) == 0:
        return image

    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    strength = params["user_input"]["Strength"]
    assert 0.0 <= strength <= 1.0, "Strength must be between 0 and 1"

    amp_rate = params["user_input"]["Amplitude Rate"]
    assert 0.0 <= amp_rate <= 1.0, "Amplitude Rate must be between 0 and 1"

    phase_rate = params["user_input"]["Phase Rate"]
    assert 0.0 <= phase_rate <= 1.0, "Phase Rate must be between 0 and 1"

    steps = params["user_input"]["Steps"]
    assert steps >= 1, "Steps must be at least 1"

    env_color = params["user_input"]["Environment Color"]
    env_phi, env_theta, _ = utils.color_to_spherical(env_color)
    env_angles = (env_phi, env_theta)
    print(f"Environment color: {env_color}, angles: {env_angles}")

    n_segments = min(int(round(np.interp(radius, [1, 100], [2, 8]))), len(path))
    split_paths = np.array_split(path, n_segments)

    initial_angles = []
    pixels = []
    for lines in split_paths:
        region, distance = utils.points_within_radius(
            lines, radius, border=(height, width), return_distance=True
        )

        if len(region) == 0:
            continue

        selection = image[region[:, 0], region[:, 1]]
        selection = selection.astype(np.float32) / 255.0
        selection_hls = utils.rgb_to_hls(selection)

        phi = circmean(2 * np.pi * selection_hls[..., 0])
        theta = np.pi * np.mean(selection_hls[..., 1], axis=0)

        initial_angles.append((phi, theta))
        pixels.append((region, distance, selection_hls))

    if len(initial_angles) == 0:
        return image

    use_quantum = len(initial_angles) <= 8

    if use_quantum:
        final_angles = run_decoherence_circuit(
            initial_angles, env_angles, amp_rate, phase_rate, steps, params=params
        )
    else:
        print(f"Using classical fallback for {len(initial_angles)} segments")
        final_angles = classical_decoherence(
            initial_angles, env_angles, amp_rate, phase_rate, steps
        )

    for i, (region, distance, selection_hls) in enumerate(pixels):
        new_phi, new_theta = final_angles[i]
        old_phi, old_theta = initial_angles[i]

        offset_h = (new_phi - old_phi) / (2 * np.pi)
        offset_l = (new_theta - old_theta) / np.pi

        shifted_hls = selection_hls.copy()
        shifted_hls[..., 0] = (shifted_hls[..., 0] + offset_h) % 1
        shifted_hls[..., 1] += offset_l
        shifted_hls = np.clip(shifted_hls, 0, 1)

        blended_hls = (1 - strength) * selection_hls + strength * shifted_hls
        blended_hls = np.clip(blended_hls, 0, 1)

        blended_rgb = utils.hls_to_rgb(blended_hls)

        new_patch = image[region[:, 0], region[:, 1]].astype(np.float32) / 255
        new_patch[..., :3] = blended_rgb[..., :3]

        image[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(
            image[region[:, 0], region[:, 1]], new_patch, blur=True, distance=distance
        )

    print("Decoherence effect applied successfully")
    return image
