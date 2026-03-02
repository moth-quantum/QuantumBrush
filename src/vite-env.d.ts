/// <reference types="vite/client" />

interface ElectronAPI {
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
  off: (channel: string, listener: (...args: unknown[]) => void) => void;
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

  // Python environment
  checkPython: () => Promise<{ success: boolean; data?: { available: boolean; version?: string; missing?: string[] }; error?: string }>;
  installPackages: (packages: string[]) => Promise<{ success: boolean; error?: string }>;

  // Effects
  loadEffects: () => Promise<{ success: boolean; data?: import('./types').EffectDefinition[]; error?: string }>;
  runEffect: (payload: {
    projectId: string;
    strokeId: string;
    effectId: string;
    userInput: Record<string, unknown>;
    strokeInput: { path: number[][]; clicks: number[][] };
    canvasImageDataUrl: string;
  }) => Promise<{ success: boolean; data?: { outputImageDataUrl: string }; error?: string }>;

  // Projects
  createProject: (name: string, width: number, height: number) => Promise<{ success: boolean; data?: import('./types').ProjectMeta; error?: string }>;
  listProjects: () => Promise<{ success: boolean; data?: import('./types').ProjectMeta[]; error?: string }>;
  openProject: (projectId: string) => Promise<{ success: boolean; data?: { meta: import('./types').ProjectMeta; canvasJson?: string }; error?: string }>;
  saveProject: (projectId: string, canvasJson: string) => Promise<{ success: boolean; error?: string }>;
  saveProjectAs: (sourceProjectId: string, newName: string, canvasJson: string) => Promise<{ success: boolean; data?: import('./types').ProjectMeta; error?: string }>;
  deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;

  // File-based save/open
  saveToFile: (projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) => Promise<{ success: boolean; data?: { filePath: string; name: string }; error?: string }>;
  saveToFilePath: (filePath: string, projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) => Promise<{ success: boolean; error?: string }>;
  openFromFile: () => Promise<{ success: boolean; data?: { meta: import('./types').ProjectMeta; canvasJson?: string; filePath: string }; error?: string }>;

  // Files
  importImage: () => Promise<{ success: boolean; data?: { dataUrl: string; name: string }; error?: string }>;
  exportImage: (dataUrl: string) => Promise<{ success: boolean; error?: string }>;

  // SVG
  saveStrokeSvg: (projectId: string, strokeId: string, svgData: string) => Promise<{ success: boolean; error?: string }>;
  exportSvg: (svgString: string) => Promise<{ success: boolean; error?: string }>;
  importSvg: () => Promise<{ success: boolean; data?: { svgString: string; name: string }; error?: string }>;
}

interface Window {
  ipcRenderer: ElectronAPI;
}
