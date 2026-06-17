import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Image as KonvaImage, Line, Circle } from "react-konva";
import type Konva from "konva";
import { resolveImageUrl } from "../lib/imageUrl";
import { useAppStore } from "../store/useAppStore";
import type { DrawPath } from "../types";

interface Props {
  width: number;
  height: number;
}

/**
 * Canvas window — image display, stroke drawing, zoom/pan.
 * Yellow anchor + red path match legacy QuantumBrush stroke contract.
 */
export function Canvas({ width, height }: Props) {
  const imagePath = useAppStore((s) => s.imagePath);
  const paths = useAppStore((s) => s.paths);
  const addPath = useAppStore((s) => s.addPath);
  const projectId = useAppStore((s) => s.projectId);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Zoom and pan state (same shortcuts as Java canvas: scroll, space+drag)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const containerFocused = useRef(true);

  // Load project image and fit to viewport
  useEffect(() => {
    if (!imagePath) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = resolveImageUrl(imagePath);
    img.onload = () => {
      setImage(img);
      const fit = Math.min(
        (width * 0.9) / img.width,
        (height * 0.9) / img.height,
        1,
      );
      setZoom(fit);
      setPan({
        x: (width - img.width * fit) / 2,
        y: (height - img.height * fit) / 2,
      });
    };
  }, [imagePath, width, height]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const screenToImage = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  const inImageBounds = (x: number, y: number) => {
    if (!image) return false;
    return x >= 0 && y >= 0 && x <= image.width && y <= image.height;
  };

  const finishPath = useCallback(() => {
    if (currentPath && currentPath.points.length > 0) {
      addPath(currentPath);
    }
    setCurrentPath(null);
    setDrawing(false);
  }, [currentPath, addPath]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!projectId || !image) return;
    containerFocused.current = true;

    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Right-click or space+drag = pan
    if (e.evt.button === 2 || spaceDown) {
      setPanning(true);
      panStart.current = {
        x: pos.x,
        y: pos.y,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    if (e.evt.button !== 0) return;
    const ip = screenToImage(pos.x, pos.y);
    if (!inImageBounds(ip.x, ip.y)) return;

    // Left click starts stroke: yellow anchor at click, red path on drag
    setDrawing(true);
    setCurrentPath({
      click: { x: ip.x, y: ip.y },
      points: [{ x: ip.x, y: ip.y }],
    });
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (panning) {
      setPan({
        x: panStart.current.panX + (pos.x - panStart.current.x),
        y: panStart.current.panY + (pos.y - panStart.current.y),
      });
      return;
    }

    if (!drawing || !currentPath) return;
    const ip = screenToImage(pos.x, pos.y);
    if (!inImageBounds(ip.x, ip.y)) return;

    // Shift = axis lock from anchor (legacy behavior)
    const shift = e.evt.shiftKey;

    if (shift && currentPath.points.length > 0) {
      const dx = ip.x - currentPath.click.x;
      const dy = ip.y - currentPath.click.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        setCurrentPath({
          ...currentPath,
          points: [
            currentPath.click,
            { x: ip.x, y: currentPath.click.y },
          ],
        });
      } else {
        setCurrentPath({
          ...currentPath,
          points: [
            currentPath.click,
            { x: currentPath.click.x, y: ip.y },
          ],
        });
      }
    } else {
      setCurrentPath({
        ...currentPath,
        points: [...currentPath.points, { x: ip.x, y: ip.y }],
      });
    }
  };

  const handleMouseUp = () => {
    if (panning) {
      setPanning(false);
      return;
    }
    if (drawing) finishPath();
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const scaleBy = 1.08;
    const oldZoom = zoom;
    const newZoom =
      e.evt.deltaY < 0
        ? Math.min(oldZoom * scaleBy, 10)
        : Math.max(oldZoom / scaleBy, 0.1);

    const mousePointTo = {
      x: (pos.x - pan.x) / oldZoom,
      y: (pos.y - pan.y) / oldZoom,
    };

    setZoom(newZoom);
    setPan({
      x: pos.x - mousePointTo.x * newZoom,
      y: pos.y - mousePointTo.y * newZoom,
    });
  };

  const allPaths = currentPath ? [...paths, currentPath] : paths;

  return (
    <div
      className="canvas-wrap"
      tabIndex={0}
      onFocus={() => {
        containerFocused.current = true;
      }}
      onBlur={() => {
        containerFocused.current = false;
      }}
    >
      {!projectId && (
        <div className="canvas-empty">
          <p>Create or open a project to begin</p>
          <p className="muted">Import an image, then draw strokes for quantum brushes</p>
        </div>
      )}
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.evt.preventDefault()}
        className={projectId ? "stage-active" : "stage-hidden"}
      >
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              x={pan.x}
              y={pan.y}
              scaleX={zoom}
              scaleY={zoom}
            />
          )}
          {allPaths.map((path, idx) => (
            <Group key={idx}>
              {/* Draw click point (yellow anchor) */}
              <Circle
                x={path.click.x * zoom + pan.x}
                y={path.click.y * zoom + pan.y}
                radius={6}
                fill="#facc15"
                stroke="#000"
                strokeWidth={1}
              />
              {path.points.length >= 2 && (
                <>
                  {/* Draw path line — yellow underlay, red stroke */}
                  <Line
                    points={path.points.flatMap((p) => [
                      p.x * zoom + pan.x,
                      p.y * zoom + pan.y,
                    ])}
                    stroke="#facc15"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                  />
                  <Line
                    points={path.points.flatMap((p) => [
                      p.x * zoom + pan.x,
                      p.y * zoom + pan.y,
                    ])}
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                </>
              )}
            </Group>
          ))}
        </Layer>
      </Stage>
      {projectId && (
        <div className="canvas-hint">
          Click = yellow anchor · Drag = red path · Shift = axis lock · Space+drag = pan · Scroll = zoom
        </div>
      )}
    </div>
  );
}
