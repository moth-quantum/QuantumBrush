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

# Handle path resolution for development and frozen (PyInstaller) modes
if hasattr(sys, '_MEIPASS'):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent

# Ensure the base directory is in sys.path for absolute imports to work
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.api import Api

def expose_functions(window):
    try:
        window.evaluate_js('console.log("pywebview API ready:", window.pywebview !== undefined)')
    except Exception as e:
        print(f"JS eval error: {e}")
    print("Window created, API should be available")

def main():
    # Silent Module Dispatcher (Fixes PyInstaller background workers)
    # If the app is launched with "-m backend.apply_effect", we run that module and exit.
    if len(sys.argv) > 2 and sys.argv[1] == "-m":
        import runpy
        module_name = sys.argv[2]
        # Ensure the base directory is in sys.path
        if str(BASE_DIR) not in sys.path:
            sys.path.insert(0, str(BASE_DIR))
        
        # Shift remaining args so the target module sees its own arguments correctly
        sys.argv = sys.argv[2:] 
        runpy.run_module(module_name, run_name="__main__")
        return

    parser = argparse.ArgumentParser(description="QuantumBrush Desktop App")
    parser.add_argument("--dev", action="store_true", help="Run in development mode")
    args = parser.parse_args()

    # Determine URL
    if args.dev:
        url = "http://localhost:5173"
    else:
        # Use bundled dist in production
        url = str(BASE_DIR / "frontend/dist/index.html")

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
    
    icon_path = str(BASE_DIR / "assets/icon.png")
    webview.start(expose_functions, window, debug=debug, gui="gtk", icon=icon_path)


if __name__ == "__main__":
    main()