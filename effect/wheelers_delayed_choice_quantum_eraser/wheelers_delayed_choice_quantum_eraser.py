import numpy as np
import colorsys
import math
import random
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
    
    # 1. First beam splitter (creates superposition of paths)
    qc.h(0)
    
    # 2. Phase accumulation based on stroke path length (theta)
    qc.p(theta, 0)
    
    # 3. Entanglement (generates which-path info by correlating signal to idler)
    qc.cx(0, 1)
    
    # 4. Delayed Choice
    if measurement_type == "interference":
        # Eraser ON: Erase the which-path info from the idler photon!
        qc.h(1)
        
    # 5. Second beam splitter (recombination)
    qc.h(0)
    
    return qc

def run_wheelers_hardware(theta_list, measurement_type):
    """
    Executes the quantum circuits for each point along the stroke.
    """
    circuits = []
    for theta in theta_list:
        circ = get_eraser_circuit(theta, measurement_type)
        circuits.append(circ)
        
    # We measure ZZ (correlation between signal and idler)
    # If eraser is ON, ZZ oscillates with cos(theta)
    # If eraser is OFF (which-path), ZZ is 0 (interference destroyed)
    observables = [SparsePauliOp("ZZ")] * len(circuits)
    
    values = utils.run_estimator(circuits, observables, backend=None)
    values = np.array([val[0] for val in values])
    return values

def run(params):
    image = params["stroke_input"]["image_rgba"].copy()
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height, width = image.shape[0], image.shape[1]
    path = params["stroke_input"]["path"]
    
    radius = params["user_input"].get("Radius", 10)
    color = params["user_input"].get("Color", "#FF0000")
    strength = params["user_input"].get("Strength", 0.8)
    
    # Wheeler's specific params
    measurement = params["user_input"].get("Measurement", "interference") # 'interference' or 'which-path'
    slit_count = params["user_input"].get("Slit Count", 3)
    coherence = params["user_input"].get("Coherence", 1.0)
    
    h, l, s = colorsys.rgb_to_hls(color[0]/255, color[1]/255, color[2]/255)
    
    # Map distance along stroke to theta
    total_points = len(path)
    if total_points == 0: return image
    
    # theta frequency is scaled by slit_count
    max_theta = slit_count * 2 * math.pi
    theta_list = np.linspace(0, max_theta, total_points)
    
    # Quantum simulation
    zz_expectations = run_wheelers_hardware(theta_list, measurement)
    
    for i, p in enumerate(path):
        region = utils.points_within_radius([p], radius, border=(height, width))
        if len(region) == 0: continue
        
        expected_z = zz_expectations[i] * coherence
        
        # Calculate visual shift based on measurement mode
        if measurement == "interference":
            # Interference pattern (fringes)
            shift = expected_z * strength
            new_l = max(0, min(1, l + shift * 0.4)) # Modulate lightness
            new_s = max(0, min(1, s + shift * 0.4)) # Modulate saturation
            new_h = h
            
            # Create a smooth continuous brush stroke
            new_rgb = colorsys.hls_to_rgb(new_h, new_l, new_s)
            new_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
            new_patch[...,:3] = new_rgb
            image[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], new_patch)
            
        else:
            # Which-path collapse (particle-like scatter)
            # expected_z is 0 from the circuit, so no macroscopic interference.
            # We simulate particle strikes using random binomial scatter
            new_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
            
            # For which-path, each point on the canvas acts as a discrete particle detector
            # The density of dots depends on strength
            probs = np.random.rand(len(region))
            hit_mask = probs < (strength * 0.3) # 30% hit rate scaled by strength
            
            if np.any(hit_mask):
                new_rgb = colorsys.hls_to_rgb(h, l, s)
                new_patch[hit_mask, :3] = new_rgb
                
                # We need to manually blend the scattered dots into the original image
                orig_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
                # Only apply the new_patch where hit_mask is true
                blended_patch = np.where(hit_mask[:, None], new_patch, orig_patch)
                image[region[:, 0], region[:, 1]] = (blended_patch * 255).astype(np.uint8)

    print("Wheeler's Eraser effect applied successfully")
    return image
