import { useEffect, useRef, useCallback } from 'react';
import { Canvas, PencilBrush, Circle, FabricImage, Point, loadSVGFromString, util } from 'fabric';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useStore } from '../store';
import { useDropzone } from 'react-dropzone';

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/** Re-apply tool state after loadFromJSON (which resets canvas modes). */
function reapplyToolState(canvas: any) {
  const state = useStore.getState();
  const tool = state.currentTool;
  switch (tool) {
    case 'brush':
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.width = state.brushWidth;
      canvas.freeDrawingBrush.color = hexToRgba(state.brushColor, state.brushOpacity);
      canvas.defaultCursor = 'crosshair';
      break;
    case 'eraser':
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'pointer';
      canvas.hoverCursor = 'pointer';
      break;
    case 'select':
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      canvas.getObjects().forEach((obj: any) => {
        obj.selectable = true;
        obj.evented = true;
      });
      break;
    case 'dot':
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      break;
  }
}

const CanvasArea = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const compareSnapshotRef = useRef<string | null>(null);

  const currentTool = useStore((s) => s.currentTool);
  const brushWidth = useStore((s) => s.brushWidth);
  const brushColor = useStore((s) => s.brushColor);
  const brushOpacity = useStore((s) => s.brushOpacity);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const setZoomLevel = useStore((s) => s.setZoomLevel);
  const setCanvasInstance = useStore((s) => s.setCanvasInstance);
  const addPath = useStore((s) => s.addPath);
  const addClick = useStore((s) => s.addClick);
  const pushUndoState = useStore((s) => s.pushUndoState);

  // ─── Initialize Fabric Canvas ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      isDrawingMode: true,
      backgroundColor: '#ffffff',
      selection: false,
    });

    fabricRef.current = canvas;
    setCanvasInstance(canvas);

    // Size to container using ResizeObserver for reliable resize tracking
    const resize = () => {
      if (!containerRef.current) return;
      canvas.setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      canvas.renderAll();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(containerRef.current);

    // Default brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = '#000000';

    // Push initial undo state
    pushUndoState(JSON.stringify(canvas.toJSON()));

    return () => {
      resizeObserver.disconnect();
      setCanvasInstance(null);
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Path created → record for backend ────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onPathCreated = (e: any) => {
      const fabricPath = e.path;
      if (!fabricPath?.path) return;

      // Extract [x,y] anchor points from SVG path commands
      const coords: number[][] = [];
      for (const cmd of fabricPath.path) {
        if (cmd[0] === 'M' || cmd[0] === 'L') {
          coords.push([Math.round(cmd[1]), Math.round(cmd[2])]);
        } else if (cmd[0] === 'Q') {
          coords.push([Math.round(cmd[3]), Math.round(cmd[4])]);
        }
      }
      if (coords.length > 0) addPath(coords);
      pushUndoState(JSON.stringify(canvas.toJSON()));
    };

    canvas.on('path:created', onPathCreated);
    return () => {
      canvas.off('path:created', onPathCreated);
    };
  }, [addPath, pushUndoState]);

  // ─── Tool switching ────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    switch (currentTool) {
      case 'brush':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.width = brushWidth;
        canvas.freeDrawingBrush.color = hexToRgba(brushColor, brushOpacity);
        canvas.defaultCursor = 'crosshair';
        break;
      case 'eraser':
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.defaultCursor = 'pointer';
        canvas.hoverCursor = 'pointer';
        break;
      case 'select':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        // Make all objects selectable
        canvas.getObjects().forEach((obj: any) => {
          obj.selectable = true;
          obj.evented = true;
        });
        break;
      case 'dot':
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        break;
    }
    canvas.renderAll();
  }, [currentTool, brushWidth, brushColor, brushOpacity]);

  // ─── Brush property updates ────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || currentTool !== 'brush' || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.width = brushWidth;
    canvas.freeDrawingBrush.color = hexToRgba(brushColor, brushOpacity);
  }, [brushWidth, brushColor, brushOpacity, currentTool]);

  // ─── Dot click + drag handling ──────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || currentTool !== 'dot') return;

    let isDotting = false;

    const placeDot = (pointer: { x: number; y: number }) => {
      const { brushWidth: bw, brushColor: bc, brushOpacity: bo } = useStore.getState();
      const dotRadius = Math.max(bw / 2, 1);
      const circle = new Circle({
        left: pointer.x - dotRadius,
        top: pointer.y - dotRadius,
        radius: dotRadius,
        fill: hexToRgba(bc, bo),
        selectable: false,
        evented: false,
        originX: 'left',
        originY: 'top',
      });
      canvas.add(circle);
      addClick([Math.round(pointer.x), Math.round(pointer.y)]);
    };

    const onMouseDown = (opt: any) => {
      if (spaceHeldRef.current) return;
      isDotting = true;
      const pointer = canvas.getScenePoint(opt.e);
      placeDot(pointer);
    };

    const onMouseMove = (opt: any) => {
      if (!isDotting || spaceHeldRef.current) return;
      const pointer = canvas.getScenePoint(opt.e);
      placeDot(pointer);
    };

    const onMouseUp = () => {
      if (isDotting) {
        pushUndoState(JSON.stringify(canvas.toJSON()));
      }
      isDotting = false;
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [currentTool, brushColor, addClick, pushUndoState]);

  // ─── Eraser (click + drag to erase) ────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || currentTool !== 'eraser') return;

    let isErasing = false;
    let erasedAny = false;

    const eraseAtPointer = (e: any) => {
      const pointer = canvas.getScenePoint(e);
      const objects = canvas.getObjects();
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.containsPoint(new Point(pointer.x, pointer.y))) {
          canvas.remove(obj);
          erasedAny = true;
          canvas.renderAll();
          break;
        }
      }
    };

    const onMouseDown = (opt: any) => {
      if (spaceHeldRef.current) return;
      isErasing = true;
      erasedAny = false;
      eraseAtPointer(opt.e);
    };

    const onMouseMove = (opt: any) => {
      if (!isErasing) return;
      eraseAtPointer(opt.e);
    };

    const onMouseUp = () => {
      if (isErasing && erasedAny) {
        pushUndoState(JSON.stringify(canvas.toJSON()));
      }
      isErasing = false;
      erasedAny = false;
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [currentTool, pushUndoState]);

  // ─── Zoom (scroll wheel) ──────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onWheel = (opt: any) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();

      let zoom = canvas.getZoom();
      zoom *= 0.999 ** e.deltaY;
      zoom = Math.min(Math.max(0.1, zoom), 20);
      canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
      canvas.renderAll();
      useStore.getState().setZoomLevel(zoom);
    };

    canvas.on('mouse:wheel', onWheel);
    return () => {
      canvas.off('mouse:wheel', onWheel);
    };
  }, []);

  // ─── Pan (space + drag) ───────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onMouseDown = (opt: any) => {
      if (spaceHeldRef.current) {
        isPanningRef.current = true;
        lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
      }
    };

    const onMouseMove = (opt: any) => {
      if (!isPanningRef.current || !lastPanPointRef.current) return;
      const dx = opt.e.clientX - lastPanPointRef.current.x;
      const dy = opt.e.clientY - lastPanPointRef.current.y;
      canvas.relativePan(new Point(dx, dy));
      lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };
    };

    const onMouseUp = () => {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      if (spaceHeldRef.current) {
        canvas.defaultCursor = 'grab';
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, []);

  // ─── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const setTool = useStore.getState().setTool;
    const canvas = fabricRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      // Space for pan
      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true;
        if (canvas) {
          canvas.isDrawingMode = false;
          canvas.selection = false;
          canvas.defaultCursor = 'grab';
        }
        e.preventDefault();
        return;
      }

      // Don't capture shortcuts if typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      // Ctrl+Z / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const json = useStore.getState().undo();
        if (json && canvas) {
          canvas.loadFromJSON(JSON.parse(json)).then(() => {
            reapplyToolState(canvas);
            canvas.renderAll();
          });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        const json = useStore.getState().redo();
        if (json && canvas) {
          canvas.loadFromJSON(JSON.parse(json)).then(() => {
            reapplyToolState(canvas);
            canvas.renderAll();
          });
        }
        return;
      }

      // Ctrl+S save — dispatch custom event so the Sidebar handles it
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('qb:save'));
        return;
      }

      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (canvas) {
          const z = Math.min(canvas.getZoom() * 1.1, 20);
          canvas.setZoom(z);
          canvas.renderAll();
          useStore.getState().setZoomLevel(z);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        if (canvas) {
          const z = Math.max(canvas.getZoom() / 1.1, 0.1);
          canvas.setZoom(z);
          canvas.renderAll();
          useStore.getState().setZoomLevel(z);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        if (canvas) {
          canvas.setZoom(1);
          canvas.absolutePan(new Point(0, 0));
          canvas.renderAll();
          useStore.getState().setZoomLevel(1);
        }
        return;
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'b' || e.key === 'B') setTool('brush');
      if (e.key === 'e' || e.key === 'E') setTool('eraser');
      if (e.key === 'd' || e.key === 'D') setTool('dot');

      // Delete selected objects
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas) {
          const active = canvas.getActiveObjects();
          if (active.length > 0) {
            active.forEach((obj: any) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.renderAll();
            pushUndoState(JSON.stringify(canvas.toJSON()));
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        isPanningRef.current = false;
        // Re-apply current tool cursor
        if (canvas) {
          const tool = useStore.getState().currentTool;
          if (tool === 'brush') {
            canvas.isDrawingMode = true;
            canvas.defaultCursor = 'crosshair';
          } else if (tool === 'select') {
            canvas.selection = true;
            canvas.defaultCursor = 'default';
          } else {
            canvas.defaultCursor = tool === 'dot' ? 'crosshair' : 'pointer';
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pushUndoState]);

  // ─── Image import listener ────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      loadImageOntoCanvas(detail.dataUrl);
    };
    window.addEventListener('qb:import-image', handler);
    return () => window.removeEventListener('qb:import-image', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── SVG import listener ──────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      loadSvgOntoCanvas(detail.svgString);
    };
    window.addEventListener('qb:import-svg', handler);
    return () => window.removeEventListener('qb:import-svg', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Effect output listener ───────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      loadOutputOverlay(detail.dataUrl);
    };
    window.addEventListener('qb:load-effect-output', handler);
    return () => window.removeEventListener('qb:load-effect-output', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Before/After comparison listeners ─────────────────────
  useEffect(() => {
    const onCompareStart = (e: Event) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const detail = (e as CustomEvent).detail;
      const strokeId = detail?.strokeId;
      const stroke = useStore.getState().strokes.find((s) => s.id === strokeId);
      if (!stroke?.beforeCanvasJson) return;

      // Save current canvas state so we can restore it later
      compareSnapshotRef.current = JSON.stringify(canvas.toJSON());

      // Load the "before" canvas state
      canvas.loadFromJSON(JSON.parse(stroke.beforeCanvasJson)).then(() => {
        reapplyToolState(canvas);
        canvas.renderAll();
      });
    };

    const onCompareEnd = () => {
      const canvas = fabricRef.current;
      if (!canvas || !compareSnapshotRef.current) return;

      // Restore canvas to the state before comparison
      canvas.loadFromJSON(JSON.parse(compareSnapshotRef.current)).then(() => {
        reapplyToolState(canvas);
        canvas.renderAll();
        compareSnapshotRef.current = null;
      });
    };

    window.addEventListener('qb:compare-start', onCompareStart);
    window.addEventListener('qb:compare-end', onCompareEnd);
    return () => {
      window.removeEventListener('qb:compare-start', onCompareStart);
      window.removeEventListener('qb:compare-end', onCompareEnd);
    };
  }, []);

  const loadImageOntoCanvas = (dataUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const imgEl = new Image();
    imgEl.onload = () => {
      const fabricImg = new FabricImage(imgEl, {
        selectable: false,
        evented: false,
      });

      // Scale to fit canvas
      const scaleX = canvas.getWidth() / imgEl.width;
      const scaleY = canvas.getHeight() / imgEl.height;
      const scale = Math.min(scaleX, scaleY, 1);
      fabricImg.scale(scale);
      fabricImg.set({
        left: (canvas.getWidth() - imgEl.width * scale) / 2,
        top: (canvas.getHeight() - imgEl.height * scale) / 2,
      });

      // Insert at bottom so it's behind drawn strokes
      canvas.insertAt(0, fabricImg);
      canvas.renderAll();
      pushUndoState(JSON.stringify(canvas.toJSON()));
    };
    imgEl.src = dataUrl;
  };

  const loadSvgOntoCanvas = async (svgString: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const { objects, options } = await loadSVGFromString(svgString);
    const validObjects = objects.filter((o: any): o is NonNullable<typeof o> => o !== null);
    if (validObjects.length === 0) return;

    const group = util.groupSVGElements(validObjects, options);

    // Scale to fit canvas
    const groupWidth = (group.width || 100) * (group.scaleX || 1);
    const groupHeight = (group.height || 100) * (group.scaleY || 1);
    const scaleX = canvas.getWidth() / groupWidth;
    const scaleY = canvas.getHeight() / groupHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    group.scale(scale);
    group.set({
      left: (canvas.getWidth() - groupWidth * scale) / 2,
      top: (canvas.getHeight() - groupHeight * scale) / 2,
      selectable: true,
      evented: true,
    });

    canvas.add(group);
    canvas.renderAll();
    pushUndoState(JSON.stringify(canvas.toJSON()));
  };

  const loadOutputOverlay = (dataUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const imgEl = new Image();
    imgEl.onload = () => {
      const overlay = new FabricImage(imgEl, {
        selectable: false,
        evented: false,
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
      });
      canvas.add(overlay);
      canvas.renderAll();
      pushUndoState(JSON.stringify(canvas.toJSON()));
    };
    imgEl.src = dataUrl;
  };

  // ─── Drag & drop image import ─────────────────────────────
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      const file = accepted[0];

      if (file.name.toLowerCase().endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            loadSvgOntoCanvas(reader.result);
          }
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            loadImageOntoCanvas(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg'] },
    noClick: true,
    noKeyboard: true,
  });

  const handleZoomIn = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const z = Math.min(canvas.getZoom() * 1.2, 20);
    canvas.setZoom(z);
    canvas.renderAll();
    setZoomLevel(z);
  };

  const handleZoomOut = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const z = Math.max(canvas.getZoom() / 1.2, 0.1);
    canvas.setZoom(z);
    canvas.renderAll();
    setZoomLevel(z);
  };

  const handleZoomSlider = (value: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const z = Math.min(Math.max(value, 0.1), 20);
    canvas.setZoom(z);
    canvas.renderAll();
    setZoomLevel(z);
  };

  const handleFitToView = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setZoom(1);
    canvas.absolutePan(new Point(0, 0));
    canvas.renderAll();
    setZoomLevel(1);
  };

  return (
    <div
      {...getRootProps()}
      ref={containerRef}
      className="flex-1 h-full bg-gray-950 relative overflow-hidden"
    >
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
          <p className="text-blue-300 text-lg font-medium">Drop image here</p>
        </div>
      )}
      <canvas ref={canvasRef} />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-sm border border-white/10 rounded-lg px-2 py-1.5 select-none">
        <button
          onClick={handleFitToView}
          title="Fit to view (Ctrl+0)"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Maximize size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom out (Ctrl+-)"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ZoomOut size={14} />
        </button>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.01}
          value={zoomLevel}
          onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
          className="w-24 accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title="Zoom level"
        />
        <button
          onClick={handleZoomIn}
          title="Zoom in (Ctrl++)"
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ZoomIn size={14} />
        </button>
        <span className="text-xs text-gray-400 font-mono w-10 text-right">
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>
    </div>
  );
};

export default CanvasArea;
