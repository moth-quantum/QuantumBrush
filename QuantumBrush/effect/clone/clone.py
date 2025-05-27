#Add any dependencies but don't forget to list them in the requirements if they need to be pip installed
import numpy as np
import time  # Added proper import for sleep functionality

def values_to_angles(values):
    log_values = np.log(values + 1e-16)  # Avoid log(0) by adding a small constant
    dif = np.array([log_values[i] - log_values[i+1] for i in range(len(log_values) - 1)])
    angles = np.arctan(1/dif)

    return angles

def angles_to_values(angles,initial_value=1.0):
    """
    Convert angles back to values using the inverse of the transformation.
    """
    values = [initial_value]
    for angle in angles:
        next_value = values[-1] - np.cos(angle)
        values.append(next_value)
    return np.array(values)


def svd(matrix=None,U=None,S=None,Vt=None):
    if U is not None:
        S_matrix = np.diag(S)  # Convert singular values into a diagonal matrix
        mat = U @ S_matrix @ Vt
        return mat

    """Compute the Ordered Singular Value Decomposition (SVD) of a matrix."""
    U, S, Vt = np.linalg.svd(matrix, full_matrices=False)
    sorted_indices = np.argsort(S)[::-1]  # Sort singular values in descending order
    return U[:, sorted_indices], S[sorted_indices], Vt[sorted_indices, :]


def square_region(click, radius):
    horizontal = np.arange(click[1] - radius, click[1] + radius + 1,dtype=int)
    vertical = np.arange(click[0] - radius, click[0] + radius + 1,dtype=int)
    mesh_x, mesh_y = np.meshgrid(horizontal, vertical)
    points = np.stack((mesh_y.flatten(), mesh_x.flatten()), axis=-1)
    return points

def PCA(tensor):
    assert tensor.ndim == 2, "Input tensor must be 2D (shape: [N, D])"

    # Center the data
    mean = np.mean(tensor, axis=0)
    centered = tensor - mean

    # Compute covariance matrix
    cov = np.cov(centered, rowvar=False)

    # Eigen decomposition (PCA)
    eigvals, eigvecs = np.linalg.eigh(cov)

    # Sort eigenvalues and eigenvectors in descending order
    idx = np.argsort(eigvals)[::-1]
    eigvecs = eigvecs[:, idx]
    eigvals = eigvals[idx]

    return eigvals, eigvecs, mean


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

    clicks = params["stroke_input"]["clicks"]
    assert len(clicks) == 2, "The number of clicks must 2, i.e. copy and paste"
    print(f"Clicks: {clicks}")

    copy_region = square_region(clicks[0], params["user_input"]["Radius"])
    copy_region = np.clip(copy_region, [0, 0], [height - 1, width - 1])

    copy_selection = image[copy_region[:, 0], copy_region[:, 1],:3]
    copy_selection = copy_selection.astype(np.float32) / 255.0

    U,S,V = svd(copy_selection)
    log_S = np.log(S)
    x,y,z = S

    phi = np.mod(np.arctan2(y, x), 2 * np.pi) 
    theta = np.mod(np.arctan2(np.sqrt(x**2 + y**2), z), 2 * np.pi)
    
    copy_coord, paste_coord = ua_cloning()
    
    
    image[copy_region[:, 0], copy_region[:, 1]] = (reconstructed * 255).astype(np.uint8)

    return image
