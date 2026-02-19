import { open, save } from "@tauri-apps/plugin-dialog";
import { useStore } from "../../store";
import * as api from "../../lib/tauriApi";
import { Plus, Download, Upload } from "lucide-react";

interface MenuBarProps {
  serverStatus: "starting" | "running" | "error";
  panels: { tools: boolean; properties: boolean; layers: boolean };
  togglePanel: (panel: "tools" | "properties" | "layers") => void;
}

export function MenuBar({ serverStatus, panels, togglePanel }: MenuBarProps) {
  const {
    currentProject,
    setCurrentProject,
    setCurrentImage,
    setStrokes,
    clearPaths,
  } = useStore();

  const handleNewProject = async () => {
    const filePath = await open({
      title: "Select Image",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif"] }],
    });
    if (!filePath) return;

    const name = (filePath as string).split("/").pop()?.replace(/\.[^.]+$/, "") || "Untitled";
    try {
      const project = await api.newProject(name, filePath as string);
      setCurrentProject(project);
      const image = await api.getCurrentImage(project.project_id);
      setCurrentImage(image);
      clearPaths();
      setStrokes([]);
    } catch (e) {
      console.error("Failed to create project:", e);
    }
  };

  const handleImport = async () => {
    const filePath = await open({
      title: "Import Image",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif"] }],
    });
    if (!filePath) return;

    const name = (filePath as string).split("/").pop()?.replace(/\.[^.]+$/, "") || "Untitled";
    try {
      const project = await api.newProject(name, filePath as string);
      setCurrentProject(project);
      const image = await api.getCurrentImage(project.project_id);
      setCurrentImage(image);
      clearPaths();
      setStrokes([]);
    } catch (e) {
      console.error("Failed to import:", e);
    }
  };

  const handleExport = async () => {
    if (!currentProject) return;
    const filePath = await save({
      title: "Export Image",
      filters: [{ name: "PNG", extensions: ["png"] }],
      defaultPath: `${currentProject.project_name}_export.png`,
    });
    if (!filePath) return;
    try {
      await api.exportImage(currentProject.project_id, filePath);
    } catch (e) {
      console.error("Failed to export:", e);
    }
  };

  return (
    <div
      className="flex items-center h-10 select-none"
      style={{ background: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}
    >
      {/* Logo */}
      <div className="flex items-center px-4" style={{ gap: 6 }}>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "var(--color-accent)" }}
        >
          Q
        </div>
        <span className="text-sm font-bold tracking-wide">
          <span className="text-text-primary">QUANTUM</span>
          <span className="text-text-muted">BRUSH</span>
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5" style={{ background: "var(--color-border)" }} />

      {/* Actions */}
      <div className="flex items-center" style={{ gap: 2, padding: "0 8px" }}>
        <button
          className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          style={{ gap: 5, padding: "4px 10px", borderRadius: 4 }}
          onClick={handleNewProject}
        >
          <Plus size={14} />
          <span className="text-sm">New</span>
        </button>
        <button
          className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          style={{ gap: 5, padding: "4px 10px", borderRadius: 4 }}
          onClick={handleImport}
        >
          <Upload size={14} />
          <span className="text-sm">Import</span>
        </button>
        <button
          className={`flex items-center transition-colors ${
            currentProject ? "text-text-secondary hover:text-text-primary" : "text-text-muted"
          }`}
          style={{ gap: 5, padding: "4px 10px", borderRadius: 4 }}
          onClick={handleExport}
          disabled={!currentProject}
        >
          <Download size={14} />
          <span className="text-sm">Export</span>
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Server status */}
      <div className="flex items-center" style={{ gap: 6, paddingRight: 12 }}>
        <div
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            background:
              serverStatus === "running"
                ? "var(--color-success)"
                : serverStatus === "starting"
                ? "var(--color-warning)"
                : "var(--color-error)",
          }}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-5" style={{ background: "var(--color-border)" }} />

      {/* Panel toggles */}
      <div className="flex items-center" style={{ gap: 4, padding: "0 12px" }}>
        <span className="text-xs text-text-muted" style={{ marginRight: 4 }}>
          Windows:
        </span>
        {(["tools", "properties", "layers"] as const).map((panel) => (
          <button
            key={panel}
            className="text-xs font-medium transition-colors"
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              background: panels[panel] ? "var(--color-accent)" : "var(--color-bg-tertiary)",
              color: panels[panel] ? "#fff" : "var(--color-text-secondary)",
            }}
            onClick={() => togglePanel(panel)}
          >
            {panel.charAt(0).toUpperCase() + panel.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
