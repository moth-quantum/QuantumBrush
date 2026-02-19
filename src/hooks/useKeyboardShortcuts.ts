import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboardShortcuts() {
  const {
    zoom,
    setZoom,
    currentImage,
    undoStack,
    redoStack,
    popUndo,
    popRedo,
    pushUndo,
    pushRedo,
    setCurrentImage,
  } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "=") {
        e.preventDefault();
        setZoom(zoom * 1.25);
      } else if (ctrl && e.key === "-") {
        e.preventDefault();
        setZoom(zoom / 1.25);
      } else if (ctrl && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      } else if (ctrl && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        // Redo
        if (redoStack.length > 0 && currentImage) {
          pushUndo(currentImage);
          const next = popRedo();
          if (next) setCurrentImage(next);
        }
      } else if (ctrl && e.key === "z") {
        e.preventDefault();
        // Undo
        if (undoStack.length > 0 && currentImage) {
          pushRedo(currentImage);
          const prev = popUndo();
          if (prev) setCurrentImage(prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    zoom,
    setZoom,
    currentImage,
    undoStack,
    redoStack,
    popUndo,
    popRedo,
    pushUndo,
    pushRedo,
    setCurrentImage,
  ]);
}
