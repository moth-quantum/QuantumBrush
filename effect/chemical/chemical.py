"""
Chemical Brush Effect Module.

The `Chemical` brush uses intermediate steps of the Variational Quantum 
Eigensolver (VQE) algorithm from quantum chemistry to locally modify the 
colors of a canvas. In this way, the brush encodes not only the physical 
process related to the ground state of molecules but also the behavior of 
the variational algorithm itself.

Authors:
    Jui-Ting Lu & Henrique Ennes
"""

import numpy as np
from qiskit import qpy
from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, SparsePauliOp
import importlib.util
from scipy.stats import circmean
import json

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

def resize_list_repeat(values, new_length):
    """
    Resize a list by repeating or skipping elements uniformly.

    Args:
        values (list): Original list of elements to resize.
        new_length (int): Desired length of the output list. Must be non-negative.

    Returns:
        list: A new list of length `new_length`.
    """
    
    if new_length <= 0:
        return []

    old_length = len(values)
    if old_length == 0:
        return []
    if old_length == 1:
        return [values[0]] * new_length
    if old_length == new_length:
        return values.copy()

    # Compute the new indices uniformly
    idx = np.linspace(0, old_length - 1, new_length)
    idx = np.round(idx).astype(int)

    return [values[i] for i in idx]


def chemistry(initial_angles, circuit, params_to_apply, num_repeat, params=None):
    """
    Run Chemical model simulation on quantum hardware simulator.

    Args:
        initial_angles (list): List of initial angles (phi, theta) for each drop
        circuit: The quantum circuit in parametric form.
        params_to_apply (list): List of parameters to apply to the circuit.
        

    Returns:
        Final angles after application of circuits.
    """
    num_angles = len(initial_angles)
    print(f"{len(initial_angles)} initial angles: {initial_angles}")

    num_qubits = circuit.num_qubits 
    num_circuits = num_angles // num_qubits 
    leftover_qubits =  num_angles % num_qubits # number of leftover qubits
    # repeat the parameters if user wants to apply each circuits on more than 1 times 
    adjusted_params_to_apply = [x for x in params_to_apply for _ in range(num_repeat)]
    # adjust the number of parameters of subcircuits to match the expected number of subcircuits
    if num_angles > len(adjusted_params_to_apply):
        adjusted_params_to_apply = resize_list_repeat(params_to_apply, num_circuits)

    # Use mutliple circuits to get the output angles
    x_expectations = np.zeros(num_qubits * num_circuits)
    y_expectations = np.zeros(num_qubits * num_circuits)
    z_expectations = np.zeros(num_angles * num_circuits)
    for index_subcircuit in range(num_circuits):
        qc = QuantumCircuit(num_qubits+1) 
        start_index =  index_subcircuit * num_qubits
        end_index = start_index + num_qubits
        # Prepare each qubit in the state defined by (theta, phi)
        qc.x(num_qubits)
        for i, (phi, theta) in enumerate(initial_angles[leftover_qubits+start_index:leftover_qubits+end_index]):
            qc.ry(theta, i)
            qc.rz(phi, i)
        
        qc.compose(circuit.assign_parameters({
                '_t_0_' : adjusted_params_to_apply[index_subcircuit][0], 
                '_t_1_' : adjusted_params_to_apply[index_subcircuit][1], 
                '_t_2_' : adjusted_params_to_apply[index_subcircuit][2]}), qubits= range(num_qubits), inplace=True)

        # measure expectations
        ops = [SparsePauliOp(Pauli('I'*(num_qubits-i) + p + 'I'*i)) for p in ['X','Y','Z']  for i in range(num_qubits)]
        p = params or {}
        obs = utils.run_estimator(
            qc, ops,
            backend=p.get("backend"),
            hw=p.get("hw"),
            cost_estimate_out=p.get("cost_accumulator"),
        )
        # Store the expectations
        x_expectations[start_index:end_index] = obs[:num_qubits].mean()
        y_expectations[start_index:end_index] = obs[num_qubits:2*num_qubits].mean()
        z_expectations[start_index:end_index] = obs[2*num_qubits:].mean()

    # phi = arctan2(Y, X)
    phi_expectations = [np.arctan2(y,x) % (2 * np.pi) for x, y in zip(x_expectations, y_expectations)]
    # theta = arccos(Z)
    theta_expectations = [np.arctan2(np.sqrt(x**2 + y**2),z) for x, y, z in zip(x_expectations, y_expectations, z_expectations)]

    final_angles = list(zip(phi_expectations, theta_expectations))

    return initial_angles[:leftover_qubits]+final_angles



# The main function using Chemical model
def run(params):
    """
    Executes the effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values or None if the effect failed
    """

    
    # Extract image parameters
    image = params["stroke_input"]["image_rgba"]
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height = image.shape[0]
    width = image.shape[1]

    # Extract user-defined parameters
    molecule = "H2"
    with open('effect/chemical/data/' + molecule.lower() + '_parameters.json', "r") as f:
        circuit_params = json.load(f)
    with open('effect/chemical/data/' + molecule.lower() + '_circuit.qpy', "rb") as f:
        circuit = qpy.load(f)[0]

    distance = params["user_input"]["Bond Distance"]
    assert 2.5 >= distance >= 0.735, "Distance must be greater than between 0.735 and 2.5 Angstroms"
    distances = [float (d) for d in circuit_params.keys()]
    distance = min(distances, key=lambda x:abs(x-distance))
    print(f"Selected distance for simulation: {distance} Angstroms")
    
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"
    num_repeat = params["user_input"]["Number of Repeats"]
    assert num_repeat >= 1, "Number of Repeats must be at least 1"
   
    # Extract stroke parameters
    path = params["stroke_input"]["path"]
    
    path_length = len(path)

    # Split path to have the same number of pixels as circuits available
    params_to_apply = circuit_params[str(distance)]
    print(f"Using distance: {distance} and the number of available circuits: {len(params_to_apply)}")
    num_discretization = len(params_to_apply) * circuit.num_qubits # number of available circuits * qubits
    split_size = max(1, path_length // num_discretization)
    split_paths = [path[i * split_size : (i + 1) * split_size] for i in range(num_discretization - 1)]
    split_paths.append(path[(num_discretization - 1) * split_size :])
    
    initial_angles = [] #(Theta,phi)
    pixels = []
    for lines in split_paths:

        region, distance = utils.points_within_radius(lines, radius, border = (height, width), return_distance=True)

        selection = image[region[:, 0], region[:, 1]]
        selection = selection.astype(np.float32) / 255.0
        selection_hls = utils.rgb_to_hls(selection)
    
        phi = circmean(2 * np.pi * selection_hls[..., 0])
        theta = np.pi * np.mean(selection_hls[..., 1], axis=0)
    
        initial_angles.append((phi,theta))
        pixels.append((region, distance, selection_hls))
    
    final_angles =  chemistry(initial_angles, circuit, params_to_apply, num_repeat, params=params)
    print("final angles", final_angles)

    for i,(region, distance, selection_hls) in enumerate(pixels):
        new_phi, new_theta = final_angles[i]
        old_phi, old_theta = initial_angles[i]

        offset_h = (new_phi - old_phi) / (2 * np.pi)
        offset_l = (new_theta - old_theta) / np.pi

        selection_hls[...,0] = (selection_hls[...,0] + offset_h) % 1
        selection_hls[...,1] += offset_l

        selection_hls = np.clip(selection_hls, 0, 1)

        selection_rgb = utils.hls_to_rgb(selection_hls)
        selection_rgb = (selection_rgb * 254).astype(np.uint8)

        image[region[:, 0], region[:, 1]] = selection_rgb

    return image