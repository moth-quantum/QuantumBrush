import numpy as np
from qiskit import generate_preset_pass_manager
from qiskit.primitives import BackendEstimatorV2 as Estimator
import os
from qiskit_aer import AerSimulator
import colorsys 
from itertools import product
import matplotlib.pyplot as plt
from matplotlib.path import Path as plt_path
from scipy.ndimage import distance_transform_edt

def svd(matrix=None,U=None,S=None,Vt=None):
    if U is not None:
        S_matrix = np.diag(S)  # Convert singular values into a diagonal matrix
        mat = U @ S_matrix @ Vt
        return mat

    """Compute the Ordered Singular Value Decomposition (SVD) of a matrix."""
    U, S, Vt = np.linalg.svd(matrix, full_matrices=False)
    sorted_indices = np.argsort(S)[::-1]  # Sort singular values in descending order
    return U[:, sorted_indices], S[sorted_indices], Vt[sorted_indices, :]


def color_to_spherical(color):
    """
    Convert an RGB color to spherical angles (phi, theta).
    Args:
        color (tuple): A tuple of (R, G, B) values in the range [0, 255].
    Returns:
        tuple: A tuple of (phi, theta) angles in radians.
    """

    rgb = np.array(color, dtype=np.float32) / 255.0
    hue, lightness, saturation = rgb_to_hls(rgb)
    
    phi = 2 * np.pi * hue #phi: computes the circular mean of hue, scaled from [0,1] to [0, 2π].
    theta = np.pi * lightness #theta: computes the linear mean of lightness (L channel), scaled from [0,1] to [0, π].

    return phi, theta, saturation


def points_within_radius_old(points, radius, border = None):
    """
    Given a set of points and a radius, return all points within the radius.
    Args:
        points (np.ndarray): Array of shape (N, 2) where N is the number of points.
        radius (int): The radius to search within.
        border (tuple): A tuple of (height, width)
    Returns:
        np.ndarray: Array of points within the radius.
    """
    if len(points.shape) == 1:
        points = np.array([points])

    assert radius > 0, "Radius must be positive"
    assert isinstance(points, np.ndarray), "Points must be a numpy array"

    # Precompute offsets within the radius
    y, x = np.ogrid[-radius:radius+1, -radius:radius+1]
    mask = x**2 + y**2 <= radius**2
    offsets = np.stack(np.nonzero(mask), axis=-1) - radius
    # Broadcast add offsets to all points
    all_points = points[:, None, :] + offsets[None, :, :]
    # Reshape and get unique points
    result = np.unique(all_points.reshape(-1, 2), axis=0)

    if border is not None:
        result = np.clip(result, [0, 0], [border[0] - 1, border[1] - 1])

    return result



def points_within_radius(points, radius=10, border = None, return_distance = False):
    """
    Given a dense list of 1-pixel-apart (x, y) points forming a line,
    returns all pixel coordinates within `offset` pixels of the line.
    """
    points = np.array(points, dtype=int)
    #print("initial points ", points)
    # Compute canvas bounds
    min_yx = points.min(axis=0) - radius - 1
    max_yx = points.max(axis=0) + radius + 1
    height, width = (max_yx - min_yx + 1)

    # Shift line to start at (0, 0)
    shifted = points - min_yx
    #print("shifted points ", shifted[:10])
    # Create binary mask
    mask = np.zeros((height, width), dtype=bool)
    mask[shifted[:, 0], shifted[:, 1]] = True  # y, x
    
    # Distance transform
    dist = distance_transform_edt(~mask)
    # Find pixels within offset
    region_mask = dist <= radius
    ys, xs = np.nonzero(region_mask)

    # Shift back to original coordinates
    coords = np.stack([ys, xs], axis=1) + min_yx
    #print(coords)
    if border is not None:
        coords = np.clip(coords, [0, 0], [border[0] - 1, border[1] - 1])

    if return_distance:
        distances = dist[ys, xs] / radius
        return coords, distances

    return coords

