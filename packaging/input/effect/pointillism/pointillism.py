"""
Quantum Pointillism Brush Effect

A quantum-enhanced pointillism brush that uses the Ising model to create
correlated color patterns between neighboring dots. Colors are encoded as
quantum states and evolved through many-body interactions, producing effects
impossible with classical randomness.

Authors: Khrystian Koci & Benjamin Thomas
Version: 0.2.0
"""

print("PYTHON EFFECT LOADED", flush=True)

import sys, time, numpy as np
from concurrent.futures import ThreadPoolExecutor

# --- Qiskit ---
try:
    from qiskit import QuantumCircuit, QuantumRegister
    from qiskit.quantum_info import Statevector, SparsePauliOp
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

# --- Utils ---
import importlib.util
spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

# --- Path-Following Sampling ---
def sample_along_path(path, n_samples, spread=15, min_dist=5.0):
    """
    Sample dots that follow the brush stroke path with organic scatter.

    Uses exponential distance bias and Poisson disk sampling to create
    natural-looking dot distributions along the user's stroke path.

    Args:
        path: Array of (y, x) coordinates defining the stroke path
        n_samples: Number of dots to place
        spread: Maximum perpendicular distance from path (pixels)
        min_dist: Minimum distance between dots (pixels)

    Returns:
        numpy.ndarray: Array of (y, x) coordinates for dot positions
    """
    if len(path) == 0:
        return np.array([])
    
    path = np.array(path)
    
    # First, get a region around the path (like before)
    # but biased toward the path itself
    candidates = []
    
    for path_point in path:
        # For each point on the path, add nearby candidates
        # with distance bias (more close, fewer far)
        for _ in range(3):  # 3 candidates per path point
            # Exponential bias toward path center
            r = np.random.exponential(spread / 3)  # Most within spread/3
            r = min(r, spread)  # Cap at max spread
            
            angle = np.random.uniform(0, 2 * np.pi)
            offset = r * np.array([np.cos(angle), np.sin(angle)])
            candidates.append(path_point + offset)
    
    candidates = np.array(candidates)
    
    # Now do Poisson disk sampling from these candidates
    if len(candidates) == 0:
        return np.array([])
    
    np.random.shuffle(candidates)
    selected = [candidates[0]]
    
    for candidate in candidates[1:]:
        if len(selected) >= n_samples:
            break
        
        # Check minimum distance
        distances = np.linalg.norm(np.array(selected) - candidate, axis=1)
        if np.all(distances >= min_dist):
            selected.append(candidate)
    
    return np.array(selected[:n_samples])

# --- Neighbors ---
def build_neighbors(pos, max_dist):
    """
    Build neighbor graph for dots within interaction distance.

    Creates pairs of dots that are close enough to have quantum
    interactions in the Ising model.

    Args:
        pos: Array of (y, x) coordinates for all dots
        max_dist: Maximum distance for two dots to be neighbors (pixels)

    Returns:
        list: List of (i, j) tuples representing neighbor pairs
    """
    pos = np.array(pos)
    n = len(pos)
    neighbors = []
    for i in range(n):
        for j in range(i + 1, n):
            if np.linalg.norm(pos[i] - pos[j]) <= max_dist:
                neighbors.append((i, j))
    return neighbors

# --- Quantum ---
def encode_color_to_qubit(rgb):
    """
    Encode RGB color as quantum state angles on the Bloch sphere.

    Maps RGB color to spherical coordinates (phi, theta) that define
    a qubit state. This allows colors to be manipulated using quantum
    gates.

    Args:
        rgb: RGB color as array [r, g, b] with values 0-255

    Returns:
        tuple: (phi, theta) angles in radians
            phi: Azimuthal angle (0 to 2π) - represents hue
            theta: Polar angle (0 to π) - represents lightness
    """
    phi, theta, _ = utils.color_to_spherical(rgb)
    return phi, theta

def spherical_to_rgb(phi, theta, sat=0.6):
    """
    Decode Bloch sphere angles back to RGB color.

    Inverse transformation of encode_color_to_qubit. Converts quantum
    state angles back to visible RGB color.

    Args:
        phi: Azimuthal angle in radians (0 to 2π)
        theta: Polar angle in radians (0 to π)
        sat: Saturation level (0 to 1), default 0.6

    Returns:
        numpy.ndarray: RGB color as [r, g, b] with values 0-255
    """
    hue = phi / (2 * np.pi)
    light = theta / np.pi
    rgb = utils.hls_to_rgb(np.array([hue, light, sat]))
    return (rgb * 255).astype(np.uint8)

