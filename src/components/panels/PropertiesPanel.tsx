import { FloatingPanel } from "../common/FloatingPanel";
import { useStore } from "../../store";
import { EffectSelector } from "./EffectSelector";
import { ParamField } from "./ParamField";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import * as api from "../../lib/tauriApi";

interface PropertiesPanelProps {
  onClose: () => void;
}

const colorSwatches = [
  "#ffffff", "#000000", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e",
];

export function PropertiesPanel({ onClose }: PropertiesPanelProps) {
  const {
    selectedEffect,
    paramValues,
    setParamValue,
    strokeColor,
    setStrokeColor,
    strokeSize,
    setStrokeSize,
    strokeOpacity,
    setStrokeOpacity,
  } = useStore();
  const [showPicker, setShowPicker] = useState(false);

  // Find color param if it exists (to sync with effect)
  const colorKey = selectedEffect
    ? Object.keys(selectedEffect.user_input).find(
        (k) => selectedEffect.user_input[k].type === "color"
      )
    : null;
  const colorValue = strokeColor;

  return (
    <FloatingPanel title="Properties" onClose={onClose} width={210}>
      {/* Effect selector */}
      <div style={{ marginBottom: 12 }}>
        <EffectSelector />
      </div>

      {/* Dynamic params (non-color) */}
      {selectedEffect && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(selectedEffect.user_input)
            .filter(([, spec]) => spec.type !== "color")
            .map(([key, spec]) => (
              <ParamField
                key={key}
                name={key}
                spec={spec}
                value={paramValues[key]}
                onChange={(val) => setParamValue(key, val)}
              />
            ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0" }} />

      {/* SIZE */}
      <div style={{ marginBottom: 10 }}>
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 6 }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Size
          </span>
          <span
            className="text-xs font-mono"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: "2px 6px",
              color: "var(--color-text-primary)",
            }}
          >
            {strokeSize}px
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={strokeSize}
          onChange={(e) => setStrokeSize(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* OPACITY */}
      <div style={{ marginBottom: 10 }}>
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 6 }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Opacity
          </span>
          <span
            className="text-xs font-mono"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: "2px 6px",
              color: "var(--color-text-primary)",
            }}
          >
            {Math.round(strokeOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(strokeOpacity * 100)}
          onChange={(e) => setStrokeOpacity(Number(e.target.value) / 100)}
          style={{ width: "100%", accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0" }} />

      {/* Stroke color section */}
      <div>
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ marginBottom: 8, color: "var(--color-text-muted)" }}
        >
          Stroke Color
        </div>

        {/* Swatch grid */}
        <div className="grid grid-cols-6" style={{ gap: 4, marginBottom: 8 }}>
          {colorSwatches.map((c) => (
            <button
              key={c}
              className="rounded transition-transform hover:scale-110"
              style={{
                width: 26,
                height: 26,
                background: c,
                border:
                  c === colorValue
                    ? "2px solid var(--color-accent)"
                    : "2px solid var(--color-border)",
                cursor: "pointer",
              }}
              onClick={() => {
                setStrokeColor(c);
                if (colorKey) setParamValue(colorKey, c);
              }}
            />
          ))}
        </div>

        {/* Hex input + swatch */}
        <div className="flex items-center" style={{ gap: 6 }}>
          <div
            className="rounded flex-shrink-0"
            style={{
              width: 26,
              height: 26,
              background: colorValue,
              border: "2px solid var(--color-border)",
              cursor: "pointer",
            }}
            onClick={() => setShowPicker(!showPicker)}
          />
          <input
            type="text"
            value={colorValue}
            onChange={(e) => {
              if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                setStrokeColor(e.target.value);
                if (colorKey) setParamValue(colorKey, e.target.value);
              }
            }}
            className="flex-1 text-xs font-mono"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: "4px 8px",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
            maxLength={7}
          />
        </div>

        {/* Color picker popup */}
        {showPicker && (
          <div style={{ marginTop: 8 }}>
            <HexColorPicker
              color={colorValue}
              onChange={(c) => {
                setStrokeColor(c);
                if (colorKey) setParamValue(colorKey, c);
              }}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Create stroke button */}
      <CreateStrokeButton />
    </FloatingPanel>
  );
}

function CreateStrokeButton() {
  const { selectedEffect, paramValues, paths, currentProject, addStroke, clearPaths } =
    useStore();

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
      await api.runStroke(stroke.stroke_id, currentProject.project_id);
      useStore.getState().updateStroke(stroke.stroke_id, { processing_status: "running" });
    } catch (e) {
      console.error("Failed to create/run stroke:", e);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="w-full text-sm font-medium rounded transition-colors"
        style={{
          padding: "8px 0",
          background: canCreate ? "var(--color-accent)" : "var(--color-bg-tertiary)",
          color: canCreate ? "#fff" : "var(--color-text-muted)",
          cursor: canCreate ? "pointer" : "not-allowed",
          border: "none",
        }}
        disabled={!canCreate}
        onClick={handleCreate}
      >
        Create Stroke
      </button>
      {paths.length > 0 && (
        <button
          className="w-full text-xs"
          style={{
            marginTop: 4,
            padding: "4px 0",
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
          }}
          onClick={clearPaths}
        >
          Clear Paths ({paths.length})
        </button>
      )}
    </div>
  );
}
