"""
FastAPI server wrapping existing apply_effect.py functions.
This is the only new Python file - all 7 effects remain completely unchanged.
"""

import argparse
import asyncio
import json
import os
import platform
import sys
import traceback
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Add parent directory to path so we can import apply_effect
sys.path.insert(0, str(Path(__file__).parent))

from apply_effect import process_effect, apply_effect, record_error

app = FastAPI(title="QuantumBrush Effect Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track running tasks
running_tasks: dict[str, str] = {}  # stroke_id -> status


class RunEffectRequest(BaseModel):
    stroke_id: str
    project_id: str
    effect_id: str
    user_input: dict
    stroke_input: dict
    input_image_path: str


class RunEffectResponse(BaseModel):
    success: bool
    stroke_id: str
    output_image_path: Optional[str] = None
    error: Optional[str] = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "python_version": platform.python_version(),
    }


@app.get("/effects")
async def list_effects():
    """Scan effect/ dirs for *_requirements.json, return list."""
    effect_dir = Path(__file__).parent
    effects = []

    for entry in effect_dir.iterdir():
        if not entry.is_dir():
            continue
        if entry.name.startswith("_") or entry.name.startswith("."):
            continue

        req_path = entry / f"{entry.name}_requirements.json"
        if req_path.exists():
            try:
                with open(req_path, "r") as f:
                    req = json.load(f)
                effects.append(req)
            except Exception as e:
                print(f"Failed to load {req_path}: {e}")

    effects.sort(key=lambda e: e.get("name", ""))
    return effects


def run_effect_sync(req: RunEffectRequest) -> RunEffectResponse:
    """Synchronously run an effect - called in background thread."""
    try:
        # Build the instructions dict matching what process_effect() expects
        instructions = {
            "stroke_id": req.stroke_id,
            "project_id": req.project_id,
            "effect_id": req.effect_id,
            "user_input": req.user_input,
            "stroke_input": req.stroke_input,
        }

        # process_effect reads the image from disk:
        # project/<project_id>/stroke/<stroke_id>_input.png
        data = process_effect(instructions)

        # apply_effect runs the effect and saves output:
        # project/<project_id>/stroke/<stroke_id>_output.png
        success = apply_effect(data)

        if success:
            output_path = str(data["stroke_output_path"])
            return RunEffectResponse(
                success=True,
                stroke_id=req.stroke_id,
                output_image_path=output_path,
            )
        else:
            return RunEffectResponse(
                success=False,
                stroke_id=req.stroke_id,
                error="Effect returned False",
            )

    except Exception as e:
        error_msg = traceback.format_exc()
        record_error(e)
        return RunEffectResponse(
            success=False,
            stroke_id=req.stroke_id,
            error=str(e),
        )


async def run_effect_background(req: RunEffectRequest):
    """Run effect in a thread pool to avoid blocking the event loop."""
    running_tasks[req.stroke_id] = "running"
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_effect_sync, req)
        running_tasks[req.stroke_id] = "completed" if result.success else "failed"
        return result
    except Exception as e:
        running_tasks[req.stroke_id] = "failed"
        raise


@app.post("/run-effect")
async def run_effect_endpoint(req: RunEffectRequest):
    """
    Execute an effect on a stroke.
    Runs synchronously and returns the result (the Rust side handles async via tokio::spawn).
    """
    running_tasks[req.stroke_id] = "running"

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_effect_sync, req)
        running_tasks[req.stroke_id] = "completed" if result.success else "failed"
        return result
    except Exception as e:
        running_tasks[req.stroke_id] = "failed"
        return RunEffectResponse(
            success=False,
            stroke_id=req.stroke_id,
            error=str(e),
        )


@app.get("/status/{stroke_id}")
async def get_status(stroke_id: str):
    status = running_tasks.get(stroke_id, "unknown")
    return {"stroke_id": stroke_id, "status": status}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QuantumBrush Effect Server")
    parser.add_argument("--port", type=int, default=8787, help="Server port")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Server host")
    args = parser.parse_args()

    print(f"Starting QuantumBrush Effect Server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
