#!/usr/bin/env python3
"""Dev API for browser mode when Tauri cannot build (e.g. old glib on Linux).

Run from repo: python modern/dev-api/server.py
Frontend proxies /api and /media to http://127.0.0.1:8787
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def find_app_root() -> Path:
    env = os.environ.get("QUANTUMBRUSH_ROOT")
    if env:
        p = Path(env)
        if (p / "effect" / "apply_effect.py").is_file():
            return p.resolve()

    here = Path(__file__).resolve().parent
    for candidate in [here.parent.parent, here.parent, Path.cwd(), Path.cwd().parent]:
        if (candidate / "effect" / "apply_effect.py").is_file():
            return candidate.resolve()

    return (here.parent.parent).resolve()


ROOT = find_app_root()


def resolve_python() -> Path:
    for rel in [".venv/bin/python", "modern/.venv/bin/python"]:
        p = ROOT / rel
        if p.is_file():
            return p
    return Path(sys.executable)


PYTHON = resolve_python()
METADATA = ROOT / "metadata"
PROJECTS = ROOT / "project"


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    ensure_dir(path.parent)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    tmp.replace(path)


def media_url(rel: str) -> str:
    return "/media/" + rel.replace("\\", "/")


def list_effects() -> list:
    effects = []
    effect_dir = ROOT / "effect"
    if not effect_dir.is_dir():
        return effects
    for folder in effect_dir.iterdir():
        if not folder.is_dir():
            continue
        for req in folder.glob("*_requirements.json"):
            data = read_json(req)
            effects.append(
                {
                    "id": data.get("id", folder.name),
                    "name": data.get("name", folder.name),
                    "description": data.get("description", ""),
                    "user_input": data.get("user_input", {}),
                }
            )
    effects.sort(key=lambda e: e["name"])
    return effects


def list_projects() -> list:
    ensure_dir(METADATA)
    projects = []
    for meta_file in METADATA.glob("*.json"):
        try:
            meta = read_json(meta_file)
            pid = meta.get("project_id", "")
            pdir = PROJECTS / pid
            status = "normal" if pdir.is_dir() else "missing_project_dir"
            projects.append(
                {
                    "project_id": pid,
                    "project_name": meta.get("project_name", "Untitled"),
                    "modified_time": meta.get("modified_time", 0),
                    "status": status,
                }
            )
        except Exception:
            continue
    projects.sort(key=lambda p: p["modified_time"], reverse=True)
    return projects


def create_project(project_name: str, image_bytes: bytes) -> dict:
    project_id = f"project_{int(time.time() * 1000)}"
    project_dir = PROJECTS / project_id
    ensure_dir(project_dir)
    original = project_dir / "original.png"
    current = project_dir / "current.png"
    original.write_bytes(image_bytes)
    current.write_bytes(image_bytes)
    now = int(time.time() * 1000)
    write_json(
        METADATA / f"{project_id}.json",
        {
            "project_name": project_name,
            "project_id": project_id,
            "created_time": now,
            "modified_time": now,
        },
    )
    rel = f"project/{project_id}/current.png"
    return {
        "project_id": project_id,
        "project_name": project_name,
        "image_path": media_url(rel),
    }


def open_project(project_id: str) -> dict:
    project_dir = PROJECTS / project_id
    if not project_dir.is_dir():
        raise FileNotFoundError("Project not found")
    current = project_dir / "current.png"
    original = project_dir / "original.png"
    img = current if current.is_file() else original
    if not img.is_file():
        raise FileNotFoundError("No image in project")
    meta_path = METADATA / f"{project_id}.json"
    if meta_path.is_file():
        meta = read_json(meta_path)
        meta["modified_time"] = int(time.time() * 1000)
        write_json(meta_path, meta)
    rel = f"project/{project_id}/{img.name}"
    return {"project_id": project_id, "image_path": media_url(rel)}


def delete_project(project_id: str) -> None:
    pdir = PROJECTS / project_id
    if pdir.is_dir():
        shutil.rmtree(pdir)
    meta = METADATA / f"{project_id}.json"
    if meta.is_file():
        meta.unlink()


def save_project_image(project_id: str, png_base64: str) -> str:
    raw = png_base64.split(",")[-1]
    data = base64.b64decode(raw)
    path = PROJECTS / project_id / "current.png"
    ensure_dir(path.parent)
    path.write_bytes(data)
    meta_path = METADATA / f"{project_id}.json"
    if meta_path.is_file():
        meta = read_json(meta_path)
        meta["modified_time"] = int(time.time() * 1000)
        write_json(meta_path, meta)
    return media_url(f"project/{project_id}/current.png")


def create_stroke(args: dict) -> str:
    project_id = args["project_id"]
    effect_id = args["effect_id"]
    parameters = args["parameters"]
    paths = args["paths"]

    stroke_id = f"stroke_{int(time.time() * 1000)}"
    project_dir = PROJECTS / project_id
    stroke_dir = project_dir / "stroke"
    ensure_dir(stroke_dir)

    path_array = []
    clicks_array = []
    for p in paths:
        click = p["click"]
        clicks_array.append([round(click["x"]), round(click["y"])])
        for pt in p["points"]:
            path_array.append([round(pt["x"]), round(pt["y"])])

    input_path = stroke_dir / f"{stroke_id}_input.png"
    output_path = stroke_dir / f"{stroke_id}_output.png"
    instructions = {
        "stroke_id": stroke_id,
        "project_id": project_id,
        "effect_id": effect_id,
        "user_input": parameters,
        "stroke_input": {
            "real_hardware": False,
            "path": path_array,
            "clicks": clicks_array,
            "input_location": str(input_path),
            "output_location": str(output_path),
        },
        "hardware": {
            "provider": "aer",
            "device": "garnet",
            "shots": 1024,
            "optimization_level": 2,
            "max_qpu_seconds": 30.0,
        },
        "created": True,
        "effect_received": "null",
        "effect_processed": "null",
        "effect_success": "null",
        "processing_status": "pending",
    }
    instr_path = stroke_dir / f"{stroke_id}_instructions.json"
    write_json(instr_path, instructions)

    current = project_dir / "current.png"
    if not current.is_file():
        raise FileNotFoundError("No current image")
    shutil.copy(current, input_path)
    return stroke_id


def list_strokes(project_id: str) -> list:
    stroke_dir = PROJECTS / project_id / "stroke"
    if not stroke_dir.is_dir():
        return []
    effect_map = {e["id"]: e["name"] for e in list_effects()}
    strokes = []
    for instr_file in stroke_dir.glob("*_instructions.json"):
        stroke_id = instr_file.name.replace("_instructions.json", "")
        instr = read_json(instr_file)
        effect_id = instr.get("effect_id", "")
        status = instr.get("processing_status", "unknown")
        es = instr.get("effect_success")
        effect_success = None
        if isinstance(es, bool):
            effect_success = es
        elif es == "true":
            effect_success = True
        elif es == "false":
            effect_success = False
        error_message = instr.get("error_message")
        clicks = instr.get("stroke_input", {}).get("clicks", [])
        if (
            not error_message
            and status == "failed"
            and effect_id == "clone"
            and len(clicks) != 2
        ):
            error_message = (
                "Collage needs exactly 2 strokes (copy drag + paste click). "
                f"You sent {len(clicks)}."
            )
        strokes.append(
            {
                "stroke_id": stroke_id,
                "effect_id": effect_id,
                "effect_name": effect_map.get(effect_id, effect_id),
                "processing_status": status,
                "effect_success": effect_success,
                "error_message": error_message,
                "input_path": media_url(
                    f"project/{project_id}/stroke/{stroke_id}_input.png"
                ),
                "output_path": media_url(
                    f"project/{project_id}/stroke/{stroke_id}_output.png"
                ),
            }
        )
    strokes.sort(key=lambda s: s["stroke_id"])
    return strokes


def run_stroke(project_id: str, stroke_id: str) -> dict:
    instr_path = (
        PROJECTS / project_id / "stroke" / f"{stroke_id}_instructions.json"
    )
    if not instr_path.is_file():
        raise FileNotFoundError("Stroke not found")

    instr = read_json(instr_path)
    instr["processing_status"] = "running"
    write_json(instr_path, instr)

    apply_script = ROOT / "effect" / "apply_effect.py"
    log_dir = ROOT / "log"
    ensure_dir(log_dir)
    stderr_log = log_dir / "python_stderr.log"

    env = os.environ.copy()
    proc = subprocess.run(
        [str(PYTHON), str(apply_script), str(instr_path)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        env=env,
    )

    with open(stderr_log, "a", encoding="utf-8") as f:
        f.write(f"--- stroke {stroke_id} ---\n")
        f.write(proc.stderr or "")

    instr_after = read_json(instr_path)
    success = proc.returncode == 0 and instr_after.get("effect_success") in (
        True,
        "true",
    )
    output_file = PROJECTS / project_id / "stroke" / f"{stroke_id}_output.png"

    if success and output_file.is_file():
        instr_after["processing_status"] = "completed"
        instr_after["effect_success"] = "true"
        instr_after.pop("error_message", None)
    elif instr_after.get("processing_status") != "completed":
        instr_after["processing_status"] = "failed"
        instr_after["effect_success"] = "false"
        if not instr_after.get("error_message") and proc.stderr and proc.stderr.strip():
            instr_after["error_message"] = proc.stderr.strip().splitlines()[-1]
    write_json(instr_path, instr_after)

    return {
        "success": success and output_file.is_file(),
        "exit_code": proc.returncode,
        "processing_status": instr_after.get("processing_status", "unknown"),
        "stdout": proc.stdout or "",
        "stderr": proc.stderr or "",
    }


def delete_stroke(project_id: str, stroke_id: str) -> None:
    stroke_dir = PROJECTS / project_id / "stroke"
    for suffix in ("_instructions.json", "_input.png", "_output.png"):
        p = stroke_dir / f"{stroke_id}{suffix}"
        if p.is_file():
            p.unlink()


def handle_invoke(command: str, args: dict) -> object:
    if command == "get_app_info":
        return {
            "root": str(ROOT),
            "python": str(PYTHON),
            "root_exists": (ROOT / "effect" / "apply_effect.py").is_file(),
            "mode": "web-dev-api",
        }
    if command == "list_effects":
        return list_effects()
    if command == "list_projects":
        return list_projects()
    if command == "create_project_from_image":
        path = Path(args["sourceImagePath"])
        return create_project(args["projectName"], path.read_bytes())
    if command == "create_project_from_upload":
        raw = args["imageBase64"].split(",")[-1]
        return create_project(args["projectName"], base64.b64decode(raw))
    if command == "open_project":
        return open_project(args["projectId"])
    if command == "delete_project":
        delete_project(args["projectId"])
        return None
    if command == "save_project_image":
        return save_project_image(args["projectId"], args["pngBase64"])
    if command == "export_project_image":
        src = PROJECTS / args["projectId"] / "current.png"
        dest = Path(args["destinationPath"])
        shutil.copy(src, dest)
        return None
    if command == "create_stroke":
        return create_stroke(args["args"])
    if command == "list_strokes":
        return list_strokes(args["projectId"])
    if command == "run_stroke":
        return run_stroke(args["projectId"], args["strokeId"])
    if command == "delete_stroke":
        delete_stroke(args["projectId"], args["strokeId"])
        return None
    if command == "format_project_time":
        ms = args["timestampMs"]
        return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
    raise ValueError(f"Unknown command: {command}")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            out = json.dumps({"ok": True, "service": "quantum-brush-api"}).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            return

        if parsed.path.startswith("/media/"):
            rel = parsed.path[len("/media/") :]
            file_path = ROOT / rel
            if not file_path.is_file():
                self.send_error(404)
                return
            data = file_path.read_bytes()
            ctype = "image/png" if file_path.suffix == ".png" else "application/octet-stream"
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if parsed.path == "/api/export":
            qs = parse_qs(parsed.query)
            pid = qs.get("projectId", [""])[0]
            src = PROJECTS / pid / "current.png"
            if not src.is_file():
                self.send_error(404)
                return
            data = src.read_bytes()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "image/png")
            self.send_header(
                "Content-Disposition",
                f'attachment; filename="{pid}.png"',
            )
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404)

    def do_POST(self) -> None:
        if self.path != "/api/invoke":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
            command = payload["command"]
            args = payload.get("args", {})
            result = handle_invoke(command, args)
            out = json.dumps({"ok": True, "result": result}).encode()
            code = 200
        except Exception as e:
            out = json.dumps({"ok": False, "error": str(e)}).encode()
            code = 500

        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


def main() -> None:
    port = int(os.environ.get("PORT", os.environ.get("QB_DEV_API_PORT", "8787")))
    ensure_dir(METADATA)
    ensure_dir(PROJECTS)
    print(f"Quantum Brush dev API")
    print(f"  root:   {ROOT}")
    print(f"  python: {PYTHON}")
    print(f"  listen: http://127.0.0.1:{port}")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
