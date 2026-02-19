import { EffectSelector } from "./EffectSelector";
import { ParameterForm } from "./ParameterForm";
import { useStore } from "../../store";
import * as api from "../../lib/tauriApi";
import { Paintbrush } from "lucide-react";

export function ControlPanel() {
  const {
    selectedEffect,
    paramValues,
    paths,
    currentProject,
    addStroke,
    clearPaths,
  } = useStore();

  const canCreate = selectedEffect && paths.length > 0 && currentProject;

  const handleCreate = async () => {
    if (!selectedEffect || !currentProject || paths.length === 0) return;

    const pathArrays = paths.map((p) => p.points);
    const clicks = paths.map((p) => p.clickPoint);

    try {
      const stroke = await api.createStroke(
        currentProject.project_id,
        selectedEffect.id,
        paramValues as Record<string, unknown>,
        pathArrays,
        clicks
      );

      addStroke(stroke);
      clearPaths();

      // Auto-run the stroke
      await api.runStroke(stroke.stroke_id, currentProject.project_id);
      // Update status to running
      useStore.getState().updateStroke(stroke.stroke_id, {
        processing_status: "running",
      });
    } catch (e) {
      console.error("Failed to create/run stroke:", e);
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Paintbrush size={16} className="text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Effects
        </h2>
      </div>

      <EffectSelector />

      {selectedEffect && <ParameterForm />}

      <button
        className={`w-full mt-3 py-2 px-4 rounded text-sm font-medium transition-colors ${
          canCreate
            ? "bg-accent hover:bg-accent-hover text-white"
            : "bg-bg-hover text-text-muted cursor-not-allowed"
        }`}
        disabled={!canCreate}
        onClick={handleCreate}
      >
        Create Stroke
      </button>

      {paths.length > 0 && (
        <button
          className="w-full mt-1.5 py-1.5 px-4 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          onClick={clearPaths}
        >
          Clear Paths ({paths.length})
        </button>
      )}
    </div>
  );
}
