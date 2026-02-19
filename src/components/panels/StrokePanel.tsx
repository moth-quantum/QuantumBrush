import { StrokeList } from "./StrokeList";
import { Layers } from "lucide-react";

export function StrokePanel() {
  return (
    <div className="p-3 flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={16} className="text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Strokes
        </h2>
      </div>
      <StrokeList />
    </div>
  );
}