def create_ising_circuit(N, colors, neighbors, coupling, evo_t):
    """
    Create quantum circuit for Ising model time evolution.

    Builds a quantum circuit that evolves N qubits (one per dot) through
    Ising Hamiltonian interactions. Uses Trotterization to approximate
    continuous time evolution.

    Hamiltonian: H = -J Σ_(i,j) Z_i Z_j - h Σ_i X_i
    - First term: ZZ interactions create color correlations between neighbors
    - Second term: External field biases colors toward original values

    Args:
        N: Number of qubits (dots)
        colors: List of RGB colors for initial state encoding
        neighbors: List of (i, j) tuples for interacting qubit pairs
        coupling: Ising coupling strength J
            J > 0: Ferromagnetic (similar colors)
            J < 0: Antiferromagnetic (contrasting colors)
        evo_t: Total evolution time (larger = more interaction)

    Returns:
        QuantumCircuit: Qiskit circuit ready for simulation, or None if error
    """
    if not QISKIT_AVAILABLE or N == 0: return None
    try:
        q = QuantumRegister(N, 'q')
        qc = QuantumCircuit(q)
        for i, col in enumerate(colors):
            phi, theta = encode_color_to_qubit(col)
            qc.ry(theta, i)
            qc.rz(phi, i)
        dt = 0.1
        steps = max(1, int(evo_t / dt))
        J = coupling * 0.7
        for _ in range(steps):
            for i, j in neighbors:
                qc.rzz(-2 * J * dt, i, j)
            for i in range(N):
                phi, theta = encode_color_to_qubit(colors[i])
                qc.rx(0.1 * dt * theta, i)
        return qc
    except:
        return None

def measure_colors(qc, N):
    """
    Measure quantum circuit and decode colors from qubit states.

    Extracts the statevector from the circuit and computes Pauli expectation
    values to reconstruct Bloch sphere angles for each qubit, then converts
    back to RGB colors.

    Args:
        qc: QuantumCircuit that has been time-evolved
        N: Number of qubits to measure

    Returns:
        numpy.ndarray: Array of RGB colors [N, 3] with values 0-255,
                      or None if measurement fails
    """
    if not QISKIT_AVAILABLE: return None
    try:
        st = Statevector(qc)
        cols = []
        for i in range(N):
            obs_x = SparsePauliOp('I' * i + 'X' + 'I' * (N - i - 1))
            obs_y = SparsePauliOp('I' * i + 'Y' + 'I' * (N - i - 1))
            obs_z = SparsePauliOp('I' * i + 'Z' + 'I' * (N - i - 1))
            x = st.expectation_value(obs_x).real
            y = st.expectation_value(obs_y).real
            z = st.expectation_value(obs_z).real
            phi = np.arctan2(y, x) % (2 * np.pi)
            theta = np.arccos(np.clip(z, -1, 1))
            cols.append(spherical_to_rgb(phi, theta))
        return np.array(cols)
    except:
        return None

# --- Classical Fallback ---
def classical_blend(pos, colors, neighbors, coupling, target):
    """
    Classical approximation of quantum Ising model interactions.

    Used when quantum simulation is unavailable or too expensive (>25 dots).
    Iteratively blends neighbor colors to approximate quantum correlations.

    Args:
        pos: Array of dot positions (unused but kept for API consistency)
        colors: List of RGB colors to blend
        neighbors: List of (i, j) tuples for neighbor pairs
        coupling: Coupling strength (positive = blend, negative = contrast)
        target: Target color for external field (unused in current implementation)

    Returns:
        numpy.ndarray: Array of blended RGB colors [N, 3] with values 0-255
    """
    colors = np.array(colors, dtype=float)
    for i, j in neighbors:
        avg = (colors[i] + colors[j]) / 2
        blend = 0.05 * abs(coupling)
        if coupling > 0:
            colors[i] = (1 - blend) * colors[i] + blend * avg
            colors[j] = (1 - blend) * colors[j] + blend * avg
        else:
            colors[i] = (1 - blend) * colors[i] + blend * (255 - avg)
            colors[j] = (1 - blend) * colors[j] + blend * (255 - avg)
    return np.clip(colors, 0, 255).astype(np.uint8)

# --- Color Variation ---
def add_color_variation(colors, variance=0.35):
    """
    Add random noise to colors for visual variety.

    Adds Gaussian noise to prevent dots from looking too uniform or
    artificially smooth. Creates organic, hand-painted appearance.

    Args:
        colors: Array of RGB colors [N, 3]
        variance: Noise strength (0 = no noise, 1 = maximum noise)

    Returns:
        numpy.ndarray: Colors with added noise, clipped to 0-255 range
    """
    colors = np.array(colors, dtype=float)
    noise = np.random.normal(0, variance * 127.5, colors.shape)
    colors = colors + noise
    return np.clip(colors, 0, 255).astype(np.uint8)

