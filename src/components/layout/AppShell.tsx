import { useState } from "react";
import { MenuBar } from "./MenuBar";
import { CanvasView } from "../canvas/CanvasView";
import { ToolsPanel } from "../panels/ToolsPanel";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { LayersPanel } from "../panels/LayersPanel";
import { useStore } from "../../store";

interface AppShellProps {
  serverStatus: "starting" | "running" | "error";
  serverError: string | null;
}

export function AppShell({ serverStatus, serverError }: AppShellProps) {
  const { currentProject } = useStore();
  const [panels, setPanels] = useState({
    tools: true,
    properties: true,
    layers: true,
  });

  const togglePanel = (panel: "tools" | "properties" | "layers") => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  return (
    <>
      <MenuBar serverStatus={serverStatus} panels={panels} togglePanel={togglePanel} />

      <div className="flex-1 relative overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
        {/* Canvas fills the entire area */}
        {currentProject ? (
          <CanvasView />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-lg text-text-secondary" style={{ marginBottom: 8 }}>
                Welcome to QuantumBrush
              </p>
              <p className="text-sm text-text-muted">
                Click <strong>+ New</strong> to get started
              </p>
              {serverStatus === "error" && serverError && (
                <p className="text-sm mt-4" style={{ color: "var(--color-error)", maxWidth: 400 }}>
                  Python server error: {serverError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Floating panels positioned over the canvas */}
        {panels.tools && (
          <div className="absolute" style={{ top: 12, left: 12 }}>
            <ToolsPanel onClose={() => togglePanel("tools")} />
          </div>
        )}

        {panels.properties && (
          <div className="absolute" style={{ top: panels.tools ? 120 : 12, left: 12 }}>
            <PropertiesPanel onClose={() => togglePanel("properties")} />
          </div>
        )}

        {panels.layers && (
          <div className="absolute" style={{ top: 12, right: 12 }}>
            <LayersPanel onClose={() => togglePanel("layers")} />
          </div>
        )}
      </div>
    </>
  );
}
