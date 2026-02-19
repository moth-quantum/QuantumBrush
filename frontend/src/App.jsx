import './index.css'
import Toolbar from './components/Toolbar.jsx'
import BrushPanel from './components/Panels/BrushPanel.jsx'
import LayersPanel from './components/Panels/LayersPanel.jsx'
import CanvasView from './components/Canvas/CanvasView.jsx'

export default function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <BrushPanel />
        <CanvasView />
        <LayersPanel />
      </div>
    </div>
  )
}
