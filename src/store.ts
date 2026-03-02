import { create } from 'zustand';
import type { Tool, EffectDefinition, StrokeRecord, ProjectMeta } from './types';

const MAX_UNDO = 20;

interface AppState {
  // Tools
  currentTool: Tool;
  brushWidth: number;
  brushColor: string;
  brushOpacity: number;

  // Effects
  availableEffects: EffectDefinition[];
  currentEffect: EffectDefinition | null;
  effectParams: Record<string, unknown>;

  // Project
  currentProject: ProjectMeta | null;
  projectFilePath: string | null;

  // Strokes
  strokes: StrokeRecord[];

  // Canvas (non-reactive — stored outside React render cycle)
  _canvasInstance: unknown | null;

  // Collected path/click data for the current stroke
  currentPaths: number[][][];
  currentClicks: number[][];

  // Undo / Redo (JSON snapshots of canvas state)
  undoStack: string[];
  redoStack: string[];

  // Zoom
  zoomLevel: number;

  // Python package management
  missingPackages: string[] | null;

  // UI toggles
  strokeManagerOpen: boolean;
  projectDialogOpen: boolean;
  projectDialogMode: 'new' | 'open' | null;
  notification: { message: string; type: 'info' | 'error' | 'success' } | null;

  // Actions
  setTool: (tool: Tool) => void;
  setBrushWidth: (width: number) => void;
  setBrushColor: (color: string) => void;
  setBrushOpacity: (opacity: number) => void;
  setCurrentEffect: (effect: EffectDefinition | null) => void;
  setEffectParam: (key: string, value: unknown) => void;
  loadEffects: (effects: EffectDefinition[]) => void;
  addStroke: (stroke: StrokeRecord) => void;
  updateStroke: (id: string, updates: Partial<StrokeRecord>) => void;
  removeStroke: (id: string) => void;
  reapplyStroke: (id: string) => void;
  setProject: (project: ProjectMeta | null) => void;
  setProjectFilePath: (filePath: string | null) => void;
  setCanvasInstance: (canvas: unknown) => void;
  addPath: (path: number[][]) => void;
  addClick: (point: number[]) => void;
  clearCurrentStrokeData: () => void;
  pushUndoState: (json: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  setZoomLevel: (level: number) => void;
  setMissingPackages: (packages: string[]) => void;
  toggleStrokeManager: () => void;
  openProjectDialog: (mode: 'new' | 'open') => void;
  closeProjectDialog: () => void;
  notify: (message: string, type: 'info' | 'error' | 'success') => void;
  clearNotification: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentTool: 'brush',
  brushWidth: 5,
  brushColor: '#000000',
  brushOpacity: 100,

  availableEffects: [],
  currentEffect: null,
  effectParams: {},

  currentProject: null,
  projectFilePath: null,

  strokes: [],

  _canvasInstance: null,
  currentPaths: [],
  currentClicks: [],

  undoStack: [],
  redoStack: [],

  zoomLevel: 1,

  missingPackages: null,

  strokeManagerOpen: false,
  projectDialogOpen: false,
  projectDialogMode: null,
  notification: null,

  // Actions
  setTool: (tool) => set({ currentTool: tool }),
  setBrushWidth: (width) => set({ brushWidth: width }),
  setBrushColor: (color) => set({ brushColor: color }),
  setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),

  setCurrentEffect: (effect) => {
    if (effect) {
      const params: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(effect.user_input)) {
        params[key] = def.default;
      }
      set({ currentEffect: effect, effectParams: params });
    } else {
      set({ currentEffect: null, effectParams: {} });
    }
  },

  setEffectParam: (key, value) =>
    set((state) => ({ effectParams: { ...state.effectParams, [key]: value } })),

  loadEffects: (effects) => set({ availableEffects: effects }),

  addStroke: (stroke) => set((state) => ({ strokes: [...state.strokes, stroke] })),

  updateStroke: (id, updates) =>
    set((state) => ({
      strokes: state.strokes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  removeStroke: (id) =>
    set((state) => ({
      strokes: state.strokes.filter((s) => s.id !== id),
    })),

  reapplyStroke: (id) => {
    const { strokes, currentProject, updateStroke: update, notify: n } = get();
    const stroke = strokes.find((s) => s.id === id);
    if (!stroke || !currentProject) return;

    update(id, { status: 'running', error: undefined });
    const canvas = get()._canvasInstance as any;
    if (!canvas) return;

    const canvasDataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
    // Snapshot canvas before applying so before/after comparison works
    const beforeCanvasJson = JSON.stringify(canvas.toJSON());
    update(id, { beforeCanvasJson });

    window.ipcRenderer
      .runEffect({
        projectId: currentProject.id,
        strokeId: stroke.id,
        effectId: stroke.effectId,
        userInput: stroke.params as Record<string, unknown>,
        strokeInput: { path: stroke.pathData, clicks: stroke.clickData },
        canvasImageDataUrl: canvasDataUrl,
      })
      .then((result: any) => {
        if (result.success && result.data) {
          update(id, { status: 'completed', resultDataUrl: result.data.outputImageDataUrl });
          window.dispatchEvent(
            new CustomEvent('qb:load-effect-output', {
              detail: { dataUrl: result.data.outputImageDataUrl },
            })
          );
          n('Effect re-applied successfully', 'success');
        } else {
          update(id, { status: 'failed', error: result.error });
          n('Effect failed: ' + result.error, 'error');
        }
      })
      .catch((err: any) => {
        const msg = err instanceof Error ? err.message : String(err);
        update(id, { status: 'failed', error: msg });
        n('Effect error: ' + msg, 'error');
      });
  },

  setProject: (project) => set({ currentProject: project }),
  setProjectFilePath: (filePath) => set({ projectFilePath: filePath }),
  setCanvasInstance: (canvas) => set({ _canvasInstance: canvas }),

  addPath: (path) => set((state) => ({ currentPaths: [...state.currentPaths, path] })),
  addClick: (point) => set((state) => ({ currentClicks: [...state.currentClicks, point] })),
  clearCurrentStrokeData: () => set({ currentPaths: [], currentClicks: [] }),

  pushUndoState: (json) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-(MAX_UNDO - 1)), json],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length < 2) return null;
    const current = undoStack[undoStack.length - 1];
    const previous = undoStack[undoStack.length - 2];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, current],
    }));
    return previous;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const next = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, next],
    }));
    return next;
  },

  setZoomLevel: (level) => set({ zoomLevel: level }),
  setMissingPackages: (packages) => set({ missingPackages: packages.length > 0 ? packages : null }),
  toggleStrokeManager: () => set((state) => ({ strokeManagerOpen: !state.strokeManagerOpen })),
  openProjectDialog: (mode) => set({ projectDialogOpen: true, projectDialogMode: mode }),
  closeProjectDialog: () => set({ projectDialogOpen: false, projectDialogMode: null }),

  notify: (message, type) => set({ notification: { message, type } }),
  clearNotification: () => set({ notification: null }),
}));
