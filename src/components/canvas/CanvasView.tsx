import { useRef } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { ImageLayer } from "./ImageLayer";
import { PathOverlay } from "./PathOverlay";
import { useStore } from "../../store";
import { useZoomPan } from "../../hooks/useZoomPan";

export function CanvasView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoom, panX, panY, currentImage } = useStore();
  const { handleWheel, handleSpaceDrag, isPanning } = useZoomPan(containerRef);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-bg-primary ${
        isPanning ? "cursor-grabbing" : ""
      }`}
      onWheel={handleWheel}
    >
      <div
        className="absolute"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {currentImage && <ImageLayer />}
        <PathOverlay />
        <DrawingCanvas onSpaceDrag={handleSpaceDrag} />
      </div>
    </div>
  );
}
