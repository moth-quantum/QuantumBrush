import { useCallback, useEffect, useRef, useState } from "react";
import { BrushPanel } from "./components/BrushPanel";
import { Canvas } from "./components/Canvas";
import { StrokePanel } from "./components/StrokePanel";
import {
  checkApiHealth,
  createProjectFromImage,
  createProjectFromUpload,
  deleteProject,
  fileToBase64,
  getAppInfo,
  getConfiguredApiBase,
  getRuntimeMode,
  listEffects,
  listProjects,
  listStrokes,
  openProject,
  pickAndExportProject,
} from "./api/client";
import { useAppStore } from "./store/useAppStore";
import "./App.css";

/** Track canvas-area size for Konva Stage (ResizeObserver). */
function useLayoutSize() {
  const [size, setSize] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const el = document.querySelector(".canvas-area");
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return size;
}

/**
 * Main application shell — three-window layout from legacy Quantum Brush:
 * Control Panel | Canvas | Stroke Manager.
 */
export default function App() {
  const appInfo = useAppStore((s) => s.appInfo);
  const effects = useAppStore((s) => s.effects);
  const projects = useAppStore((s) => s.projects);
  const strokes = useAppStore((s) => s.strokes);
  const projectId = useAppStore((s) => s.projectId);
  const projectName = useAppStore((s) => s.projectName);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const setAppInfo = useAppStore((s) => s.setAppInfo);
  const setEffects = useAppStore((s) => s.setEffects);
  const setProjects = useAppStore((s) => s.setProjects);
  const setStrokes = useAppStore((s) => s.setStrokes);
  const setProject = useAppStore((s) => s.setProject);
  const clearProject = useAppStore((s) => s.clearProject);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const clearPaths = useAppStore((s) => s.clearPaths);
  const [showProjects, setShowProjects] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const runtimeMode = getRuntimeMode();
  const apiBase = getConfiguredApiBase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canvasSize = useLayoutSize();

  const refreshStrokes = useCallback(async () => {
    if (!projectId) return;
    const data = await listStrokes(projectId);
    setStrokes(data);
  }, [projectId, setStrokes]);

  // Bootstrap: resolve QUANTUMBRUSH_ROOT, list effects/projects
  const bootstrap = useCallback(async () => {
    try {
      if (runtimeMode === "web") {
        const ok = await checkApiHealth();
        setApiOnline(ok);
        if (!ok) {
          setStatusMessage(
            apiBase
              ? `API offline at ${apiBase} — check Render/Railway deploy`
              : "API offline — local: npm run dev:web · Vercel: set VITE_API_URL",
          );
          return;
        }
      }

      const info = await getAppInfo();
      setAppInfo(info);
      const [fx, pr] = await Promise.all([listEffects(), listProjects()]);
      setEffects(fx);
      setProjects(pr);
      setStatusMessage(
        runtimeMode === "web"
          ? `Ready · API ${apiBase || "localhost proxy"}`
          : "Ready",
      );
    } catch (e) {
      setApiOnline(false);
      setStatusMessage(`Backend error: ${e}`);
    }
  }, [setAppInfo, setEffects, setProjects, setStatusMessage, runtimeMode, apiBase]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const finishNewProject = async (name: string, file: File | string) => {
    try {
      let created;
      if (typeof file === "string") {
        created = await createProjectFromImage(name, file);
      } else {
        const b64 = await fileToBase64(file);
        created = await createProjectFromUpload(name, b64);
      }
      setProject(created.project_id, created.project_name, created.image_path);
      setProjects(await listProjects());
      setStrokes([]);
      clearPaths();
      setShowProjects(false);
      setStatusMessage(`Project created: ${name}`);
    } catch (e) {
      setStatusMessage(`New project failed: ${e}`);
    }
  };

  const handleNewProject = async () => {
    // Tauri: native file dialog; browser: hidden <input type="file">
    if (runtimeMode === "tauri") {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (!file || typeof file !== "string") return;
      const baseName =
        file.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "Untitled";
      const name = window.prompt("Project name", baseName);
      if (!name) return;
      await finishNewProject(name, file);
      return;
    }

    fileInputRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "Untitled";
    const name = window.prompt("Project name", baseName);
    if (!name) return;
    await finishNewProject(name, file);
  };

  const handleOpenProject = async (id: string) => {
    try {
      const opened = await openProject(id);
      const meta = projects.find((p) => p.project_id === id);
      setProject(id, meta?.project_name ?? id, opened.image_path);
      const st = await listStrokes(id);
      setStrokes(st);
      clearPaths();
      setShowProjects(false);
      setStatusMessage(`Opened: ${meta?.project_name ?? id}`);
    } catch (e) {
      setStatusMessage(`Open failed: ${e}`);
    }
  };

  const handleExport = async () => {
    if (!projectId) return;
    try {
      await pickAndExportProject(
        projectId,
        `${projectName ?? "quantum_brush"}.png`,
      );
      setStatusMessage("Image exported");
    } catch (e) {
      setStatusMessage(`Export failed: ${e}`);
    }
  };

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden-input"
        onChange={onFilePicked}
      />

      {runtimeMode === "web" && apiOnline === false && (
        <div className="dev-banner">
          {apiBase ? (
            <>
              Python API unreachable at <code>{apiBase}</code>. Deploy backend
              (Dockerfile.api) on Render/Railway, then set{" "}
              <code>VITE_API_URL</code> in Vercel.
            </>
          ) : (
            <>
              Local: run <code>npm run dev:web</code>. Vercel: set{" "}
              <code>VITE_API_URL</code> to your hosted Python API (UI only on
              Vercel).
            </>
          )}
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◈
          </span>
          <div>
            <h1>
              Quantum Brush
              {projectName && (
                <span className="project-chip" title={projectName}>
                  {projectName}
                </span>
              )}
            </h1>
            <p className="brand-tagline">
              {runtimeMode === "tauri" ? "Desktop · Tauri" : "Browser · Python API"}
            </p>
          </div>
        </div>
        <nav className="topbar-actions">
          <button type="button" className="btn" onClick={handleNewProject}>
            New project
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setShowProjects((v) => !v)}
          >
            Open project
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleExport}
            disabled={!projectId}
          >
            Export
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={clearPaths}
            disabled={!projectId}
          >
            Clear paths
          </button>
        </nav>
      </header>

      {showProjects && (
        <div className="project-drawer">
          <h3>Projects</h3>
          <ul>
            {projects.map((p) => (
              <li key={p.project_id}>
                <button
                  type="button"
                  onClick={() => handleOpenProject(p.project_id)}
                >
                  <strong>{p.project_name}</strong>
                  <span className="muted">{p.status}</span>
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={async () => {
                    await deleteProject(p.project_id);
                    if (projectId === p.project_id) clearProject();
                    setProjects(await listProjects());
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {!projects.length && <p className="muted">No projects yet</p>}
        </div>
      )}

      <main className="workspace">
        <BrushPanel effects={effects} />
        <section className="canvas-area">
          <Canvas width={canvasSize.w} height={canvasSize.h} />
        </section>
        <StrokePanel
          strokes={strokes}
          effects={effects}
          onRefresh={refreshStrokes}
        />
      </main>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        {appInfo && (
          <span className="statusbar-path mono muted" title={appInfo.root}>
            root: {appInfo.root_exists ? "✓" : "✗"} {appInfo.root} · python:{" "}
            {appInfo.python}
          </span>
        )}
      </footer>
    </div>
  );
}
