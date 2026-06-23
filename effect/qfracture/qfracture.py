"""
Quantum Fracture Brush
======================
Paints crystalline fracture patterns driven by a discrete-time quantum walk (DTQW).

Physics background
------------------
A discrete-time quantum walk on a line uses a "coin" qubit (|0⟩ = move right,
|1⟩ = move left) and a position register.  The Hadamard coin creates genuine
quantum superposition: after N steps the walker's probability distribution has
two sharp peaks near ±N/√2, very different from the Gaussian bell curve of a
classical random walk.  This gives the fractures their characteristic long,
sharp arms rather than a diffuse blob.

Measurement-induced phase transition (MIPT)
-------------------------------------------
When we insert mid-circuit measurements at rate p each step, the walk
interpolates between:
  p=0 → purely coherent quantum walk (sharp, crystalline arms)
  p=1 → fully collapsed classical random walk (diffuse, rounded spread)

This p is exposed as the "Measurement Rate" parameter.  Values around 0.2-0.4
give the most visually interesting "glassy fracture" look.

Visual mapping
--------------
Each fracture arm is a mini DTQW of `steps` steps.
After the walk, the probability distribution P(x) is mapped to pixel alpha:
  • Pixels with high P(x) → near-opaque (collapsed / crystallised)
  • Pixels with low  P(x) → translucent ghost (superposed)
Hue is taken from the user-chosen Colour; lightness is modulated by P(x).
If Glow is enabled, a soft Gaussian blur is layered underneath for an
iridescent aura effect.
"""

import importlib.util
import sys
from pathlib import Path
import numpy as np
import colorsys

# ── Load utils from the effect directory ──────────────────────────────────────
_utils_path = Path(__file__).parent.parent / "utils.py"
spec = importlib.util.spec_from_file_location("utils", str(_utils_path))
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

# ── Qiskit imports ─────────────────────────────────────────────────────────────
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator


# ─────────────────────────────────────────────────────────────────────────────
# Quantum walk core
# ─────────────────────────────────────────────────────────────────────────────

def _build_dtqw_circuit(n_pos_qubits: int, steps: int, measurement_rate: float) -> QuantumCircuit:
    """
    Build a discrete-time quantum walk (DTQW) circuit.

    Layout
    ------
    q[0]            : coin qubit
    q[1..n_pos_qubits]: position in binary (two's-complement, 0-centred)

    The coin is a Hadamard gate.
    The shift moves the walker ±1 in position space controlled by the coin.
    Mid-circuit measurements on the coin at rate `measurement_rate` simulate
    decoherence / measurement-induced phase transitions.
    """
    n_total = 1 + n_pos_qubits
    qr = QuantumRegister(n_total, 'q')
    cr = ClassicalRegister(n_total, 'c')
    qc = QuantumCircuit(qr, cr)

    # Initialise coin in |+⟩ (balanced superposition)
    qc.h(qr[0])

    rng = np.random.default_rng(seed=42)

    for step in range(steps):
        # Hadamard coin flip
        qc.h(qr[0])

        # Conditional shift: if coin |1⟩, increment position; if |0⟩, decrement
        # We implement a simple controlled increment / decrement.
        # Position uses binary encoding; +1 is a ripple-carry adder pattern.
        # For small n_pos_qubits this is tractable.
        _apply_shift(qc, qr, n_pos_qubits, direction=+1, coin_state=1)
        _apply_shift(qc, qr, n_pos_qubits, direction=-1, coin_state=0)

        # Optional mid-circuit measurement of coin (decoherence)
        if measurement_rate > 0 and rng.random() < measurement_rate:
            qc.measure(qr[0], cr[0])
            # Re-initialise coin to |+⟩ after collapse
            qc.h(qr[0])

    # Final measurement of the full register
    qc.measure(qr, cr)
    return qc


