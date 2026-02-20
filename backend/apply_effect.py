import sys
from pathlib import Path
from copy import copy
import json
import importlib
import importlib.util
import traceback
import numpy as np
from PIL import Image
import argparse
import os
import time
from backend.utils import *
import tempfile
import contextlib

def process_variable(var_type: str, variable: any):
    match var_type:
        case "str":
            return str(variable)
        case "float":
            return float(variable)
        case "int":
            return int(variable)
        case "bool":
            return bool(variable)
        case "array":
            if isinstance(variable, np.ndarray):
                return variable
            elif isinstance(variable, list):
                try:
                    return np.array(variable)
                except Exception as e:
                    raise ValueError(f"Error converting to numpy array: {e}")
            else:
                raise ValueError("Invalid array format")
        case "color":
            # Assuming color is represented as a hex string
            if isinstance(variable, str) and variable.startswith("#") and len(variable) in {7, 9}:
            # Convert hex to RGB(A) numpy array
                hex_color = variable.lstrip("#")
                if len(hex_color) == 6:  # RGB
                    return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4)])
                elif len(hex_color) == 8:  # RGBA
                    return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6)])
                
            raise ValueError("Invalid color format")
        case _:
            raise ValueError(f"Unsupported type: {var_type}")


from backend.effects.registry import EFFECT_REGISTRY

def process_effect(instr: dict):
    # Extract stroke_id and project_id from instructions
    stroke_id = instr.get("stroke_id", False)
    project_id = instr.get("project_id", False)

    if not stroke_id or not project_id:
        raise ValueError("stroke_id and project_id must be provided in the instructions.")
    
    # Get effect_id and look it up in the registry
    effect_id = instr.get("effect_id")
    if effect_id not in EFFECT_REGISTRY:
        raise ValueError(f"Effect '{effect_id}' not found in registry.")
    
    # Deep copy the config to avoid mutating global registry state
    req = copy(EFFECT_REGISTRY[effect_id]["config"])

    # Process image
    if "image_b64" in instr.get("stroke_input", {}):
        import base64, io
        img_data = base64.b64decode(instr["stroke_input"]["image_b64"])
        with Image.open(io.BytesIO(img_data)) as img:
            req["stroke_input"]["image_rgba"] = np.array(img.convert("RGBA"))
    else:
        # Fallback to system temp folder
        image_path = Path(tempfile.gettempdir()) / f"{stroke_id}_input.png"
        if not image_path.is_file():
            raise FileNotFoundError(f"Image file not found at {image_path}")
        with Image.open(image_path) as img:
            req["stroke_input"]["image_rgba"] = np.array(img.convert("RGBA"))

    # Process user_input and stroke_input
    for key in req["user_input"]:
        if key not in instr["user_input"]:
            raise KeyError(f"Key '{key}' not found in user_input field of stroke instructions.")
        
        req["user_input"][key] = process_variable(req["user_input"][key]["type"], instr["user_input"][key])

    for key in req["stroke_input"]:
        if key == "image_rgba":
            continue

        if key not in instr["stroke_input"]:
            raise KeyError(f"Key '{key}' not found in stroke_input of stroke instructions.")
        
        req["stroke_input"][key] = process_variable(req["stroke_input"][key], instr["stroke_input"][key])

        if key == "clicks" or key == "path":
            req["stroke_input"][key] = req["stroke_input"][key][..., ::-1]

    # Process any other flags
    if req.get("flags", {}).get("smooth_path", False):
        req["stroke_input"]["path"] = interpolate_pixels(req["stroke_input"]["path"], numpy=True)

    if req.get("flags", {}).get("use_hls", False):
        req["stroke_input"]["path"] = interpolate_pixels(req["stroke_input"]["path"], numpy=True)

    # Add execution metadata
    req["effect_id"] = effect_id
    req["stroke_output_path"] = Path(tempfile.gettempdir()) / f"{stroke_id}_output.png"

    return req

def apply_effect(req: dict):
    # Save the input image to apply mask
    input_image = copy(req["stroke_input"]["image_rgba"])

    # Execute the effect using the registry module
    effect_id = req["effect_id"]
    effect_module = EFFECT_REGISTRY[effect_id]["module"]

    new_image = effect_module.run(req)

    # Merge the new image with the original image
    mask = np.all(new_image == input_image, axis=-1)  
    new_image[mask] = [0, 0, 0, 0]  # Set differing pixels to [0, 0, 0, 0]
    
    output_path = Path(req["stroke_output_path"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(new_image.astype(np.uint8)).save(output_path, format="PNG")

    return True

    return True

def record_error(error):
    log_file = Path(tempfile.gettempdir()) / "quantum_brush_error.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    error_message = traceback.format_exc()
    
    with open(log_file, "a") as log:
        log.write(error_message)

    print(error_message)    

def dump_json(data, file_path):
    # Make sure the directory exists
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Use a safer approach for atomic file operations
    temp_path = f"{file_path}.tmp"
    try:
        with open(temp_path, "w") as f:
            json.dump(data, f)
        
        # On Windows, os.replace might fail if the destination exists
        if os.path.exists(file_path):
            os.remove(file_path)
        os.rename(temp_path, file_path)
    except Exception as e:
        # If atomic operation fails, try direct write as fallback
        print(f"Warning: Atomic write failed ({str(e)}), using direct write")
        with open(file_path, "w") as f:
            json.dump(data, f)

class Tee:
    def __init__(self, *files):
        self.files = files
    def write(self, obj):
        for f in self.files:
            f.write(obj)
            f.flush()
    def flush(self):
        for f in self.files:
            f.flush()


if __name__ == "__main__":
    # Standard entry point for standalone execution
    parser = argparse.ArgumentParser(description="Apply an effect to a stroke in a project.")
    parser.add_argument("stroke_path", type=str, help="The ID of the stroke.")
    args = parser.parse_args()

    log_output_file = Path(tempfile.gettempdir()) / "quantum_brush_console.log"
    log_output_file.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(log_output_file, "a")

    sys.stdout = Tee(sys.stdout, log_fh)
    sys.stderr = Tee(sys.stderr, log_fh)
    
    success = False
    instructions = {}

    try:
        if not Path(args.stroke_path).is_file():
            raise FileNotFoundError(f"Stroke file not found at {args.stroke_path}")

        # Read the stroke instructions from the provided path
        with open(args.stroke_path, 'r') as stroke_file:
            instructions = json.load(stroke_file)

        instructions["effect_received"] = True
        dump_json(instructions, args.stroke_path)

        try:
            # Process the effect
            data = process_effect(instructions)

            instructions["effect_processed"] = True
            dump_json(instructions, args.stroke_path)

            # Apply the effect
            success = apply_effect(data)

            instructions["effect_success"] = success
            dump_json(instructions, args.stroke_path)

        except Exception as e:
            record_error(e)
            instructions["effect_success"] = False
            dump_json(instructions, args.stroke_path)
            success = False

    except FileNotFoundError as e:
        record_error(e)
        if instructions:
            instructions["effect_received"] = False
            dump_json(instructions, args.stroke_path)
        success = False
    except Exception as e:
        record_error(e)
        if instructions:
            instructions["effect_success"] = False
            dump_json(instructions, args.stroke_path)
        success = False

    if success:
        print("Effect applied successfully.")
        sys.exit(0)
    else:
        print("Failed to apply effect.")
        sys.exit(1)
