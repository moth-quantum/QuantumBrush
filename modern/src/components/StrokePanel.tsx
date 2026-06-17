import { useState } from "react";
import { resolveImageUrl } from "../lib/imageUrl";
import {
  createStroke,
  deleteStroke,
  openProject,
  runStroke,
  saveProjectImage,
} from "../api/client";
import { blendImages } from "../lib/images";
import { validateStrokePaths } from "../lib/strokeValidation";
import { useAppStore } from "../store/useAppStore";
import type { EffectSummary, StrokeSummary } from "../types";

interface Props {
  strokes: StrokeSummary[];
  effects: EffectSummary[];
  onRefresh: () => void;
}

function statusClass(status: string) {
  if (status === "completed") return "status-ok";
  if (status === "running") return "status-run";
  if (status === "failed" || status === "canceled") return "status-err";
  return "status-pending";
}

/**
 * Stroke Manager window — create strokes, run Python effects, apply results.
 */
export function StrokePanel({ strokes, effects, onRefresh }: Props) {
  const projectId = useAppStore((s) => s.projectId);
  const selectedStrokeId = useAppStore((s) => s.selectedStrokeId);
  const selectedEffectId = useAppStore((s) => s.selectedEffectId);
  const parameters = useAppStore((s) => s.parameters);
  const setSelectedStrokeId = useAppStore((s) => s.setSelectedStrokeId);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const setProject = useAppStore((s) => s.setProject);
  const projectName = useAppStore((s) => s.projectName);
  const paths = useAppStore((s) => s.paths);
  const clearPaths = useAppStore((s) => s.clearPaths);
  const [panelError, setPanelError] = useState<string | null>(null);

  const selected = strokes.find((s) => s.stroke_id === selectedStrokeId);
  const effect = effects.find((e) => e.id === selectedEffectId);

  const handleCreate = async () => {
    setPanelError(null);
    if (!projectId || !selectedEffectId || paths.length === 0) {
      setPanelError("Draw on canvas and pick a brush in Control Panel first.");
      return;
    }

    const pathError = validateStrokePaths(selectedEffectId, paths.length);
    if (pathError) {
      setPanelError(pathError);
      return;
    }

    try {
      setStatusMessage("Creating stroke…");
      const strokeId = await createStroke({
        project_id: projectId,
        effect_id: selectedEffectId,
        parameters,
        paths,
      });
      clearPaths();
      setStatusMessage("Stroke created — select it below to Run");
      onRefresh();
      setSelectedStrokeId(strokeId);
    } catch (e) {
      setPanelError(String(e));
      setStatusMessage(`Create failed: ${e}`);
    }
  };

  const handleRun = async (strokeId: string) => {
    if (!projectId) return;
    setPanelError(null);
    setStatusMessage("Running quantum brush (Python)…");
    try {
      const result = await runStroke(projectId, strokeId);
      onRefresh();
      setStatusMessage(result.success ? "Processing completed" : "Processing failed");
    } catch (e) {
      setPanelError(String(e));
      setStatusMessage(`Run error: ${e}`);
    }
  };

  /**
   * Blend stroke output onto current.png (same as StrokeManager.applyEffectToCanvas).
   */
  const handleApply = async (stroke: StrokeSummary) => {
    if (!projectId || stroke.processing_status !== "completed") return;
    try {
      setStatusMessage("Applying effect to canvas…");
      const opened = await openProject(projectId);
      const dataUrl = await blendImages(opened.image_path, stroke.output_path);
      await saveProjectImage(projectId, dataUrl);
      const refreshed = await openProject(projectId);
      setProject(projectId, projectName ?? projectId, refreshed.image_path);
      clearPaths();
      setStatusMessage("Effect applied to canvas");
    } catch (e) {
      setPanelError(String(e));
      setStatusMessage(`Apply error: ${e}`);
    }
  };

  const handleDelete = async (strokeId: string) => {
    if (!projectId) return;
    await deleteStroke(projectId, strokeId);
    if (selectedStrokeId === strokeId) setSelectedStrokeId(null);
    onRefresh();
  };

  const strokeError =
    selected?.processing_status === "failed" ? selected.error_message : null;
  const displayError = panelError || strokeError;

  return (
    <aside className="panel stroke-panel">
      <div className="panel-header">
        <h2>Stroke Manager</h2>
        <button type="button" className="btn ghost small" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="panel-body">
        {!projectId && (
          <p className="muted small">Open a project to manage strokes.</p>
        )}

        {projectId && (
          <section className="create-stroke-block">
            <h3>Create stroke</h3>
            <p className="muted small">
              {paths.length} path(s) on canvas
              {effect ? ` · ${effect.name}` : " · no brush selected"}
            </p>
            {effect?.id === "clone" && paths.length > 0 && paths.length !== 2 && (
              <p className="warn small">
                Collage needs 2 strokes: copy drag, then paste click. Now:{" "}
                {paths.length}
              </p>
            )}
            <button
              type="button"
              className="btn primary block"
              disabled={!selectedEffectId || paths.length === 0}
              onClick={handleCreate}
            >
              Create stroke
            </button>
          </section>
        )}

        {projectId && (
          <>
            <p className="section-label">Strokes</p>
            <ul className="stroke-list">
              {strokes.map((s) => (
                <li
                  key={s.stroke_id}
                  className={
                    s.stroke_id === selectedStrokeId
                      ? "stroke-item active"
                      : "stroke-item"
                  }
                  onClick={() => {
                    setSelectedStrokeId(s.stroke_id);
                    setPanelError(null);
                  }}
                >
                  <strong>{s.effect_name}</strong>
                  <span className={statusClass(s.processing_status)}>
                    {s.processing_status}
                  </span>
                </li>
              ))}
            </ul>
            {!strokes.length && (
              <p className="muted small">No strokes yet.</p>
            )}
          </>
        )}

        {selected && (
          <div className="stroke-detail">
            <p className="mono">{selected.stroke_id}</p>
            <div className="stroke-actions">
              <button
                type="button"
                className="btn"
                onClick={() => handleRun(selected.stroke_id)}
                disabled={selected.processing_status === "running"}
              >
                Run
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => handleApply(selected)}
                disabled={selected.processing_status !== "completed"}
              >
                Apply to canvas
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => handleDelete(selected.stroke_id)}
              >
                Delete
              </button>
            </div>
            <div className="previews">
              <figure>
                <figcaption>Input</figcaption>
                <img
                  src={resolveImageUrl(selected.input_path)}
                  alt="Stroke input"
                />
              </figure>
              <figure>
                <figcaption>Output</figcaption>
                {selected.processing_status === "completed" ? (
                  <img
                    src={resolveImageUrl(selected.output_path)}
                    alt="Stroke output"
                  />
                ) : (
                  <div className="preview-placeholder">Not processed yet</div>
                )}
              </figure>
            </div>
          </div>
        )}

        {displayError && (
          <div className="stroke-error-box" role="alert">
            {displayError}
          </div>
        )}
      </div>
    </aside>
  );
}
