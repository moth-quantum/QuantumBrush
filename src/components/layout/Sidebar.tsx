import { ControlPanel } from "../panels/ControlPanel";
import { StrokePanel } from "../panels/StrokePanel";

export function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <ControlPanel />
      <div className="border-t border-border" />
      <StrokePanel />
    </div>
  );
}
