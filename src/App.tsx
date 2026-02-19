import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/layout/AppShell";
import { useStore } from "./store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import * as api from "./lib/tauriApi";

function App() {
  const [serverStatus, setServerStatus] = useState<
    "starting" | "running" | "error"
  >("starting");
  const [serverError, setServerError] = useState<string | null>(null);

  const { setEffects, updateStroke } = useStore();

  // Register keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+/-/0)
  useKeyboardShortcuts();

  // Initialize app
  useEffect(() => {
    async function init() {
      try {
        // Start Python server
        try {
          await api.startPythonServer();
          setServerStatus("running");
        } catch (e) {
          console.warn("Python server start failed:", e);
          setServerStatus("error");
          setServerError(String(e));
        }

        // Load effects
        try {
          const effects = await api.loadEffects();
          setEffects(effects);
        } catch (e) {
          console.warn("Failed to load effects:", e);
        }
      } catch (e) {
        console.error("Init error:", e);
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      api.stopPythonServer().catch(console.warn);
    };
  }, []);

  // Listen for stroke completion events
  useEffect(() => {
    const unlisten = listen<{
      stroke_id: string;
      project_id: string;
      success: boolean;
      error?: string;
    }>("stroke-completed", (event) => {
      const { stroke_id, success } = event.payload;
      updateStroke(stroke_id, {
        processing_status: success ? "completed" : "failed",
        has_output: success,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateStroke]);

  return (
    <div className="h-full flex flex-col bg-bg-primary text-text-primary">
      <AppShell serverStatus={serverStatus} serverError={serverError} />
    </div>
  );
}

export default App;