def _apply_shift(qc, qr, n_pos_qubits, direction: int, coin_state: int):
    """
    Apply ±1 shift to the position register controlled on the coin qubit.

    direction  : +1 → increment, -1 → decrement
    coin_state : 0 → control on |0⟩ (X-flip then CX then X), 1 → control on |1⟩
    """
    coin = qr[0]
    pos  = [qr[i + 1] for i in range(n_pos_qubits)]

    if coin_state == 0:
        qc.x(coin)   # flip so we can use positive-control CX

    if direction == +1:
        # Binary increment: cascade of Toffoli gates
        for k in range(n_pos_qubits - 1, 0, -1):
            qc.mcx([coin] + pos[:k], pos[k])
        qc.cx(coin, pos[0])
    else:
        # Binary decrement: flip all, increment, flip all  (two's complement trick)
        for bit in pos:
            qc.x(bit)
        for k in range(n_pos_qubits - 1, 0, -1):
            qc.mcx([coin] + pos[:k], pos[k])
        qc.cx(coin, pos[0])
        for bit in pos:
            qc.x(bit)

    if coin_state == 0:
        qc.x(coin)   # restore coin


def quantum_walk_distribution(steps: int, measurement_rate: float, shots: int = 1024) -> np.ndarray:
    """
    Run the DTQW and return a probability distribution over positions.

    Returns
    -------
    probs : np.ndarray of shape (2*steps+1,) — index 0 = leftmost position
    """
    n_pos_qubits = max(int(np.ceil(np.log2(2 * steps + 2))), 2)
    qc = _build_dtqw_circuit(n_pos_qubits, steps, measurement_rate)

    backend = AerSimulator()
    job = backend.run(qc, shots=shots)
    counts = job.result().get_counts()

    # Decode position from the classical bits (ignoring coin bit 0)
    n_positions = 2 * steps + 1
    probs = np.zeros(n_positions)

    for bitstring, count in counts.items():
        # bitstring is MSB-first; bit 0 (rightmost in string) is the coin
        bits = bitstring.replace(" ", "")
        pos_bits = bits[:-1]  # drop coin (LSB = rightmost char)
        raw = int(pos_bits, 2)
        # Convert to signed integer centred at 0
        half = 2 ** (len(pos_bits) - 1)
        pos_signed = raw if raw < half else raw - 2 * half
        # Clamp to [-steps, +steps] and map to array index
        idx = pos_signed + steps
        idx = int(np.clip(idx, 0, n_positions - 1))
        probs[idx] += count

    total = probs.sum()
    if total > 0:
        probs /= total
    return probs


# ─────────────────────────────────────────────────────────────────────────────
# Fracture geometry helpers
# ─────────────────────────────────────────────────────────────────────────────

def _arm_pixels(origin: np.ndarray, angle: float, probs: np.ndarray,
                radius: int, img_shape: tuple) -> list:
    """
    Generate (pixel_coord, alpha) pairs along a fracture arm.

    The arm starts at `origin` and extends in `angle` direction.
    The quantum probability at position i along the arm controls alpha.
    Pixels within `radius` of the arm centre-line are included.
    """
    steps = len(probs) - 1
    h, w = img_shape[:2]
    records = []

    cos_a, sin_a = np.cos(angle), np.sin(angle)

    for i, p in enumerate(probs):
        if p < 1e-6:
            continue
        # Walk outward from the midpoint (index = steps means position 0)
        arm_offset = i - steps          # signed: negative = backward, positive = forward
        cx = origin[1] + arm_offset * cos_a
        cy = origin[0] + arm_offset * sin_a

        # Disk of pixels around this arm point
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if dx * dx + dy * dy > radius * radius:
                    continue
                py, px = int(round(cy + dy)), int(round(cx + dx))
                if 0 <= py < h and 0 <= px < w:
                    # Alpha falls off with radial distance inside the disk
                    dist = np.sqrt(dx * dx + dy * dy) / max(radius, 1)
                    alpha = float(p) * (1.0 - dist ** 1.5)
                    records.append(((py, px), alpha))

    return records


# ─────────────────────────────────────────────────────────────────────────────
# Glow helper
# ─────────────────────────────────────────────────────────────────────────────

def _gaussian_blur_alpha(alpha_map: np.ndarray, sigma: float = 3.0) -> np.ndarray:
    """Simple separable Gaussian blur for the glow layer."""
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(alpha_map, sigma=sigma, mode='constant', cval=0)


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────

