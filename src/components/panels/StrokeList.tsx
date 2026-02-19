import { useStore } from "../../store";
import { Circle, CheckCircle, XCircle, Loader, Clock } from "lucide-react";

const statusIcons: Record<string, { icon: typeof Circle; color: string }> = {
  completed: { icon: CheckCircle, color: "text-success" },
  failed: { icon: XCircle, color: "text-error" },
  running: { icon: Loader, color: "text-running" },
  pending: { icon: Clock, color: "text-pending" },
  canceled: { icon: XCircle, color: "text-text-muted" },
};

export function StrokeList() {
  const { strokes, selectedStroke, setSelectedStroke, effects } = useStore();

  if (strokes.length === 0) {
    return (
      <p className="text-xs text-text-muted">
        No strokes yet. Draw a path and create a stroke to get started.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {strokes.map((stroke) => {
        const isSelected = selectedStroke?.stroke_id === stroke.stroke_id;
        const statusDef = statusIcons[stroke.processing_status] || statusIcons.pending;
        const StatusIcon = statusDef.icon;
        const effectName =
          effects.find((e) => e.id === stroke.effect_id)?.name || stroke.effect_id;

        return (
          <button
            key={stroke.stroke_id}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
              isSelected
                ? "bg-accent/20 border border-accent/40"
                : "hover:bg-bg-hover border border-transparent"
            }`}
            onClick={() => setSelectedStroke(isSelected ? null : stroke)}
          >
            <StatusIcon
              size={14}
              className={`flex-shrink-0 ${statusDef.color} ${
                stroke.processing_status === "running" ? "animate-spin" : ""
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-text-primary">{effectName}</div>
              <div className="truncate text-text-muted">
                {stroke.stroke_id.replace("stroke_", "#")}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
