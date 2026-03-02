import { useEffect } from 'react';
import {
  MousePointer2,
  Brush,
  Eraser,
  ImagePlus,
  Download,
  FolderOpen,
  FilePlus,
  Save,
  Layers,
  FileCode2,
} from 'lucide-react';
import { useStore } from '../store';
import type { Tool } from '../types';

const tools: { id: Tool; icon: typeof Brush; label: string; alsoActive?: Tool }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'brush', icon: Brush, label: 'Brush (B) / Dots (D)', alsoActive: 'dot' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
];

const Sidebar = () => {
  const currentTool = useStore((s) => s.currentTool);
  const setTool = useStore((s) => s.setTool);
  const openProjectDialog = useStore((s) => s.openProjectDialog);
  const toggleStrokeManager = useStore((s) => s.toggleStrokeManager);
  const notify = useStore((s) => s.notify);

  const handleImportImage = async () => {
    const result = await window.ipcRenderer.importImage();
    if (result.success && result.data) {
      window.dispatchEvent(
        new CustomEvent('qb:import-image', { detail: { dataUrl: result.data.dataUrl } })
      );
    }
  };

  const handleImportSvg = async () => {
    const result = await window.ipcRenderer.importSvg();
    if (result.success && result.data) {
      window.dispatchEvent(
        new CustomEvent('qb:import-svg', { detail: { svgString: result.data.svgString } })
      );
    }
  };

  const handleExportSvg = async () => {
    const canvas = useStore.getState()._canvasInstance as any;
    if (!canvas) return;
    const svgString = canvas.toSVG();
    const result = await window.ipcRenderer.exportSvg(svgString);
    if (result.success) {
      notify('SVG exported', 'success');
    } else if (result.error !== 'cancelled') {
      notify('SVG export failed: ' + result.error, 'error');
    }
  };

  const handleExport = async () => {
    const canvas = useStore.getState()._canvasInstance as any;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
    const result = await window.ipcRenderer.exportImage(dataUrl);
    if (result.success) {
      notify('Image exported', 'success');
    } else if (result.error !== 'cancelled') {
      notify('Export failed: ' + result.error, 'error');
    }
  };

  const handleSave = async () => {
    const canvas = useStore.getState()._canvasInstance as any;
    const project = useStore.getState().currentProject;
    if (!canvas) {
      notify('Create or open a project first', 'info');
      return;
    }
    const json = JSON.stringify(canvas.toJSON());
    const filePath = useStore.getState().projectFilePath;

    if (filePath) {
      // Re-save to the same file
      const result = await window.ipcRenderer.saveToFilePath(
        filePath,
        project?.name || 'Untitled',
        json,
        canvas.getWidth(),
        canvas.getHeight()
      );
      if (result.success) {
        // Also save internally if project exists
        if (project) {
          await window.ipcRenderer.saveProject(project.id, json);
        }
        notify('Project saved', 'success');
      } else {
        notify('Save failed: ' + result.error, 'error');
      }
    } else {
      // First save — show native save dialog
      const result = await window.ipcRenderer.saveToFile(
        project?.name || 'Untitled',
        json,
        canvas.getWidth(),
        canvas.getHeight()
      );
      if (result.success && result.data) {
        useStore.getState().setProjectFilePath(result.data.filePath);
        // Also save internally if project exists
        if (project) {
          await window.ipcRenderer.saveProject(project.id, json);
        }
        notify('Project saved', 'success');
      } else if (result.error !== 'cancelled') {
        notify('Save failed: ' + result.error, 'error');
      }
    }
  };

  // Listen for menu actions from the main process
  useEffect(() => {
    const handler = (_event: unknown, ...args: unknown[]) => {
      const action = args[0] as string;
      switch (action) {
        case 'new-project':
          openProjectDialog('new');
          break;
        case 'open-project':
          openProjectDialog('open');
          break;
        case 'save':
          handleSave();
          break;
        case 'import-image':
          handleImportImage();
          break;
        case 'export-image':
          handleExport();
          break;
        case 'import-svg':
          handleImportSvg();
          break;
        case 'export-svg':
          handleExportSvg();
          break;
        case 'undo': {
          const canvas = useStore.getState()._canvasInstance as any;
          const undoJson = useStore.getState().undo();
          if (undoJson && canvas) {
            canvas.loadFromJSON(JSON.parse(undoJson)).then(() => {
              const tool = useStore.getState().currentTool;
              if (tool === 'brush') {
                canvas.isDrawingMode = true;
              }
              canvas.renderAll();
            });
          }
          break;
        }
        case 'redo': {
          const canvas2 = useStore.getState()._canvasInstance as any;
          const redoJson = useStore.getState().redo();
          if (redoJson && canvas2) {
            canvas2.loadFromJSON(JSON.parse(redoJson)).then(() => {
              const tool = useStore.getState().currentTool;
              if (tool === 'brush') {
                canvas2.isDrawingMode = true;
              }
              canvas2.renderAll();
            });
          }
          break;
        }
      }
    };

    // Listen for keyboard save events from CanvasArea
    const onSave = () => handleSave();
    window.addEventListener('qb:save', onSave);

    window.ipcRenderer.on('menu-action', handler);
    return () => {
      window.ipcRenderer.off('menu-action', handler as (...args: unknown[]) => void);
      window.removeEventListener('qb:save', onSave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-14 h-full bg-gray-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-3 gap-1">
      {tools.map(({ id, icon: Icon, label, alsoActive }) => {
        const isActive = currentTool === id || currentTool === alsoActive;
        return (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={label}
            className={`p-2 rounded-lg transition-all duration-150 ${
              isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={20} />
          </button>
        );
      })}

      <div className="w-8 border-t border-white/10 my-2" />

      <button
        onClick={handleImportImage}
        title="Import Image"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <ImagePlus size={20} />
      </button>

      <button
        onClick={handleImportSvg}
        title="Import SVG"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <FileCode2 size={20} />
      </button>

      <button
        onClick={handleExport}
        title="Export Image (PNG/JPEG)"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <Download size={20} />
      </button>

      <button
        onClick={handleExportSvg}
        title="Export as SVG"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <FileCode2 size={18} className="relative" />
      </button>

      <div className="w-8 border-t border-white/10 my-2" />

      <button
        onClick={toggleStrokeManager}
        title="Stroke Manager"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <Layers size={20} />
      </button>

      <div className="flex-1" />

      <button
        onClick={() => openProjectDialog('new')}
        title="New Project"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <FilePlus size={20} />
      </button>

      <button
        onClick={() => openProjectDialog('open')}
        title="Open Project"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <FolderOpen size={20} />
      </button>

      <button
        onClick={handleSave}
        title="Save Project (Ctrl+S)"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
      >
        <Save size={20} />
      </button>
    </div>
  );
};

export default Sidebar;
