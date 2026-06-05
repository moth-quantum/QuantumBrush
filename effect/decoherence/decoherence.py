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


def scale_to_range(x, in_min=1, in_max=100, out_min=2, out_max=8):
    """
    Linearly scale x from [in_min, in_max] to [out_min, out_max].
    """
    if not (in_min <= x <= in_max):
        raise ValueError(f"Input {x} is out of range [{in_min}, {in_max}]")
    return int(round(out_min + (x - in_min) * (out_max - out_min) / (in_max - in_min)))


def build_decoherence_circuit(initial_angles, env_angles, amp_rate, phase_rate, steps):
    """
    Build a quantum circuit applying Trotterized amplitude and phase damping.

    Amplitude damping follows the ancilla-coupled channel used in damping.py,
    extended with controlled rotations toward the environment Bloch angles.
    Phase damping applies incremental RZ dephasing each Trotter step.
    """
    n_qubits = len(initial_angles)
    ancilla = n_qubits
    env_phi, env_theta = env_angles

    qc = QuantumCircuit(n_qubits + 1)

    qc.ry(env_theta, ancilla)
    qc.rz(env_phi, ancilla)

    for i, (phi, theta) in enumerate(initial_angles):
        qc.ry(theta, i)
        qc.rz(phi, i)

    per_step_amp = amp_rate / max(steps, 1)
    per_step_phase = phase_rate / max(steps, 1)
    amp_rotation = 2 * np.arccos(np.clip(1 - per_step_amp, 0.0, 1.0))

    for _ in range(steps):
        for i in range(n_qubits):
            if amp_rate > 0:
                qc.cry(amp_rotation, target_qubit=ancilla, control_qubit=i)
                qc.cx(target_qubit=i, control_qubit=ancilla)
                qc.cry(per_step_amp * env_theta, target_qubit=i, control_qubit=ancilla)
                qc.crz(per_step_amp * env_phi, target_qubit=i, control_qubit=ancilla)

            if phase_rate > 0:
                qc.rz(per_step_phase * np.pi, i)

    return qc


def angles_from_observables(obs, num_qubits):
    """
    Convert Pauli expectation values into Bloch angles (phi, theta).
    """
    x_expectations = obs[:num_qubits]
    y_expectations = obs[num_qubits:2 * num_qubits]
    z_expectations = obs[2 * num_qubits:]

    phi_expectations = [
        np.arctan2(y, x) % (2 * np.pi)
        for x, y in zip(x_expectations, y_expectations)
    ]
    theta_expectations = [
        np.arctan2(np.sqrt(x ** 2 + y ** 2), z)
        for x, y, z in zip(x_expectations, y_expectations, z_expectations)
    ]

    return list(zip(phi_expectations, theta_expectations))


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

        ops = [
            SparsePauliOp(Pauli('I' * (num_qubits - i) + p + 'I' * i))
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

        final_angles = angles_from_observables(obs, num_qubits)
        print(f"final angles: {final_angles}")
        return final_angles

    except Exception as e:
        print(f"Quantum simulation failed: {e}")
        raise


def classical_decoherence(initial_angles, env_angles, amp_rate, phase_rate, steps):
    """
    Classical fallback when qubit count exceeds simulator budget.

    Approximates amplitude damping as HLS interpolation toward the environment
    and phase damping as progressive hue diffusion.
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
            h = (1 - per_step_phase) * h + per_step_phase * (h + 0.5 * (env_h - h))
            h = h % 1.0
            lum = (1 - per_step_amp) * lum + per_step_amp * env_l

        final_angles.append((h * 2 * np.pi, lum * np.pi))

    return final_angles


def split_path(path, n_segments):
    """
    Split a stroke path into n_segments contiguous subpaths.
    """
    path_length = len(path)
    if path_length == 0:
        return []

    n_segments = max(1, min(n_segments, path_length))
    split_size = max(1, path_length // n_segments)
    split_paths = [
        path[i * split_size:(i + 1) * split_size]
        for i in range(n_segments - 1)
    ]
    split_paths.append(path[(n_segments - 1) * split_size:])
    return split_paths


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

    n_segments = min(scale_to_range(radius), len(path))
    n_segments = max(1, n_segments)
    split_paths = split_path(path, n_segments)

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
