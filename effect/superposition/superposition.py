import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
import importlib.util

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

def get_quantum_offsets(num_points, max_spread, num_qubits=4):
    offsets = []
    simulator = AerSimulator()
    
    qc = QuantumCircuit(num_qubits, num_qubits)
    for i in range(num_qubits):
        qc.h(i)
    # add measurements
    qc.measure(list(range(num_qubits)), list(range(num_qubits)))
        
    compiled_circuit = transpile(qc, simulator)
    
    max_val = (2 ** num_qubits) - 1
    shots = max(1, num_points * 2)
    job = simulator.run(compiled_circuit, shots=shots, memory=True)
    result = job.result()
    memory = result.get_memory()
    
    for i in range(num_points):
        val_x = int(memory[2*i], 2)
        val_y = int(memory[2*i + 1], 2)
        
        off_x = (val_x / max_val) * 2 * max_spread - max_spread
        off_y = (val_y / max_val) * 2 * max_spread - max_spread
        offsets.append((off_x, off_y))
        
    return offsets

def run(params):
    image = params["stroke_input"]["image_rgba"].copy()
    height, width = image.shape[:2]
    path = params["stroke_input"]["path"]
    
    radius = params["user_input"]["Radius"]
    strength = params["user_input"]["Strength"]
    spread = params["user_input"]["Spread"]
    color = params["user_input"]["Color"]

    r, g, b = color[:3]
    color_norm = np.array([r, g, b, 255.0], dtype=np.float32) / 255.0

    if len(path) == 0:
        return image

    num_ghosts = 3
    num_points = len(path)
    
    all_offsets = [get_quantum_offsets(num_points, spread) for _ in range(num_ghosts)]

    # Main path
    main_region = utils.points_within_radius(path, radius, border=(height, width))
    if len(main_region) > 0:
        ys, xs = main_region[:, 0], main_region[:, 1]
        patch = image[ys, xs].astype(np.float32) / 255.0
        alpha = strength
        patch[..., :3] = (1 - alpha) * patch[..., :3] + alpha * color_norm[:3]
        patch[..., 3] = np.maximum(patch[..., 3], alpha)
        image[ys, xs] = (patch * 255).astype(np.uint8)

    # Ghost paths
    for ghost_idx in range(num_ghosts):
        offsets = all_offsets[ghost_idx]
        ghost_path = []
        for pt_idx, pt in enumerate(path):
            off_x, off_y = offsets[pt_idx]
            ghost_y = int(np.clip(pt[0] + off_y, 0, height - 1))
            ghost_x = int(np.clip(pt[1] + off_x, 0, width - 1))
            ghost_path.append([ghost_y, ghost_x])
            
        ghost_path = np.array(ghost_path)
        ghost_radius = max(1, int(radius * 0.7))
        ghost_region = utils.points_within_radius(ghost_path, ghost_radius, border=(height, width))
        
        if len(ghost_region) > 0:
            g_ys, g_xs = ghost_region[:, 0], ghost_region[:, 1]
            g_patch = image[g_ys, g_xs].astype(np.float32) / 255.0
            g_alpha = strength * 0.4
            g_patch[..., :3] = (1 - g_alpha) * g_patch[..., :3] + g_alpha * color_norm[:3]
            g_patch[..., 3] = np.maximum(g_patch[..., 3], g_alpha)
            image[g_ys, g_xs] = (g_patch * 255).astype(np.uint8)

    return image
