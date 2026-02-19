import { useCallback, useState, useEffect } from "react";
import { useStore } from "../store";

export function useZoomPan(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { zoom, setZoom, panX, panY, setPan } = useStore();
  const [isPanning, setIsPanning] = useState(false);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, zoom * delta));

        // Zoom toward mouse position
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const scale = newZoom / zoom;
          const newPanX = mouseX - (mouseX - panX) * scale;
          const newPanY = mouseY - (mouseY - panY) * scale;
          setPan(newPanX, newPanY);
        }

        setZoom(newZoom);
      } else {
        // Scroll to pan
        setPan(panX - e.deltaX, panY - e.deltaY);
      }
    },
    [zoom, panX, panY, setZoom, setPan, containerRef]
  );

  const handleSpaceDrag = useCallback(
    (dx: number, dy: number) => {
      setPan(panX + dx, panY + dy);
      setIsPanning(true);
    },
    [panX, panY, setPan]
  );

  // Reset panning state when mouse is released
  useEffect(() => {
    const handleMouseUp = () => setIsPanning(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  return { handleWheel, handleSpaceDrag, isPanning };
}
