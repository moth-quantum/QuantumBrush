import numpy as np
from qiskit import QuantumCircuit, generate_preset_pass_manager
from qiskit_aer import Aer
from qiskit.quantum_info import Pauli, SparsePauliOp, Statevector,partial_trace
from qiskit.circuit.library import RXGate, RZGate,XGate,ZGate,IGate,StatePreparation
import importlib.util
from qiskit import QuantumCircuit, ClassicalRegister, QuantumRegister
from qiskit_aer import Aer, statevector_simulator
from qiskit.quantum_info import partial_trace
import colorsys

import sys
import importlib.util
from pathlib import Path

if getattr(sys, 'frozen', False):
    app_path = Path(sys.executable).parent.parent
else:
    app_path = Path(__file__).resolve().parent.parent.parent

utils_path = app_path / 'effect' / 'utils.py'

spec = importlib.util.spec_from_file_location('utils', str(utils_path))
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)
#%%
mapping = ['hsv','hvs','shv','svh','vhs','vsh']

def hsv_to_statevector(hsv,mapping = 'hsv'):
    """
    Maps an RGB value to a qubit statevector and saturation.

    Args:
        rgb: A tuple of (r, g, b) values, where each is in the range [0, 255].

    Returns:
        A tuple of (statevector, saturation), where statevector is a
        numpy array representing the qubit state, and saturation is a float.
    """
    h, s, v = hsv
    hsv = {'h':h,'s':s,'v':v}
    # Map Hue to phase (phi) and Value to amplitude (theta)
    phi = hsv[mapping[0]] * 2 * np.pi
    theta = hsv[mapping[1]] * np.pi

    # Create the statevector [alpha, beta]
    alpha = np.cos(theta / 2)
    beta = np.exp(1j * phi) * np.sin(theta / 2)
    
    statevector = np.array([alpha, beta])
    return statevector, hsv[mapping[2]]

def statevector_to_hsv(statevector, semiclassical, mapping = 'hvs'):
    """
    Maps a qubit statevector and saturation back to an RGB value.

    Args:
        statevector: A numpy array representing the qubit state.
        saturation: The saturation value (as a float).

    Returns:
        A tuple of (r, g, b) values in the range [0, 255].
    """
    
    alpha, beta = statevector[0], statevector[1]

    # Inverse mapping from statevector to H and V
    # Ensure alpha is real and non-negative for acos to be in [0, pi]
    theta = 2 * np.arccos(np.abs(alpha))
    # Handle the case where beta is zero to avoid division by zero
    if np.abs(beta) > 1e-9:
        phi = np.angle(beta) - np.angle(alpha)
    else:
        phi = 0
    
    h = phi / (2 * np.pi)
    # Normalize h to be in [0, 1]
    if h < 0:
        h += 1
    v = theta / np.pi
    return {mapping[0]:h,mapping[1]:v,mapping[2]:semiclassical}
#%%
def find_closest_pure_state(density_matrix):
    """
    Finds the closest pure state to a given density matrix for a single qubit.

    The closest pure state is the eigenvector corresponding to the largest
    eigenvalue of the density matrix.

    Args:
        density_matrix: A 2x2 NumPy array representing the density matrix.
                        It must be Hermitian with a trace of 1.

    Returns:
        A tuple containing:
        - closest_pure_state_vector (np.ndarray): The state vector |ψ⟩.
        - closest_pure_state_density_matrix (np.ndarray): The density matrix |ψ⟩⟨ψ|.

    Raises:
        ValueError: If the input is not a valid 2x2 density matrix.
    """
    # --- Input Validation ---
    if not isinstance(density_matrix, np.ndarray) or density_matrix.shape != (2, 2):
        raise ValueError("Input must be a 2x2 NumPy array.")
    if not np.isclose(np.trace(density_matrix), 1):
        raise ValueError("The trace of the density matrix must be 1.")
    if not np.allclose(density_matrix, density_matrix.conj().T):
        raise ValueError("The density matrix must be Hermitian.")

    # --- Core Algorithm ---
    # For a Hermitian matrix, eigh is preferred as it's more efficient
    # and guarantees real eigenvalues and orthonormal eigenvectors.
    eigenvalues, eigenvectors = np.linalg.eigh(density_matrix)
    purity = np.matmul(density_matrix, density_matrix).trace().real
    # Find the index of the largest eigenvalue
    largest_eigenvalue_index = np.argmax(eigenvalues)

    # The corresponding eigenvector is the state vector of the closest pure state
    closest_pure_state_vector = eigenvectors[:, largest_eigenvalue_index]


    return closest_pure_state_vector, purity

def liveliness(nhood):
    v=nhood
    a = v[0][0]+v[1][0]+v[2][0]+v[3][0]+v[5][0]+v[6][0]+v[7][0]+v[8][0]
    return np.abs(a)
