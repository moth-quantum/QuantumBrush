import { FloatingPanel } from "../common/FloatingPanel";
import { useStore } from "../../store";
import { Eye, Trash2 } from "lucide-react";
import type { CanvasPath } from "../../store/slices/canvasSlice";

interface LayersPanelProps {
  onClose: () => void;
}

const toolLabel: Record<string, string> = {
  brush: "Brush Stroke",
  line: "Line Stroke",
  dot: "Dot",
  eraser: "Eraser",
};

/** Generate a short hex-like ID from the path index + first point */
function shortId(path: CanvasPath, index: number): string {
  const x = path.clickPoint[0] | 0;
  const y = path.clickPoint[1] | 0;
  const hash = ((index * 2654435761) ^ (x * 73856093) ^ (y * 19349663)) >>> 0;
  return hash.toString(16).slice(-5);
}

export function LayersPanel({ onClose }: LayersPanelProps) {
  const { paths, removePath, clearPaths } = useStore();

  return (
    <FloatingPanel title="Layers" onClose={onClose} width={240}>
      {paths.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          No strokes yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {paths.map((path, i) => {
            const label = toolLabel[path.tool] || "Stroke";
            const id = shortId(path, i);

            return (
              <div
                key={i}
                className="flex items-center rounded"
                style={{
                  padding: "6px 8px",
                  gap: 8,
                  background: "transparent",
                }}
              >
                {/* Color swatch */}
                <div
                  className="flex-shrink-0"
                  style={{
                    width: 20,
                    height: 20,
                    background: path.color,
                    borderRadius: 4,
                    border: "1px solid var(--color-border)",
                  }}
                />

                {/* Label + ID */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {label}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {id}
                  </div>
                </div>

                {/* Actions */}
                <button
                  className="flex-shrink-0"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Toggle visibility"
                >
                  <Eye size={14} />
                </button>
                <button
                  className="flex-shrink-0"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Delete"
                  onClick={() => removePath(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {paths.length > 0 && (
        <>
          <div
            style={{
              borderTop: "1px solid var(--color-border)",
              margin: "8px 0",
            }}
          />
          <button
            className="w-full text-xs font-medium rounded"
            style={{
              padding: "6px 0",
              color: "var(--color-error)",
              border: "1px solid var(--color-error)",
              background: "transparent",
              cursor: "pointer",
            }}
            onClick={clearPaths}
          >
            <Trash2
              size={12}
              style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}
            />
            Delete All Layers
          </button>
        </>
      )}
    </FloatingPanel>
  );
}
