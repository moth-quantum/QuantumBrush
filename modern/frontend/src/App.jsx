import React, { useState, useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { HexColorPicker } from 'react-colorful';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  FolderOpen, Menu, Undo, Redo, Palette, Layers as LayersIcon,
  Settings,
  Terminal as TerminalIcon,
  Play,
  Trash2,
  X,
  Plus,
  Check,
  Download,
  RotateCcw,
  Sliders,
  Paintbrush,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize,
  Cpu,
  Sparkles,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  Layers,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';



/* dropdown */
function UnifiedDropdown({ options, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`form-input ${open ? 'field-extension-open' : ''}`}
        style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-radius 0.2s ease, border-color 0.15s ease' }}
        onClick={() => setOpen(prev => !prev)}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingRight: 8 }}>{selected ? selected.label : 'Select...'}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="unified-options" style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 300, padding: '4px 0',
          background: 'var(--panel)',
          borderLeft: '1px solid var(--line)',
          borderRight: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}>
          {options.filter(opt => String(opt.value) !== String(value)).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', padding: '8px 14px',
                textAlign: 'left', border: 'none',
                cursor: 'pointer', fontSize: 12, color: 'var(--ink)',
                fontFamily: 'var(--font-sans)',
                background: 'var(--panel)',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableLayerItem({ stroke, isRunning, isHidden, toggleStrokeVisibility, runStroke, deleteStroke, runningStrokeId, draggedLayerId, effects }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stroke.stroke_id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none'
  };
  const effectName = effects?.find(e => e.id === stroke.effect_id)?.name || stroke.effect_id;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`layer-item ${stroke.status === 'completed' ? 'completed' : stroke.status === 'failed' ? 'failed' : ''}`}
    >
      <div className="layer-info">
        <div className="layer-title-row">
          <span className="layer-title">{effectName}</span>
          <span className={`layer-badge ${stroke.processing_status}`}>{stroke.processing_status}</span>
        </div>
      </div>
      <div className="layer-actions">
        <button type="button" className="layer-action-btn" onClick={(e) => { e.stopPropagation(); toggleStrokeVisibility(stroke.stroke_id); }} title={isHidden ? "Show Layer" : "Hide Layer"} onPointerDown={(e) => e.stopPropagation()}>
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <button type="button" className="layer-action-btn run-btn" onClick={(e) => { e.stopPropagation(); runStroke(stroke.stroke_id); }} disabled={isRunning || !!runningStrokeId} title="Run Simulation" onPointerDown={(e) => e.stopPropagation()}>
          <Play size={9} />
        </button>
        <button type="button" className="layer-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); deleteStroke(stroke.stroke_id); }} disabled={isRunning} title="Delete Layer" onPointerDown={(e) => e.stopPropagation()}>
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}
function App() {
  // application state
  const [showTerminal, setShowTerminal] = useState(false);
  const [theme, setTheme] = useState('light'); // 'light' | 'dark'
  const [activeAccordion, setActiveAccordion] = useState(null);


  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null); // { metadata, strokes, originalUrl, currentUrl }
  const [isNewProjectMode, setIsNewProjectMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectFile, setNewProjectFile] = useState(null);

  // effects params state
  const [effects, setEffects] = useState([]);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [effectParams, setEffectParams] = useState({});
  const [hiddenStrokes, setHiddenStrokes] = useState([]); // Hidden stroke IDs

  // hardware settings
  const [hardware, setHardware] = useState({
    provider: 'local_simulator',
    device: 'garnet',
    shots: 1024,
    optimization_level: 2,
    max_qpu_seconds: 30,
    token: ''
  });

  // drawing canvas state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activePaths, setActivePaths] = useState([]); // Array of { points: [{x,y}], clickPoint: {x,y} }
  const [undonePaths, setUndonePaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushRadius, setBrushRadius] = useState(10);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };
    const handleGlobalClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target) && !e.target.closest('.color-btn')) {
        setShowColorPicker(false);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousedown', handleGlobalClick);
    }
  }, []);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // zoom pan state
  const [zoom, setZoom] = useState(1.6);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });


  const handleZoomIn = () => {
    if (!baseImgObj || !viewportRef.current) return;
    setZoom(z => {
      const newZoom = Math.min(z * 1.2, 10.0);
      setPan(p => {
        const imgCenterX = p.x + (baseImgObj.width * z) / 2;
        const imgCenterY = p.y + (baseImgObj.height * z) / 2;
        return {
          x: p.x - (imgCenterX - p.x) * (newZoom / z - 1),
          y: p.y - (imgCenterY - p.y) * (newZoom / z - 1)
        };
      });
      return newZoom;
    });
  };
  const handleZoomOut = () => {
    if (!baseImgObj || !viewportRef.current) return;
    setZoom(z => {
      const newZoom = Math.max(z / 1.2, 0.5);
      setPan(p => {
        const imgCenterX = p.x + (baseImgObj.width * z) / 2;
        const imgCenterY = p.y + (baseImgObj.height * z) / 2;
        return {
          x: p.x - (imgCenterX - p.x) * (newZoom / z - 1),
          y: p.y - (imgCenterY - p.y) * (newZoom / z - 1)
        };
      });
      return newZoom;
    });
  };
  const resetPanZoom = (w, h) => {
    const targetW = typeof w === 'number' ? w : (baseImgObj ? baseImgObj.width : null);
    const targetH = typeof h === 'number' ? h : (baseImgObj ? baseImgObj.height : null);
    if (!targetW || !targetH || !viewportRef.current) return;

    // Default image height on screen is 80% of the viewport height
    const availableHeight = viewportRef.current.clientHeight * 0.8;
    // Default max width is 90% of the viewport width
    const availableWidth = viewportRef.current.clientWidth * 0.9;

    const scaleH = availableHeight / targetH;
    const scaleW = availableWidth / targetW;
    const scale = Math.min(scaleH, scaleW);

    setZoom(scale);
    setPan({
      x: (viewportRef.current.clientWidth - targetW * scale) / 2,
      y: (viewportRef.current.clientHeight - targetH * scale) / 2
    });
  };
  // terminal logs state
  const [logs, setLogs] = useState('');
  const [runningStrokeId, setRunningStrokeId] = useState(null);

  // canvas image layers cached
  const [baseImgObj, setBaseImgObj] = useState(null);
  const [strokeImgObjs, setStrokeImgObjs] = useState({}); // strokeId -> ImageObject

  // toast notifications
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState(null);

  // Undo/Redo Helpers
  const handleUndo = () => {
    if (activePaths.length > 0) {
      const last = activePaths[activePaths.length - 1];
      setActivePaths(prev => prev.slice(0, -1));
      setUndonePaths(prev => [...prev, last]);
    }
  };
  const handleRedo = () => {
    if (undonePaths.length > 0) {
      const next = undonePaths[undonePaths.length - 1];
      setUndonePaths(prev => prev.slice(0, -1));
      setActivePaths(prev => [...prev, next]);
    } else {
    }
  };

  // Refs
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const layersMenuRef = useRef(null);
  const mainMenuRef = useRef(null);
  const colorPickerRef = useRef(null);
  const [layersListAnimateRef] = useAutoAnimate();
  const [mainMenuAnimateRef] = useAutoAnimate();
  const isTerminalOpen = showTerminal || runningStrokeId;

  // Load initial settings
  useEffect(() => {
    fetchProjects();
    fetchEffects();
    fetchHardwareConfig();
  }, []);

  // sync document theme class
  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  // global Keyboard Shortcuts (Ctrl+Z, Ctrl+D, Ctrl+0, +, -, Space drag)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // dont trigger shortcuts when typing in inputs/selects/textareas
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + S: Export Image
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport('png');
      }

      // Ctrl/Cmd + N: New Project Menu
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowMainMenu(true);
        setIsNewProjectMode(true);
        setActiveAccordion('new');
      }

      // Ctrl/Cmd + O: Open Project Menu
      if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowMainMenu(true);
        setIsNewProjectMode(false);
        setActiveAccordion('open');
      }

      // [ and ]: Decrease / Increase Brush Radius
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        setBrushSettings(prev => ({
          ...prev,
          radius: Math.max(1, Math.min(100, prev.radius + (e.key === ']' ? 2 : -2)))
        }));
      }

      // Ctrl/Cmd + Z: Undo last path
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo last path
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
      }

      // Ctrl/Cmd + D: Toggle Drawing mode
      if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDrawingMode(prev => !prev);
      }

      // Ctrl/Cmd + 0: Reset Pan & Zoom
      if (isCmdOrCtrl && e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
      }

      // Ctrl/Cmd + Plus / Equals: Zoom In
      if (isCmdOrCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(z => Math.min(z * 1.2, 10.0));
      }

      // Ctrl/Cmd + Minus: Zoom Out
      if (isCmdOrCtrl && e.key === '-') {
        e.preventDefault();
        setZoom(z => Math.max(z / 1.2, 0.8));
      }

      // space key down (tracks space press for panning)
      if (e.key === ' ') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activePaths, isDrawingMode]);

  // show toast helper

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !currentProject) {
        loadProject(data[0].project_id);
      } else if (data.length === 0) {
        setShowMainMenu(true);
        setActiveAccordion('new');
        setIsNewProjectMode(true);
      }
    } catch (err) {
    }
  };

  const fetchEffects = async () => {
    try {
      const res = await fetch('/api/effects');
      const data = await res.json();
      setEffects(data);
      if (data.length > 0) {
        selectEffect(data[0]);
      }
    } catch (err) {
    }
  };

  const fetchHardwareConfig = async () => {
    try {
      const res = await fetch('/api/hardware');
      const data = await res.json();
      setHardware({
        ...data,
        token: '' // Don't retrieve token from server for security
      });
    } catch (err) {
    }
  };

  const selectEffect = (effect) => {
    setSelectedEffect(effect);
    // Initialize default parameters
    const params = {};
    if (effect.user_input) {
      Object.entries(effect.user_input).forEach(([key, spec]) => {
        params[key] = spec.default;
      });
    }
    setEffectParams(params);

    if (params.Radius) setBrushRadius(params.Radius);
    if (params.Color) setBrushColor(params.Color);
  };

  // Sync brush parameters back to current selected effect state
  useEffect(() => {
    if (selectedEffect) {
      setEffectParams(prev => {
        const updated = { ...prev };
        if ('Radius' in updated) updated.Radius = brushRadius;
        if ('Color' in updated) updated.Color = brushColor;
        return updated;
      });
    }
  }, [brushRadius, brushColor]);

  // Load project details
  const loadProject = async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentProject(data);
      setActivePaths([]);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `${data.originalUrl}?t=${Date.now()}`;
      img.onload = () => {
        setBaseImgObj(img);
        setTimeout(() => fitToViewport(img.width, img.height), 100);
      };

      // Preload stroke output images
      // Issue #47: prefer result_b64 (in-memory transport) over disk PNG URL
      const completedStrokes = data.strokes.filter(s => s.processing_status === 'completed');
      const newStrokeImgObjs = {};

      await Promise.all(
        completedStrokes.map(async (stroke) => {
          try {
            const strokeImg = new Image();
            strokeImg.crossOrigin = 'anonymous';
            // If the instruction JSON has result_b64 embedded, use it directly
            if (stroke.result_b64 && stroke.result_b64.length > 0) {
              strokeImg.src = `data:image/png;base64,${stroke.result_b64}`;
            } else {
              strokeImg.src = `/project/${projectId}/stroke/${stroke.stroke_id}_output.png?t=${Date.now()}`;
            }
            await new Promise((resolve, reject) => {
              strokeImg.onload = resolve;
              strokeImg.onerror = reject;
            });
            newStrokeImgObjs[stroke.stroke_id] = strokeImg;
          } catch (e) {
            console.error(`Failed to load output for stroke ${stroke.stroke_id}`);
          }
        })
      );

      setStrokeImgObjs(newStrokeImgObjs);

      setActiveStep(1);
    } catch (err) {
    }
  };


  const fitToViewport = (imgWidth, imgHeight) => {
    resetPanZoom(imgWidth, imgHeight);
  };

  // draw canvas
  useEffect(() => {
    drawCanvas();
  }, [baseImgObj, strokeImgObjs, activePaths, currentPath, brushColor, brushRadius, currentProject, hiddenStrokes, zoom]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImgObj) return;
    const ctx = canvas.getContext('2d');

    canvas.width = baseImgObj.width;
    canvas.height = baseImgObj.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // base image
    ctx.drawImage(baseImgObj, 0, 0);

    //  Completed Stroke output (excluding hidden)
    if (currentProject && currentProject.strokes) {
      currentProject.strokes.forEach(stroke => {
        if (stroke.processing_status === 'completed' && strokeImgObjs[stroke.stroke_id] && !hiddenStrokes.includes(stroke.stroke_id)) {
          ctx.drawImage(strokeImgObjs[stroke.stroke_id], 0, 0);
        }
      });
    }

    // helper to draw single path processing-style (yellow outline + red/core color)
    const drawSinglePath = (path) => {
      if (path.points.length >= 2) {
        // outer yellow stroke (scaled to screen weight)
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = brushRadius + (3 / zoom);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();

        // inner color core stroke
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = Math.max(1, brushRadius);
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }

      // draw clickPoint anchor dot (Processing-style black/yellow dot)
      if (path.clickPoint) {
        const borderSize = 6 / zoom;
        const fillSize = 4 / zoom;

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(path.clickPoint.x, path.clickPoint.y, borderSize, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(path.clickPoint.x, path.clickPoint.y, fillSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    // layer 3: active drawn paths
    activePaths.forEach(drawSinglePath);

    if (currentPath) {
      drawSinglePath(currentPath);
    }
  };

  const getCanvasCoords = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = viewportRef.current.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    const imageX = Math.round((viewportX - pan.x) / zoom);
    const imageY = Math.round((viewportY - pan.y) / zoom);

    const clampedX = Math.max(0, Math.min(canvas.width - 1, imageX));
    const clampedY = Math.max(0, Math.min(canvas.height - 1, imageY));

    return { x: clampedX, y: clampedY };
  };

  // pan and draw
  const handleMouseDown = (e) => {
    if (!baseImgObj) return;

    if (e.button === 2) {
      e.preventDefault();
    }

    // pan trigger on Space+Click, Ctrl+Click, Middle click, or Right click
    const isPanAction = isSpacePressed || (e.ctrlKey && e.button === 0) || e.button === 1 || e.button === 2 || (!isDrawingMode && e.button === 0);
    const allowDraw = isDrawingMode && !isPanAction;

    if (isPanAction) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && allowDraw) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const newPath = {
        points: [coords],
        clickPoint: coords
      };
      setCurrentPath(newPath);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (currentPath) {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const start = currentPath.clickPoint;

      // Shift snaps straight constraint (Java replication)
      if (e.shiftKey && start) {
        const dx = coords.x - start.x;
        const dy = coords.y - start.y;

        let snappedPoint;
        if (Math.abs(dx) > Math.abs(dy)) {
          snappedPoint = { x: coords.x, y: start.y };
        } else {
          snappedPoint = { x: start.x, y: coords.y };
        }

        setCurrentPath(prev => ({
          ...prev,
          points: [start, snappedPoint]
        }));
      } else {
        // Freehand draw
        const lastPoint = currentPath.points[currentPath.points.length - 1];
        if (lastPoint.x !== coords.x || lastPoint.y !== coords.y) {
          setCurrentPath(prev => ({
            ...prev,
            points: [...prev.points, coords]
          }));
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (currentPath) {
      setActivePaths(prev => [...prev, currentPath]);
      setUndonePaths([]);
      setCurrentPath(null);
    }
  };

  const handleWheel = (e) => {
    if (!baseImgObj) return;
    if (showTerminal || runningStrokeId) {
      // already stopped propagation on terminal drawer
    }
    e.preventDefault();

    // In modern browsers, pinch-to-zoom or Ctrl+Scroll sets e.ctrlKey = true
    // Standard two-finger trackpad scroll does NOT set e.ctrlKey.
    if (!e.ctrlKey) {
      if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
        // It's a two-finger trackpad pan (or standard mouse scroll)
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
      return;
    }

    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 10.0);
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.5);
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imageX = (mouseX - pan.x) / zoom;
    const imageY = (mouseY - pan.y) / zoom;

    setZoom(newZoom);
    setPan({
      x: mouseX - imageX * newZoom,
      y: mouseY - imageY * newZoom
    });
  };

  // projects CRUD
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectFile) {
      return;
    }
    let finalName = newProjectName.trim();
    if (!finalName) {
      let i = 1;
      const names = projects.map(p => p.project_name);
      while (names.includes(`Project ${i}`)) i++;
      finalName = `Project ${i}`;
    }

    const formData = new FormData();
    formData.append('name', finalName);
    formData.append('image', newProjectFile);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setNewProjectName('');
        setNewProjectFile(null);
        setIsNewProjectMode(false);
        await fetchProjects();
        loadProject(data.projectId);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this project?')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProjects();
        if (currentProject && currentProject.metadata.project_id === projectId) {
          setCurrentProject(null);
          setBaseImgObj(null);
          setStrokeImgObjs({});
          setActiveStep(0);
        }
      }
    } catch (err) {
    }
  };

  // create preset
  const handleAddStroke = async () => {
    if (!currentProject) {
      return;
    }

    const strokeId = `stroke_${Date.now()}`;
    const pathData = [];
    const clicksData = [];

    activePaths.forEach(path => {
      clicksData.push([path.clickPoint.x, path.clickPoint.y]);
      path.points.forEach(pt => {
        pathData.push([pt.x, pt.y]);
      });
    });

    const canvas = canvasRef.current;
    if (!canvas || !baseImgObj) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const oCtx = offscreen.getContext('2d');
    oCtx.drawImage(baseImgObj, 0, 0);

    currentProject.strokes.forEach(stroke => {
      if (stroke.processing_status === 'completed' && strokeImgObjs[stroke.stroke_id] && !hiddenStrokes.includes(stroke.stroke_id)) {
        oCtx.drawImage(strokeImgObjs[stroke.stroke_id], 0, 0);
      }
    });

    const inputImageBase64 = offscreen.toDataURL('image/png');

    const body = {
      strokeId,
      effectId: selectedEffect.id,
      userInput: effectParams,
      pathData,
      clicksData,
      inputImageBase64
    };

    try {
      const res = await fetch(`/api/projects/${currentProject.metadata.project_id}/strokes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setActivePaths([]);
        await loadProject(currentProject.metadata.project_id);

        setActiveStep(1);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
    }
  };

  const runStroke = (strokeId) => {
    if (runningStrokeId) {
      return;
    }

    setLogs('');
    setRunningStrokeId(strokeId);
    setShowTerminal(true);

    setCurrentProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        strokes: prev.strokes.map(s => s.stroke_id === strokeId ? { ...s, processing_status: 'running' } : s)
      };
    });

    const projectId = currentProject.metadata.project_id;
    const sse = new EventSource(`/api/projects/${projectId}/strokes/${strokeId}/run`);

    const timeoutId = setTimeout(() => {
      sse.close();
      setRunningStrokeId(null);
      setLogs(prev => prev + `\nTIMEOUT: The execution exceeded the 60 second limit and was closed by the frontend.\n`);

      setCurrentProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          strokes: prev.strokes.map(s => s.stroke_id === strokeId ? { ...s, processing_status: 'failed' } : s)
        };
      });
      setTimeout(() => loadProject(projectId), 3000);
    }, 90000);

    sse.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => prev + data.text);
      if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });

    sse.addEventListener('error', (e) => {
      clearTimeout(timeoutId);
      const data = JSON.parse(e.data);
      setLogs(prev => prev + `\nERROR: ${data.message}\n`);
      sse.close();
      setRunningStrokeId(null);
      loadProject(projectId);
    });

    sse.addEventListener('complete', async (e) => {
      clearTimeout(timeoutId);
      const data = JSON.parse(e.data);
      sse.close();
      setRunningStrokeId(null);

      if (data.success) {
        setLogs(prev => prev + `\nCompleted successfully!\n`);

        // Issue #47: if server returns result as base64 data URL (in-memory mode),
        // cache it without waiting for loadProject disk I/O
        if (data.outputDataUrl && data.outputDataUrl.length > 0) {
          const strokeImg = new Image();
          strokeImg.crossOrigin = 'anonymous';
          strokeImg.src = data.outputDataUrl;
          await new Promise((resolve) => { strokeImg.onload = resolve; strokeImg.onerror = resolve; });
          setStrokeImgObjs(prev => ({ ...prev, [strokeId]: strokeImg }));
        }

        await loadProject(projectId);
        setTimeout(() => saveCompositeCanvasOnBackend(projectId), 800);
      } else {
        setLogs(prev => prev + `\nFailed: ${data.message}\n`);
        loadProject(projectId);
      }
    });
  };


  const saveCompositeCanvasOnBackend = async (projectId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const compositeData = canvas.toDataURL('image/png');
    try {
      await fetch(`/api/projects/${projectId}/current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compositeData })
      });
      console.log('Saved layered current.png to server.');
    } catch (e) {
      console.error('Failed to save current composite canvas', e);
    }
  };

  const deleteStroke = async (strokeId) => {
    if (!confirm('Permanently delete this stroke layer?')) return;
    try {
      const projectId = currentProject.metadata.project_id;
      const res = await fetch(`/api/projects/${projectId}/strokes/${strokeId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadProject(projectId);
        setTimeout(() => saveCompositeCanvasOnBackend(projectId), 500);
      }
    } catch (err) {
    }
  };

  // hardware config
  const handleSaveHardware = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hardware)
      });
      const data = await res.json();
      if (data.success) {
        fetchHardwareConfig();
      }
    } catch (err) {
    }
  };

  const handleClearToken = async () => {
    try {
      await fetch('/api/hardware/clear-token', { method: 'POST' });
      setHardware(prev => ({ ...prev, token: '' }));
    } catch (e) {
    }
  };

  // export canvas action
  const handleExportCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (window.showSaveFilePicker) {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: `${currentProject.metadata.project_name}_export.png`,
              types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch (err) {
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${currentProject.metadata.project_name}_export.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (e) {
    }
  };

  const toggleStrokeVisibility = (strokeId) => {
    setHiddenStrokes(prev =>
      prev.includes(strokeId)
        ? prev.filter(id => id !== strokeId)
        : [...prev, strokeId]
    );
  };

  // dynamically map buttons
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const visualStrokes = [...currentProject.strokes].reverse();
      const oldIndex = visualStrokes.findIndex(s => s.stroke_id === active.id);
      const newIndex = visualStrokes.findIndex(s => s.stroke_id === over.id);

      const newStrokes = arrayMove(visualStrokes, oldIndex, newIndex);
      setCurrentProject({ ...currentProject, strokes: newStrokes.reverse() });
    }
  };

  return (
    <>
      <div className="app">
        {/* canvas */}
        <section className="workspace-frame" aria-label="Quantum Brush editor window">
          <div className="canvas-wrap">
            <div
              className={`canvas ${isDrawingMode ? 'drawing-mode' : ''}`}
              ref={viewportRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
            >
              {baseImgObj && (
                <div
                  className="canvas-wrapper"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: isPanning ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: baseImgObj.width,
                    height: baseImgObj.height
                  }}
                >
                  <canvas ref={canvasRef} className="canvas-image" />
                </div>
              )}

              {!baseImgObj && (
                <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Sparkles size={36} style={{ color: 'var(--muted)', marginBottom: 12, opacity: 0.5 }} />
                    <h2 style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>Quantum Brush</h2>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>Click the menu top-left to initialize or open a project.</p>
                  </div>
                </div>
              )}

              {/* console */}
              <div 
                className={`terminal-drawer ${showTerminal || runningStrokeId ? 'open' : ''}`}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="terminal-header">
                  <span>Live Simulation Shell stdout/stderr logs</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {runningStrokeId && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Executing... (Backend generation may take up to a minute)</span>}
                    <button className="round-icon-btn" style={{ background: 'transparent', marginRight: -8 }} onClick={() => setShowTerminal(false)} title="Close Terminal">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="terminal-output">
                  {logs || 'Ready to run strokes. Open the Layers menu and click the Play button next to a stroke card to see output logs.'}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Header */}
        <div className="floating-top-header">
          <button className={`round-icon-btn main-menu-btn ${showMainMenu ? 'active' : ''}`} title="Main Menu" onClick={() => setShowMainMenu(!showMainMenu)}>
            <Menu size={18} />
          </button>

          <div className="center-tools">
            <button className="round-icon-btn" title="Undo (Ctrl+Z)" onClick={handleUndo}>
              <Undo size={16} />
            </button>
            <button className="round-icon-btn" title="Redo" onClick={handleRedo}>
              <Redo size={16} />
            </button>

            <button
              className={`round-icon-btn ${isDrawingMode ? 'active' : ''}`}
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              title="Draw Tool"
            >
              <Paintbrush size={16} />
            </button>

            <div style={{ position: 'relative' }}>
              <button className="round-icon-btn color-btn" title="Color Wheel" onClick={() => setShowColorPicker(!showColorPicker)}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: brushColor, border: '1px solid var(--line)' }} />
              </button>
              <div className={`dropdown-popover center color-picker-popover ${showColorPicker ? 'open' : ''}`} style={{ top: 48, width: 220, padding: 12 }} ref={colorPickerRef}>
                <HexColorPicker color={brushColor} onChange={setBrushColor} style={{ width: '100%', height: 160 }} />
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: brushColor, border: '1px solid var(--line)', flexShrink: 0 }}></div>
                  <input type="text" className="form-input" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px', width: '100%' }} value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
              <input
                type="range"
                className="slider-input"
                style={{ width: 60 }}
                min="1" max="100"
                value={brushRadius}
                onChange={(e) => setBrushRadius(parseInt(e.target.value) || 1)}
              />
              <input
                type="number"
                className="form-input"
                style={{ width: 40, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                min="1" max="100"
                value={brushRadius}
                onChange={(e) => setBrushRadius(parseInt(e.target.value) || 1)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            </div>

            <button className="round-icon-btn" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={16} /></button>
            <button className="round-icon-btn" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
            <button className="round-icon-btn" onClick={resetPanZoom} title="Reset Pan & Zoom"><RotateCcw size={16} /></button>
          </div>

          <button className={`round-icon-btn layers-btn ${showLayersMenu ? 'active' : ''}`} title="Layers" onClick={() => setShowLayersMenu(!showLayersMenu)}>
            <LayersIcon size={18} />
          </button>
        </div>

        {/* main menu */}
        <div className={`dropdown-popover left ${showMainMenu ? 'open' : ''}`} style={{ top: 16, left: 16, width: 280 }} ref={mainMenuRef}>
            <h3 style={{ fontSize: 12, marginBottom: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>{currentProject ? currentProject.metadata.project_name : 'MAIN MENU'}</h3>
            <div ref={mainMenuAnimateRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              <button className="btn" onClick={() => { setIsNewProjectMode(true); setActiveAccordion(prev => prev === 'new' ? null : 'new'); }}>
                <Plus size={14} /> New Project
              </button>
              {activeAccordion === 'new' && (
                <form className="animated-form" onSubmit={(e) => { handleCreateProject(e); setActiveAccordion(null); setShowMainMenu(false); }} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, marginBottom: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>Project Name</label>
                    <input type="text" className="form-input" placeholder="E.g., Sketch" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>Canvas Image File</label>
                    {!newProjectFile ? (
                      <div
                        className="file-upload-dropzone"
                        onClick={() => fileInputRef.current.click()}
                        style={{ padding: 12 }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setNewProjectFile(e.dataTransfer.files[0]); }}
                      >
                        <FolderOpen size={24} style={{ opacity: 0.5, marginBottom: 8 }} />
                        <p style={{ fontSize: 11 }}>Click or drag image here</p>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--line)', width: '100%', aspectRatio: '1/1' }}>
                        <img src={URL.createObjectURL(newProjectFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <button type="button" className="image-remove-btn" onClick={() => setNewProjectFile(null)}>
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} accept="image/png, image/jpeg" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) setNewProjectFile(e.target.files[0]); }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="submit" className="primary-action btn" style={{ flex: 1, padding: 8 }}>Create Project</button>
                  </div>
                </form>
              )}

              <button className="btn" onClick={() => { setIsNewProjectMode(false); setActiveAccordion(prev => prev === 'switch' ? null : 'switch'); }}>
                <FolderOpen size={14} /> Switch Project
              </button>
              {activeAccordion === 'switch' && (
                <div className="animated-form" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4, marginTop: 8, marginBottom: 8 }}>
                  {projects.length === 0 ? <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>No projects found.</p> : projects.map(p => (
                    <div key={p.project_id} className={`project-list-item ${currentProject?.metadata.project_id === p.project_id ? 'active' : ''}`} onClick={() => { loadProject(p.project_id); setActiveAccordion(null); setShowMainMenu(false); }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          <img src={`/project/${p.project_id}/current.png?t=${p.modified_time || Date.now()}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 12, margin: 0, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name || p.name || p.project_id}</h4>
                          <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{p.created_time ? new Date(p.created_time).toLocaleDateString() : ''}</span>
                        </div>
                        <button type="button" className="layer-action-btn delete-btn" onClick={(e) => handleDeleteProject(p.project_id, e)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn" onClick={() => { setShowMainMenu(false); handleExportCanvas(); }}>
                <Download size={14} /> Export Canvas
              </button>

              <button className="btn" onClick={() => setActiveAccordion(prev => prev === 'hardware' ? null : 'hardware')}>
                <Settings size={14} /> Hardware Config
              </button>
              {activeAccordion === 'hardware' && (
                <form className="animated-form" onSubmit={async (e) => {
                  await handleSaveHardware(e);
                  setActiveAccordion(null);
                }} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, marginBottom: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>Qiskit Target Provider</label>
                    <UnifiedDropdown options={[{ value: 'local_simulator', label: 'Local Aer Simulator' }, { value: 'iqm', label: 'IQM Quantum Hardware' }]} value={hardware.provider} onChange={(val) => setHardware(prev => ({ ...prev, provider: val }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>QPU Device Name</label>
                    <input type="text" className="form-input" value={hardware.device} onChange={(e) => setHardware(prev => ({ ...prev, device: e.target.value }))} placeholder="e.g. garnet" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>Shots Count</label>
                    <input type="number" className="form-input" value={hardware.shots} onChange={(e) => setHardware(prev => ({ ...prev, shots: parseInt(e.target.value) || 0 }))} min="1" max="100000" style={{ width: 64, padding: "2px 4px", textAlign: "center" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>Optimization Level</label>
                    <UnifiedDropdown options={[{ value: 0, label: 'Level 0' }, { value: 1, label: 'Level 1' }, { value: 2, label: 'Level 2' }, { value: 3, label: 'Level 3' }]} value={hardware.optimization_level} onChange={(val) => setHardware(prev => ({ ...prev, optimization_level: parseInt(val) || 0 }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--ink)' }}>IQM Token</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="password" className="form-input" value={hardware.token} onChange={(e) => setHardware(prev => ({ ...prev, token: e.target.value }))} placeholder="API token" style={{ flex: 1 }} />
                      {hardware.token && <button type="button" className="btn" onClick={handleClearToken} style={{ color: 'var(--error)' }}>Clear</button>}
                    </div>
                  </div>
                  <button type="submit" className="primary-action btn">Save Settings</button>
                </form>
              )}
              <button className="btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />} Toggle Theme
              </button>
            </div>
        </div>

        {/* layers and effects */}
        <div className={`dropdown-popover right ${showLayersMenu ? 'open' : ''}`} style={{ top: 16, right: 16, width: 320 }} ref={layersMenuRef}>
            <h3 style={{ fontSize: 12, margin: '0 0 12px 0', color: 'var(--muted)', textAlign: 'left', padding: 0 }}>Layers</h3>
            {/* Status Monitor */}
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 0, borderBottom: "none", fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{Math.round(zoom * 100)}%</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>X: {baseImgObj && viewportRef.current ? Math.round(((viewportRef.current.clientWidth / 2 - pan.x) / zoom) - baseImgObj.width / 2) : 0} Y: {baseImgObj && viewportRef.current ? Math.round(((viewportRef.current.clientHeight / 2 - pan.y) / zoom) - baseImgObj.height / 2) : 0}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Paintbrush size={10} /> {activePaths.length}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={10} /> {hardware.provider === 'local_simulator' ? 'Local Aer' : hardware.device}</span>
            </div>
            <div className="layers-list" style={{ maxHeight: 260, marginBottom: 16 }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                <SortableContext items={currentProject?.strokes ? [...currentProject.strokes].reverse().map(s => s.stroke_id) : []} strategy={verticalListSortingStrategy}>
                  {currentProject?.strokes && [...currentProject.strokes].reverse().map((stroke) => {
                    const isRunning = stroke.stroke_id === runningStrokeId || stroke.processing_status === 'running';
                    const isHidden = hiddenStrokes.includes(stroke.stroke_id);
                    return (
                      <SortableLayerItem
                        key={stroke.stroke_id}
                        stroke={stroke}
                        isRunning={isRunning}
                        isHidden={isHidden}
                        toggleStrokeVisibility={toggleStrokeVisibility}
                        runStroke={runStroke}
                        deleteStroke={deleteStroke}
                        runningStrokeId={runningStrokeId}
                        draggedLayerId={draggedLayerId}
                        effects={effects}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
              {currentProject && (
                <div className="layer-item base-layer">
                  <div className="layer-info"><span className="layer-title">Base Canvas</span></div>
                </div>
              )}
            </div>

            {/* Effect properties inside layers */}
            <div style={{ paddingTop: 0, marginTop: 8 }}>
              <h3 style={{ fontSize: 12, margin: '0 0 8px 0', color: 'var(--muted)', textAlign: 'left', padding: 0 }}>EFFECT PARAMETERS</h3>
                <div style={{ marginBottom: 12 }}>
                  <UnifiedDropdown
                    options={effects.map(eff => ({ value: eff.id, label: eff.name }))}
                    value={selectedEffect?.id || ''}
                    onChange={(val) => {
                      const selected = effects.find(eff => eff.id === val);
                      if (selected) selectEffect(selected);
                    }}
                  />
                </div>

                {selectedEffect && Object.entries(selectedEffect.user_input || {}).map(([key, spec]) => {
                  if (key === 'Radius' || key === 'Color') return null;
                  if (spec.type === 'int' || spec.type === 'float') {
                    const step = spec.type === 'float' ? '0.05' : '1';
                    return (
                      <div className="form-group" key={key}>
                        <label className="form-label">{key}</label>
                        <div className="slider-container" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="range" className="slider-input"
                            style={{ flex: 1 }}
                            min={spec.min} max={spec.max} step={step}
                            value={effectParams[key] ?? spec.default}
                            onChange={(e) => setEffectParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                          />
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 40, padding: '2px 4px', fontSize: 11, textAlign: 'center', flexShrink: 0 }}
                            min={spec.min} max={spec.max} step={step}
                            value={effectParams[key] ?? spec.default}
                            onChange={(e) => setEffectParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (spec.type === 'bool') {
                    return (
                      <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} key={key}>
                        <label className="form-label" style={{ marginBottom: 0 }}>{key}</label>
                        <button
                          type="button"
                          className={`custom-switch ${effectParams[key] ?? spec.default ? 'checked' : ''}`}
                          onClick={() => setEffectParams(prev => ({ ...prev, [key]: !(effectParams[key] ?? spec.default) }))}
                        />
                      </div>
                    );
                  }
                  if (key.toLowerCase().includes('color') || key === 'Target Color') {
                    return (
                      <div className="form-group" key={key}>
                        <label className="form-label">{key}</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: effectParams[key] ?? spec.default, border: '1px solid var(--line)' }} />
                          <input type="text" className="form-input" style={{ flex: 1 }} value={effectParams[key] ?? spec.default} onChange={(e) => setEffectParams(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="form-group" key={key}>
                      <label className="form-label">{key}</label>
                      <input type="text" className="form-input" value={effectParams[key] ?? spec.default} onChange={(e) => setEffectParams(prev => ({ ...prev, [key]: e.target.value }))} />
                    </div>
                  );
                })}

                <button className="primary-action" onClick={handleAddStroke} style={{ width: '100%', marginTop: 8 }}>
                  <Plus size={14} /> Add Stroke Layer
                </button>
              </div>

          </div>

      </div>
    </>
  );
}

export default App;
