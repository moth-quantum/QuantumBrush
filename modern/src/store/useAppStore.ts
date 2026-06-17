import { create } from "zustand";
import type {
  AppInfo,
  DrawPath,
  EffectSummary,
  ProjectMeta,
  StrokeSummary,
} from "../types";

/** Global UI state — mirrors shared fields across Java UIManager / CanvasManager / StrokeManager. */
interface AppStore {
  appInfo: AppInfo | null;
  effects: EffectSummary[];
  projects: ProjectMeta[];
  strokes: StrokeSummary[];
  projectId: string | null;
  projectName: string | null;
  imagePath: string | null;
  paths: DrawPath[];
  selectedEffectId: string | null;
  parameters: Record<string, unknown>;
  selectedStrokeId: string | null;
  statusMessage: string;
  setAppInfo: (info: AppInfo) => void;
  setEffects: (effects: EffectSummary[]) => void;
  setProjects: (projects: ProjectMeta[]) => void;
  setStrokes: (strokes: StrokeSummary[]) => void;
  setProject: (
    projectId: string,
    projectName: string,
    imagePath: string,
  ) => void;
  clearProject: () => void;
  setPaths: (paths: DrawPath[]) => void;
  addPath: (path: DrawPath) => void;
  clearPaths: () => void;
  setSelectedEffectId: (id: string | null) => void;
  setParameter: (key: string, value: unknown) => void;
  setParameters: (params: Record<string, unknown>) => void;
  setSelectedStrokeId: (id: string | null) => void;
  setStatusMessage: (msg: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appInfo: null,
  effects: [],
  projects: [],
  strokes: [],
  projectId: null,
  projectName: null,
  imagePath: null,
  paths: [],
  selectedEffectId: null,
  parameters: {},
  selectedStrokeId: null,
  statusMessage: "Ready",
  setAppInfo: (appInfo) => set({ appInfo }),
  setEffects: (effects) => set({ effects }),
  setProjects: (projects) => set({ projects }),
  setStrokes: (strokes) => set({ strokes }),
  setProject: (projectId, projectName, imagePath) =>
    set({
      projectId,
      projectName,
      imagePath,
      paths: [],
      selectedStrokeId: null,
    }),
  clearProject: () =>
    set({
      projectId: null,
      projectName: null,
      imagePath: null,
      paths: [],
      strokes: [],
      selectedStrokeId: null,
    }),
  setPaths: (paths) => set({ paths }),
  addPath: (path) => set((s) => ({ paths: [...s.paths, path] })),
  clearPaths: () => set({ paths: [] }),
  setSelectedEffectId: (selectedEffectId) => set({ selectedEffectId }),
  setParameter: (key, value) =>
    set((s) => ({ parameters: { ...s.parameters, [key]: value } })),
  setParameters: (parameters) => set({ parameters }),
  setSelectedStrokeId: (selectedStrokeId) => set({ selectedStrokeId }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
