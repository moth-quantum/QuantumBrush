import type { StateCreator } from "zustand";

export type ToolType = "brush" | "line" | "dot" | "eraser";

export interface CanvasPath {
  points: [number, number][];
  clickPoint: [number, number];
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
}

export interface CanvasSlice {
  // Tool state
  activeTool: ToolType;
  strokeColor: string;
  strokeSize: number;
  strokeOpacity: number;
  // Paths
  paths: CanvasPath[];
  currentPath: CanvasPath | null;
  zoom: number;
  panX: number;
  panY: number;
  imageWidth: number;
  imageHeight: number;
  // Undo/redo
  undoStack: string[];
  redoStack: string[];
  // Actions
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeSize: (size: number) => void;
  setStrokeOpacity: (opacity: number) => void;
  addPath: (path: CanvasPath) => void;
  setCurrentPath: (path: CanvasPath | null) => void;
  clearPaths: () => void;
  removePath: (index: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setImageDimensions: (width: number, height: number) => void;
  pushUndo: (image: string) => void;
  popUndo: () => string | undefined;
  pushRedo: (image: string) => void;
  popRedo: () => string | undefined;
  clearRedo: () => void;
}

const MAX_UNDO = 20;

export const createCanvasSlice: StateCreator<CanvasSlice> = (set, get) => ({
  activeTool: "brush",
  strokeColor: "#3b82f6",
  strokeSize: 4,
  strokeOpacity: 1,
  paths: [],
  currentPath: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  imageWidth: 0,
  imageHeight: 0,
  undoStack: [],
  redoStack: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: Math.max(1, Math.min(200, size)) }),
  setStrokeOpacity: (opacity) => set({ strokeOpacity: Math.max(0, Math.min(1, opacity)) }),
  addPath: (path) =>
    set((state) => ({ paths: [...state.paths, path] })),
  setCurrentPath: (path) => set({ currentPath: path }),
  clearPaths: () => set({ paths: [], currentPath: null }),
  removePath: (index) =>
    set((state) => ({
      paths: state.paths.filter((_, i) => i !== index),
    })),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setImageDimensions: (width, height) =>
    set({ imageWidth: width, imageHeight: height }),
  pushUndo: (image) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), image],
    })),
  popUndo: () => {
    const stack = get().undoStack;
    if (stack.length === 0) return undefined;
    const last = stack[stack.length - 1];
    set({ undoStack: stack.slice(0, -1) });
    return last;
  },
  pushRedo: (image) =>
    set((state) => ({ redoStack: [...state.redoStack, image] })),
  popRedo: () => {
    const stack = get().redoStack;
    if (stack.length === 0) return undefined;
    const last = stack[stack.length - 1];
    set({ redoStack: stack.slice(0, -1) });
    return last;
  },
  clearRedo: () => set({ redoStack: [] }),
});
