import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { apiUrl } from "./apiBase";

/** Resolve image path for Tauri filesystem or web /media URLs. */
export function resolveImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/media/")) {
    return apiUrl(path);
  }
  if (isTauri()) {
    return convertFileSrc(path);
  }
  return path;
}
