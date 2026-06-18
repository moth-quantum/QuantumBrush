from copy import copy
import json
import importlib
import importlib.util
from pathlib import Path
import traceback
import numpy as np
from PIL import Image
import numpy as np
import sys
import argparse
import os
import time
import base64
import io
from utils import *
import contextlib
if getattr(sys, 'frozen', False):
    app_path = Path(sys.executable).parent.parent
else:
    app_path = Path(sys.path[0] + "/..")

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
            if isinstance(variable, str) and variable.startswith("#") and len(variable) in {7, 9}:
                hex_color = variable.lstrip("#")
                if len(hex_color) == 6:  # RGB
                    return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4)])
                elif len(hex_color) == 8:  # RGBA
                    return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6)])
                
            raise ValueError("Invalid color format")
        case _:
            raise ValueError(f"Unsupported type: {var_type}")


def process_effect(instr: dict):
    stroke_id = instr.get("stroke_id", False)
    project_id = instr.get("project_id", False)

    if not stroke_id or not project_id:
        raise ValueError("stroke_id and project_id must be provided in the instructions.")
    
    project_path = app_path / f"project/{project_id}"
  
    effect_id = instr.get("effect_id")

    effect_path = app_path / f"effect/{effect_id}"
    req_path = effect_path / f"{effect_id}_requirements.json"

    with open(req_path, 'r') as req_file:
        req = json.load(req_file)

    for dependency, version in req.get("dependencies", {}).items():
        try:
            module = importlib.import_module(dependency)
                
        except ImportError as e:
            raise ImportError(f"Failed to load dependency {dependency}: {e}")

    # process image
    if "image_b64" in instr:
        print("[apply_effect] Using in-memory base64 image transport (no PNG read).")
        raw_bytes = base64.b64decode(instr["image_b64"])
        with Image.open(io.BytesIO(raw_bytes)) as img:
            req["stroke_input"]["image_rgba"] = np.array(img.convert("RGBA"))
    else:
        # read from {stroke_id}_input.png on disk
        image_path = project_path / f"stroke/{stroke_id}_input.png"
        if not image_path.is_file():
            raise FileNotFoundError(f"Image file not found at {image_path}")
        print(f"[apply_effect] Reading image from disk (legacy): {image_path}")
        with Image.open(image_path) as img:
            req["stroke_input"]["image_rgba"] = np.array(img.convert("RGBA"))

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

        if ( key == "clicks" or key == "path" ):
            req["stroke_input"][key] = req["stroke_input"][key][..., ::-1]

    if req["flags"].get("smooth_path", False):
        req["stroke_input"]["path"] = interpolate_pixels(req["stroke_input"]["path"], numpy=True)

    if req["flags"].get("use_hls", False):
        req["stroke_input"]["path"] = interpolate_pixels(req["stroke_input"]["path"], numpy=True)

    # Add a few flags
    req["effect_id"] = effect_id
    req["effect_script_path"] = effect_path / f"{effect_id}.py"
    req["stroke_output_path"] = project_path / f"stroke/{stroke_id}_output.png"

    return req

def apply_effect(req: dict, instructions: dict = None, instr_path: str = None):
    """
    Execute the brush effect and return the result.

    In-memory transport (Issue #47):
    When `instructions` and `instr_path` are provided, the result image is
    base64-encoded and written back into the JSON instruction file as
    `result_b64`, avoiding writing `_output.png` to disk entirely.

    Legacy mode (backward compat):
    When called without `instructions` / `instr_path`, the result is saved
    to `req["stroke_output_path"]` as a PNG file.
    """

    input_image = copy(req["stroke_input"]["image_rgba"])

    spec = importlib.util.spec_from_file_location(req["effect_id"], req["effect_script_path"])
    effect_module = importlib.util.module_from_spec(spec)
    sys.modules[req["effect_id"]] = effect_module
    spec.loader.exec_module(effect_module)

    new_image = effect_module.run(req)

    mask = np.all(new_image == input_image, axis=-1)
    new_image[mask] = [0, 0, 0, 0]

    # output strategy
    use_in_memory = (instructions is not None) and (instr_path is not None)

    if use_in_memory:
        print("[apply_effect] Encoding result as base64 (in-memory transport).")
        buf = io.BytesIO()
        Image.fromarray(new_image.astype(np.uint8)).save(buf, format="PNG")
        instructions["result_b64"] = base64.b64encode(buf.getvalue()).decode("utf-8")
        dump_json(instructions, instr_path)
        print("[apply_effect] result_b64 written to instruction JSON. No PNG written.")
    else:
        output_path = req["stroke_output_path"]
        output_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(new_image.astype(np.uint8)).save(output_path, format="PNG")
        print(f"[apply_effect] Wrote output PNG to {output_path} (legacy mode).")

    return True

def record_error(error):
    log_file = app_path / "log/error.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)  # Ensure log directory exists

    error_message = traceback.format_exc()
    
    with open(log_file, "a") as log:
        log.write(error_message)

    print(error_message)    

def dump_json(data, file_path):
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)
    
    temp_path = f"{file_path}.tmp"
    try:
        with open(temp_path, "w") as f:
            json.dump(data, f)
        
        if os.path.exists(file_path):
            os.remove(file_path)
        os.rename(temp_path, file_path)
    except Exception as e:
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
    
    log_output_file = app_path / "log/console_output.log"
    log_output_file.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(log_output_file, "a")

    sys.stdout = Tee(sys.stdout, log_fh)
    sys.stderr = Tee(sys.stderr, log_fh)
    
    parser = argparse.ArgumentParser(description="Apply an effect to a stroke in a project.")
    parser.add_argument("stroke_path", type=str, help="The ID of the stroke.")
    args = parser.parse_args()

    success = False
    instructions = {}

    try:
        if not Path(args.stroke_path).is_file():
            raise FileNotFoundError(f"Stroke file not found at {args.stroke_path}")

        with open(args.stroke_path, 'r') as stroke_file:
            instructions = json.load(stroke_file)

        instructions["effect_received"] = True
        dump_json(instructions, args.stroke_path)

        try:
            data = process_effect(instructions)

            instructions["effect_processed"] = True
            dump_json(instructions, args.stroke_path)

            in_memory = "image_b64" in instructions

            if in_memory:
                success = apply_effect(data, instructions=instructions, instr_path=args.stroke_path)
            else:
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
        # redirect to log

    
    if success:
        print("Effect applied successfully.")
        sys.exit(0)
    else:
        print("Failed to apply effect.")
        sys.exit(1)
