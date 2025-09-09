#Add any dependencies but don't forget to list them in the requirements if they need to be pip installed
import numpy as np

from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

import importlib.util

spec = importlib.util.spec_from_file_location("utils", "effect/utils.py")
utils = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils)


# The only thing that you need to change is this function
def run(params):
    """
    Executes the effect pipeline based on the provided parameters.

    Args:
        parameters (dict): A dictionary containing all the relevant data.

    Returns:
        Image: the new numpy array of RGBA values or None if the effect failed
    """
    
    # Extract the image that we are going to work from
    image = params["stroke_input"]["image_rgba"]
    # It's a good practice to check any of the request variables
    assert image.shape[-1] == 4, "Image must be RGBA format"
    # Get the shape of the imahe
    height = image.shape[0]
    width = image.shape[1]

    # Extract the path chosen
    path = params["stroke_input"]["path"]

    # Extract whatever other parameters have been defined for the brush
    ex_param = params["user_input"]["Example parameter"]

        
    return image