def SCGOL(nhood):
    a = liveliness(nhood)
    value =  nhood[4]
    alive = np.array([1.0,0.0])
    dead = np.array([0.0,1.0])
    B = np.array([[0,0],[1,1]])
    D = np.array([[1,1],[0,0]])
    S = np.array([[1,0],[0,1]])
    if a <= 1:
        value =  dead
    elif (a > 1 and a <= 2):
        value = ((np.sqrt(2)+1)*2-(np.sqrt(2)+1)*a)*dead+(a-1)*value#(((np.sqrt(2)+1)*(2-a))**2+(a-1)**2)
    elif (a > 2 and a <= 3):
        value = (((np.sqrt(2)+1)*3)-(np.sqrt(2)+1)*a)*value+(a-2)*alive#(((np.sqrt(2)+1)*(3-a))**2+(a-2)**2)
    elif (a > 3 and a < 4):
        value = ((np.sqrt(2)+1)*4-(np.sqrt(2)+1)*a)*alive+(a-3)*dead#(((np.sqrt(2)+1)*(4-a))**2+(a-3)**2)
    elif a >= 4:
        value = dead
    value = value/np.linalg.norm(value)
    return value

from qiskit.quantum_info import Operator, Statevector

# Precompute the unitary matrix for the Conway's Game of Life circuit
# This drastically speeds up execution instead of simulating it per pixel.
_gol_qc = QuantumCircuit(9)
for q in range(9):
    if q != 4:
        _gol_qc.crx(np.pi/2, 4, q)
    _gol_qc.cry(2*np.pi/(q+1), q, (q+1)%9)
    _gol_qc.crz(2*np.pi/((q+4)%9+1), q, (q+1)%9)
    if q != 4:
        _gol_qc.cx(q, 4)
GOL_UNITARY = Operator(_gol_qc).data

def game_of_life(nhood):
    v = np.array(nhood).reshape(9,2)
    # Ensure all inputs are normalized
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    v = np.where(norms > 0, v / norms, v)
    
    # Build the 9-qubit statevector
    # Qiskit uses little-endian, so q_n \otimes ... \otimes q_0
    sv = v[0]
    for i in range(1, 9):
        sv = np.kron(v[i], sv)
        
    # Apply the unitary operator
    sv_out = GOL_UNITARY @ sv
    
    # Trace out all qubits except qubit 4
    sv_obj = Statevector(sv_out)
    rho = partial_trace(sv_obj, [0,1,2,3,5,6,7,8])
    
    value, purity = find_closest_pure_state(rho.data)
    return value, purity

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
    map = mapping[params["user_input"]["Mapping"]]
    # It's a good practice to check any of the request variables
    assert image.shape[-1] == 4, "Image must be RGBA format"

    height = image.shape[0]
    width = image.shape[1]
    # Convert the image to HSV colorspace as a copy
    rgb_norm = image[:, :, :3].astype(np.float32) / 255.0

    image_hsv = np.apply_along_axis(
        lambda c: colorsys.rgb_to_hsv(c[0], c[1], c[2]),
        axis=2,
        arr=rgb_norm
    )
    
    # Extract the lasso path
    path = params["stroke_input"]["path"]
    
    radius = params["user_input"]["Radius"]
    if radius > 0:
        copy_region = utils.points_within_radius(path, radius, border = (height, width))
    else:
        copy_region = utils.points_within_lasso(path, border = (height, width))
    def extract_neighbourhoods(x, y):
        neighbours = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                ni, nj = (x + dx) % width, (y + dy) % height  # Wrap around edges
                neighbours.append((ni, nj))
        return neighbours
    
    
    for iterations in range(params["user_input"]["Iterations"]):
        copy_selection = {} 
        statevector_selection = {}
        semiclassical = {}
        after_iteration = {}
        for i in copy_region:
            neighbourhood = extract_neighbourhoods(i[0],i[1])
            nhood = np.zeros((9,2), dtype=np.complex128)
            nhood_s = np.zeros((9,2), dtype=np.float64)
            for n,coord in enumerate(neighbourhood):
                if coord not in copy_selection:
                    copy_selection[coord] = np.array(image_hsv[coord[0], coord[1],:3])
                    statevector_selection[coord],semiclassical[coord] = hsv_to_statevector(copy_selection[coord],mapping=map)
                nhood[n] = statevector_selection[coord]
                nhood_s[n] = semiclassical[coord], 1-semiclassical[coord]
            v, purity = game_of_life(nhood)
            new_sc = SCGOL(nhood_s)[0]
            hsv = statevector_to_hsv(v,semiclassical=new_sc, mapping=map)
            after_iteration[(i[0],i[1])] = np.array([hsv['h'],hsv['s'],hsv['v']])
        for key in after_iteration:
            image_hsv[key[0], key[1],:3] = after_iteration[key]
    for key in after_iteration:
        image[key[0], key[1],:3] = np.round(np.array(colorsys.hsv_to_rgb(*after_iteration[key]))*255).astype(np.uint8)
    return image
#%%