def run(params: dict) -> np.ndarray:
    """
    Quantum Fracture brush entry point.

    Parameters in `params`
    ----------------------
    stroke_input.image_rgba  : np.ndarray (H, W, 4) uint8
    stroke_input.path        : np.ndarray (N, 2) int  — (row, col)
    stroke_input.clicks      : np.ndarray (M, 2) int
    user_input.Radius        : int
    user_input.Branches      : int
    user_input.Measurement Rate : float
    user_input.Colour        : np.ndarray [R, G, B] uint8
    user_input.Glow          : bool
    """
    image    = params["stroke_input"]["image_rgba"].copy()
    path     = params["stroke_input"]["path"]           # (N, 2)  row, col
    colour   = params["user_input"]["Colour"]           # [R,G,B] uint8
    radius   = int(params["user_input"]["Radius"])
    branches = int(params["user_input"]["Branches"])
    m_rate   = float(params["user_input"]["Measurement Rate"])
    glow     = bool(params["user_input"]["Glow"])

    h, w = image.shape[:2]

    # Derive number of walk steps from path length and radius
    path_len = max(len(path), 1)
    steps    = max(int(path_len // branches), 4)
    steps    = min(steps, 20)   # cap to keep circuit small

    # ── Run quantum walk ───────────────────────────────────────────────────
    probs = quantum_walk_distribution(steps=steps, measurement_rate=m_rate, shots=1024)

    # ── Build fracture arms from evenly-spaced spine points ───────────────
    # Choose `branches` evenly spaced points along the path as arm origins
    indices = np.linspace(0, len(path) - 1, branches, dtype=int)
    origins = path[indices]  # (branches, 2)

    # Compute local tangent direction at each origin
    tangents = []
    for k, idx in enumerate(indices):
        i0 = max(idx - 2, 0)
        i1 = min(idx + 2, len(path) - 1)
        delta = path[i1] - path[i0]   # (dy, dx)
        angle_along = np.arctan2(float(delta[0]), float(delta[1]))
        tangents.append(angle_along)

    # Each origin gets `branches` arms fanning out; the first two are ±perpendicular
    # then rotated copies for extra branches
    fan_angles = [np.pi * k / branches for k in range(branches)]

    # ── Accumulate alpha into a float map ─────────────────────────────────
    alpha_map  = np.zeros((h, w), dtype=np.float32)
    colour_map = np.zeros((h, w, 3), dtype=np.float32)   # pre-filled with fracture colour

    # Convert colour to HLS for stylistic modulation
    r0, g0, b0 = float(colour[0]) / 255.0, float(colour[1]) / 255.0, float(colour[2]) / 255.0
    hue0, lig0, sat0 = colorsys.rgb_to_hls(r0, g0, b0)

    for origin, tangent in zip(origins, tangents):
        for fan in fan_angles:
            arm_angle = tangent + fan
            records   = _arm_pixels(origin, arm_angle, probs, radius, image.shape)
            for (py, px), a in records:
                if a > alpha_map[py, px]:
                    alpha_map[py, px]     = a
                    # Modulate lightness by arm alpha → bright core, dim fringe
                    lig = np.clip(lig0 * 0.6 + a * 0.8, 0.0, 1.0)
                    rr, gg, bb = colorsys.hls_to_rgb(hue0, lig, sat0)
                    colour_map[py, px, 0] = rr
                    colour_map[py, px, 1] = gg
                    colour_map[py, px, 2] = bb

    # ── Optional glow layer ────────────────────────────────────────────────
    if glow:
        try:
            blurred = _gaussian_blur_alpha(alpha_map, sigma=radius * 0.8)
            glow_strength = np.clip(blurred * 0.4, 0, 1)
            # Glow is a lighter, desaturated version of the colour
            for c_idx, val in enumerate([r0, g0, b0]):
                glow_ch = (val + 1.0) / 2.0   # shift towards white
                colour_map[..., c_idx] = np.where(
                    glow_strength > alpha_map,
                    glow_ch,
                    colour_map[..., c_idx]
                )
            alpha_map = np.maximum(alpha_map, glow_strength)
        except ImportError:
            pass  # scipy not available — skip glow silently

    # ── Composite onto image ───────────────────────────────────────────────
    alpha_map = np.clip(alpha_map, 0.0, 1.0)

    original_float = image.astype(np.float32) / 255.0

    # Alpha blend: result = alpha * fracture + (1-alpha) * original
    for c in range(3):
        original_float[..., c] = (
            alpha_map * colour_map[..., c]
            + (1.0 - alpha_map) * original_float[..., c]
        )
    # Alpha channel: max of original and new paint
    original_float[..., 3] = np.maximum(original_float[..., 3], alpha_map)

    result = (np.clip(original_float, 0.0, 1.0) * 255.0).astype(np.uint8)
    return result
