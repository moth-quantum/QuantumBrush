import { FloatingPanel } from "../common/FloatingPanel";
import { useStore } from "../../store";
import type { ToolType } from "../../store/slices/canvasSlice";
import { Paintbrush, Minus, Circle, Eraser } from "lucide-react";

interface ToolsPanelProps {
  onClose: () => void;
}

const tools: { id: ToolType; label: string; icon: typeof Paintbrush }[] = [
  { id: "brush", label: "Brush", icon: Paintbrush },
  { id: "line", label: "Line", icon: Minus },
  { id: "dot", label: "Dot", icon: Circle },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

export function ToolsPanel({ onClose }: ToolsPanelProps) {
  const { activeTool, setActiveTool } = useStore();

  return (
    <FloatingPanel title="Tools" onClose={onClose} width={180}>
      <div className="grid grid-cols-4" style={{ gap: 4 }}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeTool;
          return (
            <button
              key={tool.id}
              className="flex flex-col items-center justify-center rounded transition-colors"
              style={{
                padding: "8px 4px",
                background: isActive ? "var(--color-accent)" : "transparent",
                color: isActive ? "#fff" : "var(--color-text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
              title={tool.label}
              onClick={() => setActiveTool(tool.id)}
            >
              <Icon size={18} />
              <span className="text-[10px] mt-1">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </FloatingPanel>
  );
}
