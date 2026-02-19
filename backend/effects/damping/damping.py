#Add any dependencies but don't forget to list them in the requirements if they need to be pip installed
import numpy as np
import colorsys
from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, SparsePauliOp, Statevector
import importlib.util
from scipy.stats import circmean

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)


def damping(initial_angles, strength,invert = False):
    num_qubits = len(initial_angles)
    print("initial angles",initial_angles)

    # We ned first to align the target angle to to z axis

    qc = QuantumCircuit(num_qubits + 1)
    rotation = 2*np.arccos(1-strength)

    # Prepare each qubit in the state defined by (theta, phi)
    for i, (phi, theta) in enumerate(initial_angles):
        qc.ry(theta, i)
        qc.rz(phi, i)

        if invert:
            qc.x(i)
            
        qc.cry(rotation,target_qubit = num_qubits,control_qubit  = i)
        qc.cx(target_qubit = i,control_qubit  = num_qubits)

        if invert:
            qc.x(i)

    ops = [SparsePauliOp(Pauli('I'*(num_qubits-i) + p + 'I'*i)) for p in ['X','Y','Z']  for i in range(num_qubits) ]
    obs = utils.run_estimator(qc,ops)

    x_expectations = obs[:num_qubits]
    y_expectations = obs[num_qubits:2*num_qubits]
    z_expectations = obs[2*num_qubits:]
    
    # phi = arctan2(Y, X)
    phi_expectations = [np.arctan2(y,x) % (2 * np.pi) for x, y in zip(x_expectations, y_expectations)]
    # theta = arccos(Z)
    theta_expectations = [np.arctan2(np.sqrt(x**2 + y**2),z) for x, y, z in zip(x_expectations, y_expectations, z_expectations)]

    final_angles = list(zip(phi_expectations, theta_expectations))
    return final_angles







# The only thing that you need to change is this function
def run(params):
    """
    Executes the effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values or None if the effect failed
    """

    
    # Extract image to work from
    image = params["stroke_input"]["image_rgba"]
    # It's a good practice to check any of the request variables
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height = image.shape[0]
    width = image.shape[1]

    path = params["stroke_input"]["path"]
    clicks = params["stroke_input"]["clicks"]
    assert len(clicks) < 20, "There can be no more than 20 clicks in a stroke"

    n_drops = len(clicks)

    split_paths = []
    # Split path into subpaths, each starting with a click
    click_indices = []
    c = 0
    for i, p in enumerate(path):
        if np.all(p == clicks[c]):
            click_indices.append(i)
            c += 1
            if c >= n_drops:
                break

    for idx, start in enumerate(click_indices):
        end = click_indices[idx + 1] if idx + 1 < len(click_indices) else len(path)
        interp_path = utils.interpolate_pixels(path[start:end])
        split_paths.append(interp_path)

    # Get the radius of the drop
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    invert = params["user_input"]["Invert Luminosity"]
    if invert:
        print("Inverting luminosity")

    initial_angles = [] #(Theta,phi)
    pixels = []
    for lines in split_paths:

        region = utils.points_within_radius(lines, radius, border = (height, width))

        selection = image[region[:, 0], region[:, 1]]
        selection = selection.astype(np.float32) / 255.0
        selection_hls = utils.rgb_to_hls(selection)
    
        phi = circmean(2 * np.pi * selection_hls[..., 0])
        theta = np.pi * np.mean(selection_hls[..., 1], axis=0)
    
        initial_angles.append((phi,theta))
        pixels.append((region, selection_hls))

    strength = params["user_input"]["Strength"]
    assert strength >= 0 and strength <= 1, "Strength must be between 0 and 1"

    final_angles =  damping(initial_angles, strength,invert)

    for i,(region,selection_hls) in enumerate(pixels):
        new_phi, new_theta = final_angles[i]
        old_phi, old_theta = initial_angles[i]

        offset_h = (new_phi - old_phi) / (2 * np.pi)
        offset_l = (new_theta - old_theta) / np.pi

        selection_hls[...,0] = (selection_hls[...,0] + offset_h) % 1
        selection_hls[...,1] += offset_l
    
        #Need to change the luminosity
        selection_hls = np.clip(selection_hls, 0, 1)
        selection_rgb = utils.hls_to_rgb(selection_hls)
        selection_rgb = (selection_rgb * 254).astype(np.uint8)

        image[region[:, 0], region[:, 1]] = selection_rgb
        
        
    return image
