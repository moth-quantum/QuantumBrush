import numpy as np
import colorsys
from qiskit import QuantumCircuit, QuantumRegister, generate_preset_pass_manager
from qiskit.quantum_info import SparsePauliOp
import importlib.util

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)


def scale_to_range(x, in_min=1, in_max=100, out_min=2, out_max=10):
    """
    Linearly scale x from [in_min, in_max] to [out_min, out_max].
    """
    if not (in_min <= x <= in_max):
        raise ValueError(f"Input {x} is out of range [{in_min}, {in_max}]")
    return int(round(out_min + (x - in_min) * (out_max - out_min) / (in_max - in_min))) if in_max<100 else 10


def get_mean_magnetization(n_qubits:int):
    z_pauli = []
    for site in range(n_qubits):
        z_op = ['I'] * n_qubits
        z_op[site] = 'Z'
        z_pauli.append(''.join(z_op))
    return SparsePauliOp(z_pauli)/n_qubits

def time_evolution_Heisenberg(n_qubits: int, J_list: list, hz_list: list, hx_list: list, dt: float) -> QuantumCircuit:
    """Time evolution circuit for the Heisenberg model with periodic boundary conditions
    Args:
        n_qubits: number of qubits
        J_list: interacting couplings for each nearest neighbor
        hz_list: local Z field for each qubit
        hx_list: local X field for each qubit
        dt: time step
    Returns:
        circ_dt: QuantumCircuit of the time evolution
    """

    if not isinstance(dt, (int, float)):
        dt = 0.1
    if dt <= 0:
        raise ValueError("dt must be a positive number.")

    q = QuantumRegister(n_qubits)
    circ_dt = QuantumCircuit(q)

    for n in range(n_qubits):
        J = J_list[n]
        ##  exp(-it * J * (X_n X_{n+1} + Y_n Y_{n+1} + Z_n Z_{n+1}))
        circ_dt.rxx(2*J*dt, q[n], q[(n+1)%n_qubits])
        circ_dt.ryy(2*J*dt, q[n], q[(n+1)%n_qubits])
        circ_dt.rzz(2*J*dt, q[n], q[(n+1)%n_qubits])

    for n in range(n_qubits):
        ##  exp(-it * hx[n] * X_n) exp(-it * hz[n] * Z_n)
        circ_dt.rz(2*dt*hz_list[n], q[n])
        circ_dt.rx(2*dt*hx_list[n], q[n])

    return circ_dt

def run_heisenberg_hardware(dt_list, radius, phi, theta):
    """
    Run Heisenberg model simulation on quantum hardware simulator.

    Args:
        dt_list: List of time steps for evolution

    Returns:
        List of RGB color tuples
    """
    try:

        nsteps = len(dt_list)
        n_qubits = scale_to_range(radius)

        J_list =[-0.5]*n_qubits
        hz_list =[0.5]*n_qubits
        hx_list =[0.5]*n_qubits

        circuits=[]
        circ = QuantumCircuit(n_qubits)
        #Create initial state with rotations of phi,theta for each qubit
        initial_angles = [(phi, theta)] * n_qubits  # All qubits start with the same angles
        for i, (phi, theta) in enumerate(initial_angles):
            circ.ry(theta, i)
            circ.rz(phi, i)


        ### start time evolution
        for step,dt in zip(range(nsteps),dt_list):
            print(f"J_list: {J_list}, hz_list: {hz_list}, hx_list: {hx_list}, dt: {dt}")
            circ_dt = time_evolution_Heisenberg(n_qubits, J_list, hz_list, hx_list, dt)
            circ = circ.compose(circ_dt)
            circuits.append(circ.copy())


        observables = get_mean_magnetization(n_qubits)

        # Run the estimator
        values=utils.run_estimator(circuits, observables, backend=None)

        values=np.array([val[0] for val in values])

        print(f"Values: {values}")
        return values
       

    except Exception as e:
        print(f"Quantum simulation failed: {e}")

        return


# The main function using  Heisenberg model
def run(params):
    """
    Executes the Heisenberg quantum effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values or None if the effect failed
    """

    # Extract image to work from
    image = params["stroke_input"]["image_rgba"].copy()
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height = image.shape[0]
    width = image.shape[1]

    path = params["stroke_input"]["path"]

    # Get the radius of the effect
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    color = params["user_input"]["Color"]
    h,l,s = colorsys.rgb_to_hls(color[0]/255, color[1]/255, color[2]/255)
    print(f"Using color: {color}")

    phi, theta, _ = utils.color_to_spherical(color)
    print(f"Using angles: phi={phi}, theta={theta}")

    strength = params["user_input"]["Strength"]
    assert strength > 0, "Strength must be greater than 0"


    normalized_distances = [0.1] * int(max(2,min(len(path)/radius/4, 10))) #dt*path_length
  
    # Run Heisenberg simulation to get colors
    color_shifts = run_heisenberg_hardware(normalized_distances, radius, phi, theta)

    new_hls = np.array([[(h + shift) % 1.0, (l + shift) % 1, (s + shift) % 1.0] for shift in color_shifts])
    new_hls = np.array([(1 - strength) * np.array([h,l,s]) + strength * new for new in new_hls])
    heisenberg_colors = utils.hls_to_rgb(new_hls)

 
    split_size = max(1, len(path) // len(heisenberg_colors))
    split_paths = [path[i * split_size : (i + 1) * split_size] for i in range(len(heisenberg_colors) - 1)]
    split_paths.append(path[(len(heisenberg_colors) - 1) * split_size :])

    
    for i,path in enumerate(split_paths):
        # Get the region around this point
        region = utils.points_within_radius(path, radius, border=(height, width))

        new_patch = image[region[:, 0], region[:, 1]].astype(np.float32)/255
        new_patch[...,:3] = heisenberg_colors[i]

        image[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], new_patch)

    print("Heisenberg effect applied successfully")
    return image