def points_within_lasso(points,border = None):
    min_x = np.min(points[:,1])
    max_x = np.max(points[:,1])+1
    min_y = np.min(points[:,0])
    max_y = np.max(points[:,0])+1

    grid = list(product(np.arange(min_y,max_y), np.arange(min_x,max_x)))
    # Create path from polygon
    path = plt_path(points)
    # Test which points are inside the path
    mask = path.contains_points(grid)

    # Get the pixel coordinates that are inside
    result = np.array(grid)[mask]

    if border is not None:
        result = np.clip(result, [0, 0], [border[0] - 1, border[1] - 1])

    return result

def split_path_from_clicks(path,clicks):
    split_paths = []
    # Split path into subpaths, each starting with a click
    click_indices = []
    c = 0
    for i, p in enumerate(path):
        if np.all(p == clicks[c]):
            click_indices.append(i)
            c += 1
            if c >= len(clicks):
                break

    for idx, start in enumerate(click_indices):
        end = click_indices[idx + 1] if idx + 1 < len(click_indices) else len(path)
        interp_path = interpolate_pixels(path[start:end])
        split_paths.append(interp_path)
    
    return split_paths

def run_estimator(circuits, operators, backend=None, options = None):
    '''Runs the estimator on the provided circuits and operators.
    It can receive a single circuit or a list of circuits.
    It can receive a single operator or a list of operators or a list of list of operators (one for each circuit).
    '''
    
    #iqm_server_url = "https://cocos.resonance.meetiqm.com/garnet:mock"  # Replace this with the correct URL
    #provider = IQMProvider(iqm_server_url)
    #backend = provider.get_backend('garnet')
    #sampler = BackendSamplerV2(backend, options={"default_shots": 1000})
    if backend is None:
        backend = AerSimulator()

    estimator = Estimator(backend=backend, options=options)

    pm = generate_preset_pass_manager(backend=backend, optimization_level=2)

    if isinstance(circuits, list):
        isa_circuits = [pm.run(circuit) for circuit in circuits]
    else:
        isa_circuits = [pm.run(circuits)]

    n_circuits = len(isa_circuits)

    if isinstance(operators,list):
        if isinstance(operators[0], list):
            assert len(operators) == n_circuits, "Number of circuits and operators must match"
            isa_observables = [[op.apply_layout(isa_circuits[i].layout) for op in ops] for i,ops in enumerate(operators)]
        else:
            isa_observables = [[op.apply_layout(isa_circuits[0].layout) for op in operators]] * n_circuits
    else:
        isa_observables = [[operators.apply_layout(isa_circuits[0].layout)]] * n_circuits

    isa_inputs = list(zip(isa_circuits, isa_observables))
    job = estimator.run(isa_inputs)

    pub_result = job.result()
    obs = [pub_result[i].data.evs for i in range(n_circuits)]

    if n_circuits == 1:
        return obs[0]
    
    return obs

def bresenham_line(x1, y1, x2, y2):
    points = []

    dx = abs(x2 - x1)
    dy = abs(y2 - y1)

    sx = 1 if x2 > x1 else -1
    sy = 1 if y2 > y1 else -1

    if dx > dy:
        err = dx / 2.0
        while x1 != x2:
            points.append([x1, y1])
            err -= dy
            if err < 0:
                y1 += sy
                err += dx
            x1 += sx
    else:
        err = dy / 2.0
        while y1 != y2:
            points.append([x1, y1])
            err -= dx
            if err < 0:
                x1 += sx
                err += dy
            y1 += sy

    points.append([x2, y2])  # Add the last point
    return points


def interpolate_pixels(pixel_list, numpy = True):
    if len(pixel_list) == 0:
        if numpy:
            return np.array([])
        return []

    interpolated_pixels = [[pixel_list[0][0], pixel_list[0][1]]]
    # Remove consecutive duplicate pixels
    last = pixel_list[0]
    for px in pixel_list[1:]:
        if np.any(px != last):
            new_px = bresenham_line(*last,*px)
            interpolated_pixels.extend(new_px[1:])
            last = px
    if numpy:
        return np.array(interpolated_pixels)
    else:
        return interpolated_pixels


