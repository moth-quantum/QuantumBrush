import { invoke, isTauri } from "@tauri-apps/api/core";
import { apiUrl, getApiBase } from "../lib/apiBase";
import type {
  AppInfo,
  DrawPath,
  EffectSummary,
  ProjectMeta,
  StrokeSummary,
} from "../types";

/** Tauri desktop vs browser + Python dev API. */
export function getRuntimeMode(): "tauri" | "web" {
  return isTauri() ? "tauri" : "web";
}

export function getConfiguredApiBase(): string {
  return getApiBase();
}

// Web: POST { command, args } to Python dev API (mirrors Tauri invoke)
async function webInvoke<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(apiUrl("/api/invoke"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      res.status === 404
        ? "API not found — set VITE_API_URL to your Python backend (Vercel hosts UI only)"
        : text || `HTTP ${res.status}`,
    );
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "API request failed");
  }
  return data.result as T;
}

async function call<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (isTauri()) {
    return invoke(command, args);
  }
  return webInvoke<T>(command, args);
}

export async function checkApiHealth(): Promise<boolean> {
  if (isTauri()) return true;
  try {
    const res = await fetch(apiUrl("/api/health"));
    return res.ok;
  } catch {
    return false;
  }
}

export function getAppInfo(): Promise<AppInfo> {
  return call("get_app_info");
}

export function listEffects(): Promise<EffectSummary[]> {
  return call("list_effects");
}

export function listProjects(): Promise<ProjectMeta[]> {
  return call("list_projects");
}

export function createProjectFromImage(
  projectName: string,
  sourceImagePath: string,
): Promise<{ project_id: string; project_name: string; image_path: string }> {
  return call("create_project_from_image", { projectName, sourceImagePath });
}

export function createProjectFromUpload(
  projectName: string,
  imageBase64: string,
): Promise<{ project_id: string; project_name: string; image_path: string }> {
  return call("create_project_from_upload", { projectName, imageBase64 });
}

export function openProject(
  projectId: string,
): Promise<{ project_id: string; image_path: string }> {
  return call("open_project", { projectId });
}

export function deleteProject(projectId: string): Promise<void> {
  return call("delete_project", { projectId });
}

export function saveProjectImage(
  projectId: string,
  pngBase64: string,
): Promise<string> {
  return call("save_project_image", { projectId, pngBase64 });
}

export function exportProjectImage(
  projectId: string,
  destinationPath: string,
): Promise<void> {
  return call("export_project_image", { projectId, destinationPath });
}

/** Persist stroke JSON + spawn apply_effect.py on Run (StrokeManager). */
export function createStroke(args: {
  project_id: string;
  effect_id: string;
  parameters: Record<string, unknown>;
  paths: DrawPath[];
}): Promise<string> {
  return call("create_stroke", { args });
}

export function listStrokes(projectId: string): Promise<StrokeSummary[]> {
  return call("list_strokes", { projectId });
}

export function runStroke(
  projectId: string,
  strokeId: string,
): Promise<{
  success: boolean;
  exit_code: number | null;
  processing_status: string;
  stdout: string;
  stderr: string;
}> {
  return call("run_stroke", { projectId, strokeId });
}

export function deleteStroke(
  projectId: string,
  strokeId: string,
): Promise<void> {
  return call("delete_stroke", { projectId, strokeId });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function pickAndExportProject(
  projectId: string,
  filename: string,
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const dest = await save({
      filters: [{ name: "PNG", extensions: ["png"] }],
      defaultPath: filename,
    });
    if (!dest || typeof dest !== "string") return;
    await exportProjectImage(projectId, dest);
    return;
  }
  // Browser: download via /api/export
  const a = document.createElement("a");
  a.href = apiUrl(`/api/export?projectId=${encodeURIComponent(projectId)}`);
  a.download = filename;
  a.click();
}

export type { DrawPath };
