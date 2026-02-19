import numpy as np
import time  # Added proper import for sleep functionality
import importlib.util

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)

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
    assert image.shape[-1] == 4, "Image must be RGBA format"

    width = image.shape[1]
    height = image.shape[0]

    # All the requirements that were requested are also available
    radius = params["user_input"]["Radius"]
    assert radius > 0, "Radius must be greater than 0"

    assert params["user_input"]["Color"].shape[0] == 3, "Color must be RGB format"
    assert params["user_input"]["Alpha"] >= 0 and params["user_input"]["Alpha"] <= 1, "Alpha must be between 0 and 1"
    
    path = params["stroke_input"]["path"]

    blur = params["user_input"]["Blur Edges"]

    alpha = params["user_input"]["Alpha"]

    #We can also use some helpful functions from utils
    region, distance = utils.points_within_radius(path, radius, border = (height, width), return_distance=True)

    patch = image[region[:, 0], region[:, 1]].astype(np.float32) / 255
    patch[...,:3] = params["user_input"]["Color"] / 255 # Set RGB channels
    patch[...,3] = alpha 

    image[region[:, 0], region[:, 1]] = utils.apply_patch_to_image(image[region[:, 0], region[:, 1]], patch, blur=blur, distance=distance)

    return image
