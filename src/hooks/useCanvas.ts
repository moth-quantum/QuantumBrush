import { useCallback } from "react";
import { useStore } from "../store";
import * as api from "../lib/tauriApi";

/** Hook for canvas operations that involve Tauri backend calls */
export function useCanvas() {
  const {
    currentProject,
    currentImage,
    setCurrentImage,
    pushUndo,
    clearRedo,
  } = useStore();

  const applyStroke = useCallback(
    async (strokeId: string) => {
      if (!currentProject) return;

      // Save current image to undo stack before applying
      if (currentImage) {
        pushUndo(currentImage);
        clearRedo();
      }

      try {
        const newImage = await api.applyStroke(
          currentProject.project_id,
          strokeId
        );
        setCurrentImage(newImage);
      } catch (e) {
        console.error("Failed to apply stroke:", e);
      }
    },
    [currentProject, currentImage, setCurrentImage, pushUndo, clearRedo]
  );

  const refreshImage = useCallback(async () => {
    if (!currentProject) return;
    try {
      const image = await api.getCurrentImage(currentProject.project_id);
      setCurrentImage(image);
    } catch (e) {
      console.error("Failed to refresh image:", e);
    }
  }, [currentProject, setCurrentImage]);

  return { applyStroke, refreshImage };
}