# --- Drawing ---
def draw_dot(img, center, radius, color):
    """
    Draw a filled circular dot on the image.

    Renders a solid circle at the specified position with the given color.
    Uses simple rasterization with boundary checking.

    Args:
        img: RGBA image array to draw on (modified in-place)
        center: (y, x) coordinate for dot center
        radius: Radius of the dot in pixels
        color: RGB color array [r, g, b] with values 0-255
    """
    y, x = center
    h, w = img.shape[:2]
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dy * dy + dx * dx <= radius * radius:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w:
                    img[ny, nx, :3] = color
                    img[ny, nx, 3] = 255

# --- Main Run ---
def run(params):
    """
    Main entry point for the Quantum Pointillism brush effect.

    Called by QuantumBrush when user applies a stroke. Samples dots along
    the brush path, builds neighbor graph, runs quantum or classical color
    evolution, and renders the final dots.

    Args:
        params: Dictionary containing:
            - stroke_input: Dict with 'image_rgba' (canvas) and 'path' (stroke coordinates)
            - user_input: Dict with user-adjustable parameters:
                * Dot Count: Number of dots to place (10-200)
                * Coupling Strength: Ising coupling J (-1 to 1)
                * Evolution Time: Quantum evolution duration (0.1-10)
                * Target Color: External field color (hex or RGB)
                * Dot Size: Radius of rendered dots (1-20)
                * Color Variance: Random noise level (0-1)

    Returns:
        numpy.ndarray: Modified RGBA image with dots applied

    Notes:
        - Uses quantum simulation for ≤25 dots (exponential cost)
        - Automatically falls back to classical approximation for >25 dots
        - Returns original image unchanged if any error occurs
    """
    print("\n" + "="*100, flush=True)
    print("🎨 QUANTUM POINTILLISM (Path-Following) 🎨", flush=True)
    print("="*100 + "\n", flush=True)
    try:
        img = params["stroke_input"]["image_rgba"].copy()
        path = params["stroke_input"]["path"]
        ui = params["user_input"]

        dot_count = ui["Dot Count"]
        coupling = ui["Coupling Strength"]
        evo_t = ui["Evolution Time"]
        target = ui["Target Color"]
        
        # Convert target color
        if isinstance(target, str):
            target = np.array([
                int(target[1:3], 16),
                int(target[3:5], 16),
                int(target[5:7], 16)
            ])
        else:
            target = np.array(target)
        
        size = ui["Dot Size"]
        variance = ui.get("Color Variance", 0.35)
        
        h, w = img.shape[:2]

        # Check if we have a path
        if len(path) == 0:
            return img

        # --- Sample Dots Along Path ---
        # Spread is how far dots can stray from the path centerline
        spread = max(10, size * 1.5)  # Adaptive spread based on dot size
        min_dist = max(1, size * 0.6)
        
        dots = sample_along_path(path, dot_count, spread=spread, min_dist=min_dist)
        
        # Filter out-of-bounds dots
        valid_dots = []
        for dot in dots:
            y, x = int(dot[0]), int(dot[1])
            if 0 <= y < h and 0 <= x < w:
                valid_dots.append(dot)
        dots = np.array(valid_dots)
        
        if len(dots) == 0:
            return img
        
        print(f"✓ Sampled {len(dots)} dots along path", flush=True)

        # --- Neighbors ---
        adj_dist = max(size * 2, 10)
        neighbors = build_neighbors(dots, adj_dist)
        print(f"✓ Found {len(neighbors)} quantum correlations", flush=True)

        # --- Colors ---
        orig = []
        for dot in dots:
            y, x = int(dot[0]), int(dot[1])
            if 0 <= y < h and 0 <= x < w:
                orig.append(img[y, x, :3])
            else:
                orig.append(np.array([128, 128, 128]))  # Fallback gray
        
        quantum_ok = QISKIT_AVAILABLE and len(dots) <= 25
        
        if quantum_ok:
            qc = create_ising_circuit(len(dots), orig, neighbors, coupling, evo_t)
            if qc is not None:
                cols = measure_colors(qc, len(dots))
                if cols is not None:
                    print(f"✓ Using quantum Ising model", flush=True)
                else:
                    quantum_ok = False
            else:
                quantum_ok = False
        
        if not quantum_ok:
            cols = classical_blend(dots, orig, neighbors, coupling, target)
            print(f"✓ Using classical correlation", flush=True)

        # Add color variation
        cols = add_color_variation(cols, variance=variance)
        print(f"✓ Applied color variance", flush=True)
            
        # --- Draw Dots ---
        for i, dot in enumerate(dots):
            y, x = int(dot[0]), int(dot[1])
            if 0 <= y < h and 0 <= x < w:
                draw_dot(img, (y, x), size, cols[i])
            
        print(f"✓ Complete!\n", flush=True)
        return img
        
    except Exception as e:
        print(f"✗ Error: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return params["stroke_input"]["image_rgba"]
