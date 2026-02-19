import { useState } from "react";
import { useStore } from "../../store";
import { ParamField } from "./ParamField";
import * as api from "../../lib/tauriApi";
import { Play, Check, Trash2, X, Save } from "lucide-react";

export function StrokeDetail() {
  const {
    selectedStroke,
    currentProject,
    effects,
    updateStroke,
    removeStroke,
    setSelectedStroke,
    setCurrentImage,
    pushUndo,
    clearRedo,
    currentImage,
  } = useStore();

  const [editedParams, setEditedParams] = useState<Record<string, unknown> | null>(null);

  if (!selectedStroke || !currentProject) return null;

  const effect = effects.find((e) => e.id === selectedStroke.effect_id);
  const params = editedParams || (selectedStroke.user_input as Record<string, unknown>);
  const hasEdits = editedParams !== null;

  const handleRun = async () => {
    try {
      updateStroke(selectedStroke.stroke_id, { processing_status: "running" });
      await api.runStroke(selectedStroke.stroke_id, currentProject.project_id);
    } catch (e) {
      console.error("Failed to run stroke:", e);
      updateStroke(selectedStroke.stroke_id, { processing_status: "failed" });
    }
  };

  const handleApply = async () => {
    try {
      if (currentImage) {
        pushUndo(currentImage);
        clearRedo();
      }
      const newImage = await api.applyStroke(
        currentProject.project_id,
        selectedStroke.stroke_id
      );
      setCurrentImage(newImage);
    } catch (e) {
      console.error("Failed to apply stroke:", e);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteStroke(currentProject.project_id, selectedStroke.stroke_id);
      removeStroke(selectedStroke.stroke_id);
      setSelectedStroke(null);
    } catch (e) {
      console.error("Failed to delete stroke:", e);
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelStroke(currentProject.project_id, selectedStroke.stroke_id);
      updateStroke(selectedStroke.stroke_id, { processing_status: "canceled" });
    } catch (e) {
      console.error("Failed to cancel stroke:", e);
    }
  };

  const handleSaveParams = async () => {
    if (!editedParams) return;
    try {
      await api.updateStrokeParams(
        currentProject.project_id,
        selectedStroke.stroke_id,
        editedParams
      );
      updateStroke(selectedStroke.stroke_id, {
        user_input: editedParams,
        processing_status: "pending",
        has_output: false,
      });
      setEditedParams(null);
    } catch (e) {
      console.error("Failed to save params:", e);
    }
  };

  const status = selectedStroke.processing_status;

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary">
          Stroke Detail
        </h3>
        <button
          className="text-text-muted hover:text-text-primary"
          onClick={() => setSelectedStroke(null)}
        >
          <X size={16} />
        </button>
      </div>

      {/* Effect info */}
      <div className="mb-3">
        <div className="text-sm font-medium">{effect?.name || selectedStroke.effect_id}</div>
        <div className="text-xs text-text-muted mt-0.5">
          {selectedStroke.stroke_id.replace("stroke_", "#")}
        </div>
        <div
          className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
            status === "completed"
              ? "bg-success/20 text-success"
              : status === "failed"
              ? "bg-error/20 text-error"
              : status === "running"
              ? "bg-running/20 text-running"
              : "bg-pending/20 text-pending"
          }`}
        >
          {status}
        </div>
      </div>

      {/* Parameters */}
      {effect && (
        <div className="space-y-2 mb-3">
          <h4 className="text-xs font-semibold text-text-secondary uppercase">Parameters</h4>
          {Object.entries(effect.user_input).map(([key, spec]) => (
            <ParamField
              key={key}
              name={key}
              spec={spec}
              value={params[key]}
              onChange={(val) => {
                setEditedParams({ ...params, [key]: val });
              }}
            />
          ))}
          {hasEdits && (
            <button
              className="w-full py-1.5 px-3 rounded text-xs bg-info/20 text-info hover:bg-info/30 flex items-center justify-center gap-1"
              onClick={handleSaveParams}
            >
              <Save size={12} />
              Save Parameter Changes
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-1.5">
        {(status === "pending" || status === "failed" || status === "canceled") && (
          <button
            className="w-full py-1.5 px-3 rounded text-xs bg-accent hover:bg-accent-hover text-white flex items-center justify-center gap-1"
            onClick={handleRun}
          >
            <Play size={12} />
            Run Effect
          </button>
        )}

        {status === "running" && (
          <button
            className="w-full py-1.5 px-3 rounded text-xs bg-warning/20 text-warning hover:bg-warning/30 flex items-center justify-center gap-1"
            onClick={handleCancel}
          >
            <X size={12} />
            Cancel
          </button>
        )}

        {status === "completed" && selectedStroke.has_output && (
          <button
            className="w-full py-1.5 px-3 rounded text-xs bg-success/20 text-success hover:bg-success/30 flex items-center justify-center gap-1"
            onClick={handleApply}
          >
            <Check size={12} />
            Apply to Canvas
          </button>
        )}

        <button
          className="w-full py-1.5 px-3 rounded text-xs bg-error/20 text-error hover:bg-error/30 flex items-center justify-center gap-1"
          onClick={handleDelete}
        >
          <Trash2 size={12} />
          Delete Stroke
        </button>
      </div>
    </div>
  );
}
