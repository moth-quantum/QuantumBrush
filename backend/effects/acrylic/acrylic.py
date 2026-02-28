import numpy as np
import time  # Added proper import for sleep functionality
from backend import utils

def run(params):
    """
    Executes the effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values representing the transparent layer
    """
    
    # Extract image to work from
    image = params["stroke_input"]["image_rgba"]
    assert image.shape[-1] == 4, "Image must be RGBA format"

    width = image.shape[1]
    height = image.shape[0]

    # Create the transparent layer we will draw onto
    new_layer = np.zeros_like(image, dtype=np.uint8)

    # All the requirements that were requested are also available
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    assert params["user_input"]["Color"].shape[0] == 3, "Color must be RGB format"
    assert params["user_input"]["Alpha"] >= 0 and params["user_input"]["Alpha"] <= 1, "Alpha must be between 0 and 1"
    path = params["stroke_input"]["path"]
    clicks = params["stroke_input"]["clicks"]
    
    # Optional path smoothing interpolation, now safely explicitly handled by the effect 
    if params.get("flags", {}).get("smooth_path", True):
        split_paths = utils.split_path_from_clicks(path, clicks)
        path = np.vstack(split_paths) if split_paths else np.array([])

    blur = params["user_input"]["Blur Edges"]
    alpha = params["user_input"]["Alpha"]

    # Start of Validated Algorithm
    # We can also use some helpful functions from utils
    region, distance = utils.points_within_radius(path, radius, border=(height, width), return_distance=True)

    if len(region) > 0:
        patch = image[region[:, 0], region[:, 1]].astype(np.float32) / 255.0
        patch[..., :3] = params["user_input"]["Color"] / 255.0 # Set RGB channels
        patch[..., 3] = alpha 

        # Apply the blurred edge patch onto the transparent new_layer instead of the original image
        new_layer[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], patch, blur=blur, distance=distance)
    # End of Validated Algorithm

    return new_layer
