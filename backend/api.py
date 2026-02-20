"""
QuantumBrush pywebview API bridge.

All public methods here are callable from JavaScript via:
    window.pywebview.api.method_name(args)
"""

import json
import os
import sys
import base64
import threading
import subprocess
import tempfile
import uuid
from pathlib import Path

import webview  # pywebview

if hasattr(sys, '_MEIPASS'):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

BACKEND_DIR = BASE_DIR / "backend"
EFFECTS_DIR = BACKEND_DIR / "effects"


class Api:
    def __init__(self):
        self._jobs: dict[str, dict] = {}  # job_id -> {process, status, result}
        self._lock = threading.Lock()
        self._maximized = False
        self._window = None
        self._original_size = None

    # ── Effects ────────────────────────────────────────────────────

    def list_effects(self):
        """Return all available effect descriptors from effects/ subdirectories."""
        effects = []
        for subdir in sorted(EFFECTS_DIR.iterdir()):
            if not subdir.is_dir():
                continue
            req_file = subdir / f"{subdir.name}_requirements.json"
            if not req_file.exists():
                continue
            try:
                with open(req_file, "r") as f:
                    data = json.load(f)
                effects.append(data)
            except Exception as e:
                print(f"[api] Failed to load effect {subdir.name}: {e}")
        return effects

    # ── Image ──────────────────────────────────────────────────────

    def open_image_dialog(self):
        """Open a native file dialog and return the image as base64 + dimensions."""
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Image files (*.png;*.jpg;*.jpeg;*.bmp;*.webp;*.tiff)",),
        )
        if not result:
            return None
        path = result[0]
        try:
            from PIL import Image as PILImage
            import io
            with PILImage.open(path) as img:
                width, height = img.size
                buf = io.BytesIO()
                img.convert("RGBA").save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            return {
                "src": f"data:image/png;base64,{b64}",
                "width": width,
                "height": height,
            }
        except Exception as e:
            print(f"[api] Error loading image: {e}")
            return None

    # ── Effect Processing ──────────────────────────────────────────

    def run_effect(self, effect_id: str, stroke_input: dict, user_input: dict):
        """
        Start a background subprocess to apply an effect.
        Returns {job_id} immediately. Poll get_job_status for progress.
        """
        job_id = str(uuid.uuid4())

        # Build the instruction dict that apply_effect.py expects
        instruction = {
            "stroke_id": job_id,
            "project_id": "default",
            "effect_id": effect_id,
            "stroke_input": stroke_input,
            "user_input": user_input,
        }

        # Write instruction to a temp file in the system temp directory
        tmp_dir = Path(tempfile.gettempdir())

        # Save the input image for apply_effect.py to pick up
        if "image_b64" in stroke_input:
            img_data = base64.b64decode(stroke_input.pop("image_b64"))
            with open(tmp_dir / f"{job_id}_input.png", "wb") as f:
                f.write(img_data)

        instr_path = tmp_dir / f"{job_id}.json"
        with open(instr_path, "w") as f:
            json.dump(instruction, f)

        with self._lock:
            self._jobs[job_id] = {
                "status": "running",
                "progress": 0.0,
                "result": None,
                "process": None,
            }

        # Run in background thread
        t = threading.Thread(
            target=self._run_subprocess,
            args=(job_id, instr_path),
            daemon=True,
        )
        t.start()

        return {"job_id": job_id}

    def _run_subprocess(self, job_id: str, instr_path: Path):
        try:
            # Execute as a module to handle imports correctly
            proc = subprocess.Popen(
                [sys.executable, "-m", "backend.apply_effect", str(instr_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(BASE_DIR),
            )
            with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id]["process"] = proc

            stdout, stderr = proc.communicate()

            if proc.returncode == 0:
                # Load result PNG as base64
                tmp_dir = Path(tempfile.gettempdir())
                output_path = tmp_dir / f"{job_id}_output.png"
                if output_path.exists():
                    b64 = base64.b64encode(output_path.read_bytes()).decode("utf-8")
                    try:
                        os.remove(output_path)
                    except: pass
                else:
                    b64 = None

                # Cleanup input files
                try:
                    os.remove(instr_path)
                    os.remove(tmp_dir / f"{job_id}_input.png")
                except: pass

                with self._lock:
                    if job_id in self._jobs:
                        self._jobs[job_id]["status"] = "done"
                        self._jobs[job_id]["progress"] = 1.0
                        self._jobs[job_id]["result"] = b64
            else:
                error_msg = stderr.decode()
                stdout_msg = stdout.decode()
                if stdout_msg:
                    print(f"[api] Job {job_id} stdout:\n{stdout_msg}")
                print(f"[api] Job {job_id} failed:\n{error_msg}")
                # Cleanup input files
                try:
                    tmp_dir = Path(tempfile.gettempdir())
                    os.remove(instr_path)
                    os.remove(tmp_dir / f"{job_id}_input.png")
                except: pass
                with self._lock:
                    if job_id in self._jobs:
                        self._jobs[job_id]["status"] = "error"
                        self._jobs[job_id]["result"] = error_msg  # ← send error to UI too

        except Exception as e:
            print(f"[api] Exception in job {job_id}: {e}")
            with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id]["status"] = "error"

    def get_job_status(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
        if not job:
            return {"status": "error", "progress": 0, "result": None}
        return {
            "status": job["status"],
            "progress": job["progress"],
            "result": job["result"],
        }

    def abort_job(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.get("process"):
                try:
                    job["process"].kill()
                except Exception:
                    pass
            if job:
                job["status"] = "aborted"
        return {"ok": True}

    # ── Export ─────────────────────────────────────────────────────

    def export_image(self, merged_base64: str):
        """Open a native save dialog and write the merged PNG."""
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename="quantumbrush_export.png",
            file_types=("PNG image (*.png)",),
        )
        if not result:
            return {"ok": False}
        save_path = result if isinstance(result, str) else result[0]
        try:
            data = base64.b64decode(merged_base64)
            with open(save_path, "wb") as f:
                f.write(data)
            return {"ok": True}
        except Exception as e:
            print(f"[api] Export error: {e}")
            return {"ok": False}

    # ── Window Controls ──────────────────────────────────────────

    def close_window(self):
        webview.windows[0].destroy()

    def minimize_window(self):
        webview.windows[0].minimize()

    def toggle_maximize(self):
        self._maximized = not self._maximized
        if self._maximized:
            print("[api] Maximizing window...")
            webview.windows[0].maximize()
        else:
            print("[api] Restoring window...")
            if self._original_size:
                width, height = self._original_size
                webview.window[0].restore()
                webview.windows[0].resize(width, height, fix_point=webview.window.FixPoint.NORTH | webview.window.FixPoint.WEST)
