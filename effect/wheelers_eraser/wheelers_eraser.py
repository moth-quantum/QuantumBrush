import numpy as np
import colorsys
import math
from qiskit import QuantumCircuit
from qiskit.quantum_info import SparsePauliOp
import importlib.util

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

def get_eraser_circuit(theta, measurement_type):
    """
    Simulates the Delayed Choice Quantum Eraser interferometer.
    Qubit 0: Signal photon
    Qubit 1: Idler photon (which-path marker)
    """
    qc = QuantumCircuit(2)
    
    # 1. First beam splitter (creates superposition of paths for signal)
    qc.h(0)
    
    # 2. Phase accumulation based on stroke path length (theta)
    qc.p(theta, 0)
    
    # 3. Entanglement (generates which-path info by correlating signal to idler)
    # Physically, this represents SPDC (Spontaneous Parametric Down-Conversion)
    qc.cx(0, 1)
    
    # 4. Delayed Choice on Idler Photon
    if measurement_type == "interference":
        # Eraser ON: Erase the which-path info from the idler photon by applying a Hadamard
        qc.h(1)
    elif measurement_type == "which-path":
        # Eraser OFF: Do nothing, preserving which-path info in the idler
        pass
        
    # 5. Second beam splitter (recombination of signal)
    qc.h(0)
    
    return qc

def run_wheelers_hardware(theta_list, measurement_type):
    """
    Executes the quantum circuits for each point along the stroke.
    Calculates coincidence probabilities P(Signal=0 | Idler=0).
    """
    circuits = []
    for theta in theta_list:
        circ = get_eraser_circuit(theta, measurement_type)
        circuits.append(circ)
        
    # We want to measure coincidence counts between Signal and Idler.
    # Specifically, the probability P(Signal=0 | Idler=0)
    # Using Pauli Z observables:
    # Z0 = IZ (Z on Signal qubit 0)
    # Z1 = ZI (Z on Idler qubit 1)
    # ZZ = ZZ (Z on both)
    operators = [SparsePauliOp("IZ"), SparsePauliOp("ZI"), SparsePauliOp("ZZ")]
    
    values = utils.run_estimator(circuits, operators, backend=None)
    
    probabilities = []
    for val in values:
        e_z0, e_z1, e_zz = val[0], val[1], val[2]
        # Calculate projector probabilities
        p_00 = (1 + e_z0 + e_z1 + e_zz) / 4
        p_idl0 = (1 + e_z1) / 2
        
        # P(Signal=0 | Idler=0)
        prob = p_00 / p_idl0 if p_idl0 > 1e-6 else 0.5
        probabilities.append(prob)
        
    return np.array(probabilities)

def run(params):
    image = params["stroke_input"]["image_rgba"].copy()
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height, width = image.shape[0], image.shape[1]
    path = params["stroke_input"]["path"]
    
    radius = params["user_input"].get("Radius", 10)
    color = params["user_input"].get("Color", "#FF0000")
    
    # Parse hex string to RGB tuple if necessary
    if isinstance(color, str):
        color = color.lstrip('#')
        color = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
        
    strength = params["user_input"].get("Strength", 0.8)
    
    # Wheeler's specific params
    measurement = params["user_input"].get("Measurement", "interference") # 'interference' or 'which-path'
    slit_count = params["user_input"].get("Slit Count", 3)
    coherence = params["user_input"].get("Coherence", 1.0)
    
    h, l, s = colorsys.rgb_to_hls(color[0]/255, color[1]/255, color[2]/255)
    
    # Map distance along stroke to theta
    total_points = len(path)
    if total_points == 0: return image
    
    # OPTIMIZATION: Only simulate 100 quantum circuits max, then interpolate
    num_quantum_samples = min(100, total_points)
    max_theta = slit_count * 2 * math.pi
    theta_list = np.linspace(0, max_theta, num_quantum_samples)
    
    # Quantum simulation: array of P(Signal=0 | Idler=0)
    probs_sampled = run_wheelers_hardware(theta_list, measurement)
    
    # Interpolate the probabilities to match the full path length
    if total_points > num_quantum_samples:
        x_sampled = np.linspace(0, 1, num_quantum_samples)
        x_full = np.linspace(0, 1, total_points)
        probs = np.interp(x_full, x_sampled, probs_sampled)
    else:
        probs = probs_sampled
    
    # Chunk the path like Heisenbrush for smooth execution
    split_size = max(1, len(path) // len(probs))
    split_paths = [path[i * split_size : (i + 1) * split_size] for i in range(len(probs) - 1)]
    split_paths.append(path[(len(probs) - 1) * split_size :])
    
    for i, p_chunk in enumerate(split_paths):
        # We need to map the sub-path back to region
        region, distances = utils.points_within_radius(p_chunk, radius, border=(height, width), return_distance=True)
        if len(region) == 0: continue
        
        # Base quantum probability
        prob = probs[i]
        
        # Apply Coherence (quantum decoherence limits interference contrast)
        prob = 0.5 + (prob - 0.5) * coherence
        
        # Calculate visual shift based on measurement mode
        if measurement == "interference":
            # Wave behavior: probability smoothly modulates the color intensity/lightness
            shift = (prob - 0.5) * strength
            new_l = max(0, min(1, l + shift * 0.8)) # Modulate lightness
            new_s = max(0, min(1, s + shift * 0.4)) # Modulate saturation
            
            # Create a smooth continuous brush stroke
            new_rgb = colorsys.hls_to_rgb(h, new_l, new_s)
            new_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
            new_patch[...,:3] = new_rgb
            image[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], new_patch, blur=True, distance=distances)
            
        else:
            # Particle behavior: Which-path wave function collapsed.
            # Instead of a smooth wave, we get individual photon impacts (discrete points).
            # We simulate particle strikes using random binomial scatter based on the probability.
            
            hit_prob = prob * (strength * 0.5) * np.exp(-distances**2) # Scale hit probability by Gaussian falloff
            hit_mask = np.random.rand(len(region)) < hit_prob
            
            if np.any(hit_mask):
                new_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
                new_rgb = colorsys.hls_to_rgb(h, l, s)
                new_patch[hit_mask, :3] = new_rgb
                
                # Blend only the exact pixels hit
                orig_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
                blended_patch = np.where(hit_mask[:, None], new_patch, orig_patch)
                image[region[:, 0], region[:, 1]] = (blended_patch * 255).astype(np.uint8)

    print("Wheeler's Eraser effect applied successfully")
    return image
