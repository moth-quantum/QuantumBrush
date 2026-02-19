/** Convert screen coordinates to image coordinates */
export function screenToImage(
  screenX: number,
  screenY: number,
  zoom: number,
  panX: number,
  panY: number
): [number, number] {
  return [(screenX - panX) / zoom, (screenY - panY) / zoom];
}

/** Convert image coordinates to screen coordinates */
export function imageToScreen(
  imageX: number,
  imageY: number,
  zoom: number,
  panX: number,
  panY: number
): [number, number] {
  return [imageX * zoom + panX, imageY * zoom + panY];
}

/** Constrain movement to horizontal or vertical based on shift key */
export function constrainToAxis(
  anchorX: number,
  anchorY: number,
  currentX: number,
  currentY: number
): [number, number] {
  const dx = Math.abs(currentX - anchorX);
  const dy = Math.abs(currentY - anchorY);

  if (dx > dy) {
    // Constrain to horizontal
    return [currentX, anchorY];
  } else {
    // Constrain to vertical
    return [anchorX, currentY];
  }
}

/** Calculate distance between two points */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
