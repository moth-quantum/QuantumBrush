import { resolveImageUrl } from "./imageUrl";

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${path}`));
    img.src = resolveImageUrl(path);
  });
}

/** Blend stroke output onto current project image (matches Java BLEND apply). */
export async function blendImages(
  basePath: string,
  overlayPath: string,
): Promise<string> {
  const [base, overlay] = await Promise.all([
    loadImage(basePath),
    loadImage(overlayPath),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(overlay, 0, 0, base.width, base.height);
  return canvas.toDataURL("image/png");
}
