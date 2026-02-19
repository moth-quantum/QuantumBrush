import { useRef, useCallback, useEffect, useState } from "react";
import { useStore } from "../../store";
import { constrainToAxis } from "../../lib/pathUtils";
import type { CanvasPath } from "../../store/slices/canvasSlice";

interface DrawingCanvasProps {
  onSpaceDrag: (dx: number, dy: number) => void;
}

export function DrawingCanvas({ onSpaceDrag }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const clickAnchor = useRef<[number, number] | null>(null);

  const {
    imageWidth,
    imageHeight,
    zoom,
    activeTool,
    strokeColor,
    strokeSize,
    strokeOpacity,
    addPath,
    currentPath,
    setCurrentPath,
    paths,
    removePath,
  } = useStore();

  // Handle keyboard events for space bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
        lastPanPos.current = null;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      return [(e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom];
    },
    [zoom]
  );

  const makePath = useCallback(
    (points: [number, number][], clickPoint: [number, number]): CanvasPath => ({
      points,
      clickPoint,
      tool: activeTool,
      color: strokeColor,
      size: strokeSize,
      opacity: strokeOpacity,
    }),
    [activeTool, strokeColor, strokeSize, strokeOpacity]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      if (spaceHeld) {
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const [x, y] = getCanvasCoords(e);

      // Eraser: find and remove the nearest path under the click
      if (activeTool === "eraser") {
        const hitIndex = findPathUnderPoint(paths, x, y, 10);
        if (hitIndex >= 0) {
          removePath(hitIndex);
        }
        return;
      }

      // Dot: place a single dot immediately
      if (activeTool === "dot") {
        const dotPath = makePath([[x, y]], [x, y]);
        addPath(dotPath);
        return;
      }

      // Brush or Line: start drawing
      clickAnchor.current = [x, y];
      setIsDrawing(true);
      setCurrentPath(makePath([[x, y]], [x, y]));
    },
    [spaceHeld, getCanvasCoords, activeTool, paths, removePath, makePath, addPath, setCurrentPath]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (spaceHeld && lastPanPos.current) {
        const dx = e.clientX - lastPanPos.current.x;
        const dy = e.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        onSpaceDrag(dx, dy);
        return;
      }

      if (!isDrawing || !currentPath) return;

      let [x, y] = getCanvasCoords(e);

      // Shift-key constraint
      if (e.shiftKey && clickAnchor.current) {
        [x, y] = constrainToAxis(
          clickAnchor.current[0],
          clickAnchor.current[1],
          x,
          y
        );
      }

      if (activeTool === "brush") {
        // Freehand: append points
        setCurrentPath({
          ...currentPath,
          points: [...currentPath.points, [x, y]],
        });
      } else if (activeTool === "line") {
        // Line: always just start + current end (2 points)
        setCurrentPath({
          ...currentPath,
          points: [currentPath.clickPoint, [x, y]],
        });
      }
    },
    [isDrawing, spaceHeld, currentPath, getCanvasCoords, activeTool, onSpaceDrag, setCurrentPath]
  );

  const handleMouseUp = useCallback(() => {
    if (spaceHeld) {
      lastPanPos.current = null;
      return;
    }

    if (isDrawing && currentPath) {
      // For brush, need at least 2 points; for line, always has 2
      if (currentPath.points.length >= 2) {
        addPath(currentPath);
      }
    }
    setIsDrawing(false);
    setCurrentPath(null);
    clickAnchor.current = null;
  }, [isDrawing, spaceHeld, currentPath, addPath, setCurrentPath]);

  // Draw current stroke in progress
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!currentPath || currentPath.points.length < 1) return;

    const pts = currentPath.points;
    const color = currentPath.color;
    const size = currentPath.size;

    ctx.globalAlpha = currentPath.opacity;

    if (currentPath.tool === "dot" || pts.length < 2) {
      // Single dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Outer stroke (highlight)
      ctx.strokeStyle = adjustBrightness(color, 40);
      ctx.lineWidth = size + 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();

      // Inner stroke (main color)
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Click point indicator
    const cp = currentPath.clickPoint;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#FFFF00";
    ctx.beginPath();
    ctx.arc(cp[0], cp[1], 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [currentPath]);

  if (imageWidth === 0 || imageHeight === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={imageWidth}
      height={imageHeight}
      className={`absolute top-0 left-0 ${
        spaceHeld ? "cursor-grab" : activeTool === "eraser" ? "cursor-pointer" : "cursor-crosshair"
      }`}
      style={{ width: imageWidth, height: imageHeight }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

/** Find the index of the path closest to (x, y) within threshold, or -1 */
function findPathUnderPoint(
  paths: { points: [number, number][]; tool: string }[],
  x: number,
  y: number,
  threshold: number
): number {
  for (let i = paths.length - 1; i >= 0; i--) {
    const pts = paths[i].points;
    if (paths[i].tool === "dot") {
      // Check distance to the single point
      const dx = pts[0][0] - x;
      const dy = pts[0][1] - y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return i;
    } else {
      // Check distance to each segment
      for (let j = 0; j < pts.length - 1; j++) {
        if (distToSegment(x, y, pts[j], pts[j + 1]) < threshold) return i;
      }
    }
  }
  return -1;
}

/** Distance from point (px, py) to line segment (a, b) */
function distToSegment(
  px: number,
  py: number,
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - a[0];
    const ey = py - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = a[0] + t * dx;
  const closestY = a[1] + t * dy;
  const ex = px - closestX;
  const ey = py - closestY;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Lighten or darken a hex color */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
