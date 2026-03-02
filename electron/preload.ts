import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...rest) => listener(event, ...rest))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Python environment
  checkPython: () => ipcRenderer.invoke('check-python'),
  installPackages: (packages: string[]) => ipcRenderer.invoke('install-packages', packages),

  // Effects
  loadEffects: () => ipcRenderer.invoke('load-effects'),
  runEffect: (payload: {
    projectId: string;
    strokeId: string;
    effectId: string;
    userInput: Record<string, unknown>;
    strokeInput: { path: number[][]; clicks: number[][] };
    canvasImageDataUrl: string;
  }) => ipcRenderer.invoke('run-effect', payload),

  // Projects
  createProject: (name: string, width: number, height: number) =>
    ipcRenderer.invoke('create-project', name, width, height),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  openProject: (projectId: string) => ipcRenderer.invoke('open-project', projectId),
  saveProject: (projectId: string, canvasJson: string) =>
    ipcRenderer.invoke('save-project', projectId, canvasJson),
  saveProjectAs: (sourceProjectId: string, newName: string, canvasJson: string) =>
    ipcRenderer.invoke('save-project-as', sourceProjectId, newName, canvasJson),
  deleteProject: (projectId: string) => ipcRenderer.invoke('delete-project', projectId),

  // File-based save/open
  saveToFile: (projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) =>
    ipcRenderer.invoke('save-to-file', projectName, canvasJson, canvasWidth, canvasHeight),
  saveToFilePath: (filePath: string, projectName: string, canvasJson: string, canvasWidth: number, canvasHeight: number) =>
    ipcRenderer.invoke('save-to-file-path', filePath, projectName, canvasJson, canvasWidth, canvasHeight),
  openFromFile: () => ipcRenderer.invoke('open-from-file'),

  // Files
  importImage: () => ipcRenderer.invoke('import-image'),
  exportImage: (dataUrl: string) => ipcRenderer.invoke('export-image', dataUrl),

  // SVG
  saveStrokeSvg: (projectId: string, strokeId: string, svgData: string) =>
    ipcRenderer.invoke('save-stroke-svg', projectId, strokeId, svgData),
  exportSvg: (svgString: string) =>
    ipcRenderer.invoke('export-svg', svgString),
  importSvg: () => ipcRenderer.invoke('import-svg'),
})
