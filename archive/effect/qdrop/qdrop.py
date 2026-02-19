#Add any dependencies but don't forget to list them in the requirements if they need to be pip installed
import numpy as np
import colorsys
from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, SparsePauliOp, Statevector, entropy, partial_trace
import importlib.util
from scipy.stats import circmean

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)


def drop(initial_angles, target_angle,strength):
    num_qubits = len(initial_angles)
    print("initial angles",initial_angles)
    print("target angles",target_angle)

    target_phi, target_theta = target_angle

    # We ned first to align the target angle to to z axis

    qc = QuantumCircuit(num_qubits + 1)

    qc.x(num_qubits)
    for i, (phi, theta) in enumerate(initial_angles):
        qc.ry(theta, i)
        qc.rz(phi, i)

    # Prepare each qubit in the state defined by (theta, phi)
    for i, (phi, theta) in enumerate(initial_angles):
        qc.crz( - strength * phi,target_qubit = i,control_qubit  = num_qubits)
        qc.cry(strength * (target_theta-theta),target_qubit = i,control_qubit  = num_qubits)
        qc.crz( strength * target_phi,target_qubit = i,control_qubit  = num_qubits)
        qc.cry(np.pi/3, target_qubit = num_qubits, control_qubit= i,ctrl_state='0')
            
    # Compute entanglement entropy after tracing out the last qubit
    if False:
        state = Statevector(qc)
        reduced_state = partial_trace(state, [num_qubits])  # trace out the last (ancilla/control) qubit
        nt = entropy(reduced_state)
        print("Entanglement entropy (tracing out control qubit):", ent)
        ops = [SparsePauliOp(Pauli('I'*(num_qubits-i) + p + 'I'*i)) for p in ['X','Y','Z']  for i in range(num_qubits) ]

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

    n_drops = params["user_input"]["Number of Drops"]
    assert n_drops > 0, "Number of drops must be greater than 0"

    # Split a path into n_drops smaller paths
    path_length = len(path)
    assert path_length > n_drops, "The number of pixels in the stroke must be bigger than the number of drops"

    split_size = max(1, path_length // n_drops)
    split_paths = [path[i * split_size : (i + 1) * split_size] for i in range(n_drops - 1)]
    split_paths.append(path[(n_drops - 1) * split_size :])

    # Get the radius of the drop
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    target_color = params["user_input"]["Target Color"]
    target_color = utils.rgb_to_hls(np.array(target_color)/255.0)
    target_angle = (2 * np.pi * target_color[0], np.pi * target_color[1])
    print("target angle", target_angle)
    initial_angles = [] #(Theta,phi)
    pixels = []
    for lines in split_paths:
        region = utils.points_within_radius(lines, radius,border = (height, width))

        selection = image[region[:, 0], region[:, 1]]
        selection = selection.astype(np.float32) / 255.0
        selection_hls = utils.rgb_to_hls(selection)
    
        phi = circmean(2 * np.pi * selection_hls[..., 0])
        theta = np.pi * np.mean(selection_hls[..., 1], axis=0)
        print("initial angle", (phi, theta))
        initial_angles.append((phi,theta))
        pixels.append((region, selection_hls))

    strength = params["user_input"]["Strength"]
    assert strength >= 0 and strength <= 1, "Strength must be between 0 and 1"

    final_angles =  drop(initial_angles, target_angle, strength)
    print("final angles", final_angles)
    for i,(region,selection_hls) in enumerate(pixels):
        new_phi, new_theta = final_angles[i]
        old_phi, old_theta = initial_angles[i]

        offset_h = (new_phi - old_phi) / (2 * np.pi)
        offset_l = (new_theta - old_theta) / np.pi

        selection_hls[...,0] = (selection_hls[...,0] + offset_h) % 1
        selection_hls[...,1] += offset_l
        #selection_hls[...,2] *= 100000

        #Need to change the luminosity
        selection_hls = np.clip(selection_hls, 0, 1)

        selection_rgb = utils.hls_to_rgb(selection_hls)
        selection_rgb = (selection_rgb * 254).astype(np.uint8)

        image[region[:, 0], region[:, 1]] = selection_rgb
        
        
    return image