def square_region(click, radius):
    horizontal = np.arange(click[1] - radius, click[1] + radius + 1,dtype=int)
    vertical = np.arange(click[0] - radius, click[0] + radius + 1,dtype=int)
    mesh_x, mesh_y = np.meshgrid(horizontal, vertical)
    points = np.stack((mesh_y.flatten(), mesh_x.flatten()), axis=-1)
    return points

def convert_rgb_to_hls(r, g, b):
    """Overwrites colorsys.rgb_to_hls to handle greyscale"""
    
    maxc = max(r, g, b)
    minc = min(r, g, b)
    sumc = (maxc+minc)
    rangec = (maxc-minc)
    l = sumc/2.0
    if minc == maxc:
        return 0.0, l, 1.0
    if l <= 0.5:
        s = rangec / sumc
    else:
        s = rangec / (2.0-maxc-minc)  # Not always 2.0-sumc: gh-106498.
    rc = (maxc-r) / rangec
    gc = (maxc-g) / rangec
    bc = (maxc-b) / rangec
    if r == maxc:
        h = bc-gc
    elif g == maxc:
        h = 2.0+rc-bc
    else:
        h = 4.0+gc-rc
    h = (h/6.0) % 1.0
    return h, l, s

def rgb_to_hls(rgba: np.ndarray):
    """
    Convert an RGB array to HLS format.
    If the input is RGBA, the alpha channel is preserved.
    Args:
        rgba (np.ndarray): Input array of shape (N, 4) or (N, 3).
    Returns:
        np.ndarray: Converted array in HLS format.
    """

    if rgba.shape[-1] == 4:
        rgb = rgba[..., :3]

        if len(rgb.shape) == 1:
            hls = convert_rgb_to_hls(*rgb)
            hls.append(rgba[3])

        else:
            hls = np.apply_along_axis(lambda x: convert_rgb_to_hls(*x), -1, rgb)
            hls = np.concatenate([hls, rgba[..., 3][..., np.newaxis]], axis=-1)
    
    else:
        rgb = rgba

        if len(rgb.shape) == 1:
            hls = convert_rgb_to_hls(*rgb)

        else:
            hls = np.apply_along_axis(lambda x: convert_rgb_to_hls(*x), -1, rgb)

    return hls
    
def hls_to_rgb(hlsa: np.ndarray):

    if hlsa.shape[-1] == 4:
        hls = hlsa[..., :3]

        if len(hls.shape) == 1:
            rgb = colorsys.hls_to_rgb(*hls)
            rgb.append(hlsa[3])

        else:
            rgb = np.apply_along_axis(lambda x: colorsys.hls_to_rgb(*x), -1, hls)
            rgb = np.concatenate([rgb, hlsa[..., 3][..., np.newaxis]], axis=-1)
    
    else:
        hls = hlsa

        if len(hls.shape) == 1:
            rgb = colorsys.hls_to_rgb(*hls)

        else:
            rgb = np.apply_along_axis(lambda x: colorsys.hls_to_rgb(*x), -1, hls)

    return rgb

def apply_patch_to_image(original_image: np.ndarray, new_patch: np.ndarray, blur= False, distance = None):
    assert original_image.shape == new_patch.shape, "Original image and patch must have the same shape"
    assert original_image.dtype == np.uint8, "Original image must be uint8"

    original_float = original_image.astype(np.float32) / 255

    if new_patch.dtype == np.uint8:
        new_patch = new_patch.astype(np.float32) / 255

    alpha = original_float[...,3]
    if blur:
        assert distance is not None, "Distance must be provided if blur is enabled"
        assert distance.shape[0] == new_patch.shape[0], "Distance must have the same shape as the patch, patch shape: "+str(new_patch.shape)+", distance shape: "+str(distance.shape)
        alpha *= (1-np.exp(-np.abs((distance-1)/0.5)**4))

    alpha = alpha[:,None]

    new_patch[..., :3] = (1 - alpha) * original_float[..., :3] + alpha * new_patch[..., :3]

    return (new_patch * 255).astype(np.uint8)
    