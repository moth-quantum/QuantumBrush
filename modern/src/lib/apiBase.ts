/** Backend base URL. Empty = same origin (local Vite proxy). Set VITE_API_URL on Vercel. */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
