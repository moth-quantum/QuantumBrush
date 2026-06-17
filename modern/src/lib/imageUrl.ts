import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { apiUrl } from "./apiBase";

/** Resolve image path for Tauri filesystem or web /media URLs. */
export function resolveImageUrl(path: string, cacheBust?: number): string {
  if (!path) return "";
  const pathOnly = path.split("?")[0];
  if (pathOnly.startsWith("http") || pathOnly.startsWith("data:")) {
    return path;
  }
  let url: string;
  if (pathOnly.startsWith("/media/")) {
    url = apiUrl(pathOnly);
  } else if (isTauri()) {
    url = convertFileSrc(pathOnly);
  } else {
    url = pathOnly;
  }
  if (cacheBust !== undefined && cacheBust > 0) {
    url += `${url.includes("?") ? "&" : "?"}v=${cacheBust}`;
  }
  return url;
}
