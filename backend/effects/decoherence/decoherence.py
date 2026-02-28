import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from backend import utils

# Decoherence effect (Qiskit version):
# Computes a quantum decoherence factor for the average pixel of a patch
# and applies that factor to the entire patch.

T1_VALUES = [
    0.0002517, # R
    0.0003629, # G
    0.0003598  # B
]

def get_decoherence_factor(val, intensity, channel_idx):
    if val <= 0.001:
        return 1.0
        
    qc = QuantumCircuit(2)
    
    # 1. Encode value into qubit 0 (System)
    theta_in = 2 * np.arcsin(np.sqrt(val))
    qc.ry(theta_in, 0)
    
    # 2. Amplitude Damping (Decoherence)
    if intensity > 0:
        t1 = T1_VALUES[channel_idx] if channel_idx < len(T1_VALUES) else 0.0003
        scale = 0.00005
        gamma = 1.0 - np.exp(-(intensity * scale) / t1)
        
        theta_noise = 2 * np.arcsin(np.sqrt(np.clip(gamma, 0, 1)))
        
        # Controlled RY from 0 to 1
        qc.cry(theta_noise, 0, 1)
        # Reset system if ancilla flipped
        qc.cx(1, 0)
        
    # 3. Extract the probability of system qubit (0) being in state |1>
    sv = Statevector.from_instruction(qc)
    probs = sv.probabilities()
    
    # Probs indices: 00=0, 01=1, 10=2, 11=3.
    # We want qubit 0 to be 1: indices 1 and 3.
    prob1 = probs[1] + probs[3]
    
    return float(np.clip(prob1 / val, 0, 1))

def run(params):
    """
    Executes the Decoherence quantum effect pipeline.
    """
    image = params["stroke_input"]["image_rgba"].copy()
    height, width = image.shape[0], image.shape[1]
    
    # Create the transparent layer we will draw onto
    new_layer = np.zeros_like(image, dtype=np.uint8)
    path = params["stroke_input"]["path"]
    clicks = params["stroke_input"]["clicks"]
    
    # Optional path smoothing interpolation
    if params.get("flags", {}).get("smooth_path", True):
        split_paths = utils.split_path_from_clicks(path, clicks)
        path = np.vstack(split_paths) if split_paths else np.array([])
        
    radius = params["user_input"]["Radius"]
    intensity = params["user_input"]["Decoherence"]

    # Process in sections along the path to avoid too many circuit runs
    # Similar to how it was done in JS
    num_steps = len(path)
    # We'll step through the path
    step_size = max(1, int(radius / 2))
    
    for i in range(0, num_steps, step_size):
        # Current segment of path
        p_segment = path[i : i + step_size]
        region = utils.points_within_radius(p_segment, radius, border=(height, width))
        if len(region) == 0:
            continue
            
        # Get patch and normalize
        patch = image[region[:, 0], region[:, 1]].astype(np.float32) / 255.0
        
        # Average color for the patch
        avg_rgb = np.mean(patch[:, :3], axis=0)
        
        # Start of Validated Algorithm
        # Compute factors
        factors = [get_decoherence_factor(avg_rgb[c], intensity, c) for c in range(3)]
        
        # Apply factors
        new_patch = patch.copy()
        for c in range(3):
            new_patch[:, c] *= factors[c]
        # End of Validated Algorithm
            
        # Re-apply to the transparent layer using utils (handles blending/alpha)
        # We pull the original alpha to keep it unchanged outside of brush
        alpha_patch = image[region[:, 0], region[:, 1], 3:4]
        
        patched_colors = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], new_patch)
        
        new_layer[region[:, 0], region[:, 1], :3] = patched_colors[:, :3]
        new_layer[region[:, 0], region[:, 1], 3:4] = alpha_patch
        
    return new_layer
