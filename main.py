# main.py
"""
QuantumBrush — pywebview desktop entry point.

Usage:
    python main.py                # production: loads frontend/dist
    python main.py --dev          # dev: loads http://localhost:5173 (Vite dev server)
"""

import sys
import argparse
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true", help="Load Vite dev server instead of dist")
    args = parser.parse_args()

    api = Api()

    if args.dev:
        url = "http://localhost:5173"
    else:
        dist_path = Path(__file__).parent / "frontend" / "dist" / "index.html"
        if not dist_path.exists():
            print("ERROR: frontend/dist not found. Run 'bun run build' inside frontend/ first.")
            sys.exit(1)
        url = dist_path.resolve().as_uri()

    # Create window with js_api
    window = webview.create_window(
        "QuantumBrush",
        url=url,
        js_api=api,
        width=1400,
        height=900,
        min_size=(900, 600),
        background_color="#0a0a0f",
    )

    webview.start(expose_functions, window, debug=True, gui="qtk")


if __name__ == "__main__":
    main()