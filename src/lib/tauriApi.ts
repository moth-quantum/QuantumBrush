import { invoke } from "@tauri-apps/api/core";
import type { ProjectMetadata } from "../types/project";
import type { Effect } from "../types/effect";
import type { StrokeInfo, StrokeStatusResponse } from "../types/stroke";

// Project commands
export async function newProject(
  name: string,
  imagePath: string
): Promise<ProjectMetadata> {
  return invoke("new_project", { name, imagePath });
}

export async function openProject(
  projectId: string
): Promise<ProjectMetadata> {
  return invoke("open_project", { projectId });
}

export async function listProjects(): Promise<ProjectMetadata[]> {
  return invoke("list_projects");
}

export async function deleteProject(projectId: string): Promise<void> {
  return invoke("delete_project", { projectId });
}

export async function exportImage(
  projectId: string,
  exportPath: string
): Promise<void> {
  return invoke("export_image", { projectId, exportPath });
}

export async function getCurrentImage(projectId: string): Promise<string> {
  return invoke("get_current_image", { projectId });
}

export async function setAppDir(dir: string): Promise<void> {
  return invoke("set_app_dir", { dir });
}

// Effect commands
export async function loadEffects(): Promise<Effect[]> {
  return invoke("load_effects");
}

// Python commands
export async function startPythonServer(): Promise<string> {
  return invoke("start_python_server");
}

export async function stopPythonServer(): Promise<string> {
  return invoke("stop_python_server");
}

export async function checkPythonServer(): Promise<boolean> {
  return invoke("check_python_server");
}

export async function detectPython(): Promise<string> {
  return invoke("detect_python");
}

// Stroke commands
export async function createStroke(
  projectId: string,
  effectId: string,
  userInput: Record<string, unknown>,
  paths: number[][][],
  clicks: number[][]
): Promise<StrokeInfo> {
  return invoke("create_stroke", {
    projectId,
    effectId,
    userInput,
    paths,
    clicks,
  });
}

export async function runStroke(
  strokeId: string,
  projectId: string
): Promise<void> {
  return invoke("run_stroke", { strokeId, projectId });
}

export async function applyStroke(
  projectId: string,
  strokeId: string
): Promise<string> {
  return invoke("apply_stroke", { projectId, strokeId });
}

export async function deleteStroke(
  projectId: string,
  strokeId: string
): Promise<void> {
  return invoke("delete_stroke", { projectId, strokeId });
}

export async function cancelStroke(
  projectId: string,
  strokeId: string
): Promise<void> {
  return invoke("cancel_stroke", { projectId, strokeId });
}

export async function getStrokeStatus(
  projectId: string,
  strokeId: string
): Promise<StrokeStatusResponse> {
  return invoke("get_stroke_status", { projectId, strokeId });
}

export async function listStrokes(
  projectId: string
): Promise<StrokeInfo[]> {
  return invoke("list_strokes", { projectId });
}

export async function updateStrokeParams(
  projectId: string,
  strokeId: string,
  userInput: Record<string, unknown>
): Promise<void> {
  return invoke("update_stroke_params", { projectId, strokeId, userInput });
}
