import { useEffect } from 'react'
import './index.css'
import TitleBar from './components/TitleBar.jsx'
import Toolbar from './components/Toolbar.jsx'
import BrushPanel from './components/Panels/BrushPanel.jsx'
import LayersPanel from './components/Panels/LayersPanel.jsx'
import CanvasView from './components/Canvas/CanvasView.jsx'
import { useAppStore } from './store/appStore.js'

export default function App() {
  const showTitleBar = false//import.meta.env.VITE_BACKEND === 'native'

  useEffect(() => {
    if (import.meta.env.VITE_BACKEND === 'native') return;

    const handleBeforeUnload = (e) => {
      const store = useAppStore.getState();
      if (store.image && store.layers.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Required by most browsers to show the confirmation dialog
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-surface)]">
      {showTitleBar && <TitleBar />}
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <BrushPanel />
        <CanvasView />
        <LayersPanel />
      </div>
    </div>
  )
}
