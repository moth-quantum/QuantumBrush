import { useEffect, useState } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import ControlPanel from './components/ControlPanel';
import StrokeManager from './components/StrokeManager';
import ProjectDialog from './components/ProjectDialog';
import Notification from './components/Notification';
import { ChevronRight, ChevronLeft } from 'lucide-react';

function App() {
  const currentProject = useStore((s) => s.currentProject);
  const projectFilePath = useStore((s) => s.projectFilePath);
  const notify = useStore((s) => s.notify);
  const [controlPanelOpen, setControlPanelOpen] = useState(true);

  // Check Python environment on startup — offer to install missing packages
  useEffect(() => {
    window.ipcRenderer.checkPython().then((result) => {
      if (!result.success) return;
      const data = result.data!;
      if (!data.available) {
        notify('python3 not found. Install Python 3 to use effects.', 'error');
      } else if (data.missing && data.missing.length > 0) {
        useStore.getState().setMissingPackages(data.missing);
        notify(`Missing Python packages: ${data.missing.join(', ')}. Open Control Panel to install.`, 'error');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden">
      {/* Left Sidebar — Tools & Actions */}
      <Sidebar />

      {/* Main area — fills remaining space */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Project title bar */}
        <div className="h-8 bg-gray-900/50 border-b border-white/5 flex items-center px-4 shrink-0 select-none">
          <span className="text-xs text-gray-500 truncate">
            {currentProject
              ? `${currentProject.name}${projectFilePath ? ` — ${projectFilePath}` : ''}`
              : 'Quantum Brush — No project'}
          </span>
        </div>

        {/* Canvas + Stroke Manager */}
        <div className="flex-1 relative">
          <CanvasArea />
          <StrokeManager />
        </div>
      </div>

      {/* Right Control Panel — always in DOM, CSS-collapsed to prevent resize bugs */}
      <div className="relative flex shrink-0">
        <button
          onClick={() => setControlPanelOpen(!controlPanelOpen)}
          className="absolute -left-6 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-gray-800 border border-white/10 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
          title={controlPanelOpen ? 'Collapse panel' : 'Expand panel'}
        >
          {controlPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div
          className="transition-[width] duration-200 ease-in-out overflow-hidden"
          style={{ width: controlPanelOpen ? '18rem' : '0' }}
        >
          <div className="w-72 h-full">
            <ControlPanel />
          </div>
        </div>
      </div>

      {/* Overlays */}
      <ProjectDialog />
      <Notification />
    </div>
  );
}

export default App;
