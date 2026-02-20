# main.py
"""
QuantumBrush — pywebview desktop entry point.

Usage:
    python main.py                # production: loads frontend/dist
    python main.py --dev          # dev: loads http://localhost:5173 (Vite dev server)
"""

import sys
import argparse
import os
from pathlib import Path

import webview

from backend.api import Api

def expose_functions(window):
    try:
        window.evaluate_js('console.log("pywebview API ready:", window.pywebview !== undefined)')
    except Exception as e:
        print(f"JS eval error: {e}")
    print("Window created, API should be available")

def main():
    # PyInstaller Worker Dispatcher
    # When bundled, sys.executable is the app itself. We need to handle 
    # the case where the app is called to run a backend script as a subprocess.
    if len(sys.argv) > 1 and "apply_effect.py" in sys.argv[1]:
        # We are being called as a worker process.
        # Shift args to remove the script path and pass the rest to the worker handler.
        worker_script = sys.argv[1]
        json_path = sys.argv[2] if len(sys.argv) > 2 else None
        
        # Load and execute apply_effect logic manually
        # This avoids the "unrecognized arguments" error from the main argparse
        import importlib.util
        spec = importlib.util.spec_from_file_location("worker", worker_script)
        worker_module = importlib.util.module_from_spec(spec)
        sys.argv = [sys.argv[0], json_path] # Mock sys.argv for the worker
        spec.loader.exec_module(worker_module)
        return

    parser = argparse.ArgumentParser(description="QuantumBrush Desktop App")
    parser.add_argument("--dev", action="store_true", help="Run in development mode")
    args = parser.parse_args()

    # Determine URL
    if args.dev:
        url = "http://localhost:5173"
    else:
        # Use local file if not in dev mode
        dist_path = Path(__file__).parent / "frontend/dist/index.html"
        if not dist_path.exists():
            # Fallback for PyInstaller bundle context
            dist_path = Path(sys._MEIPASS) / "frontend/dist/index.html" if hasattr(sys, '_MEIPASS') else dist_path
        url = str(dist_path)

    api = Api()

    # Create window with js_api
    window = webview.create_window(
        "QuantumBrush",
        url=url,
        js_api=api,
        width=1400,
        height=900,
        min_size=(900, 600),
        background_color="#0a0a0f",
        frameless=True,
    )

    # Debug mode is enabled if --dev is passed OR QB_DEBUG environment variable is set
    debug = args.dev or os.getenv("QB_DEBUG", "false").lower() in ("true", "1", "yes")
    
    webview.start(expose_functions, window, debug=debug, gui="gtk", icon="assets/icon.png")


if __name__ == "__main__":
    main()