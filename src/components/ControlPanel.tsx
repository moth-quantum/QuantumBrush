import { useEffect, useState } from 'react';
import { Play, Loader2, Info, Download, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import type { EffectDefinition } from '../types';

const ControlPanel = () => {
  const availableEffects = useStore((s) => s.availableEffects);
  const currentEffect = useStore((s) => s.currentEffect);
  const effectParams = useStore((s) => s.effectParams);
  const loadEffects = useStore((s) => s.loadEffects);
  const setCurrentEffect = useStore((s) => s.setCurrentEffect);
  const setEffectParam = useStore((s) => s.setEffectParam);
  const currentProject = useStore((s) => s.currentProject);
  const addStroke = useStore((s) => s.addStroke);
  const updateStroke = useStore((s) => s.updateStroke);
  const currentPaths = useStore((s) => s.currentPaths);
  const currentClicks = useStore((s) => s.currentClicks);
  const clearCurrentStrokeData = useStore((s) => s.clearCurrentStrokeData);
  const notify = useStore((s) => s.notify);
  const brushWidth = useStore((s) => s.brushWidth);
  const brushColor = useStore((s) => s.brushColor);
  const brushOpacity = useStore((s) => s.brushOpacity);
  const setBrushWidth = useStore((s) => s.setBrushWidth);
  const setBrushColor = useStore((s) => s.setBrushColor);
  const setBrushOpacity = useStore((s) => s.setBrushOpacity);
  const currentTool = useStore((s) => s.currentTool);
  const setTool = useStore((s) => s.setTool);
  const missingPackages = useStore((s) => s.missingPackages);
  const setMissingPackages = useStore((s) => s.setMissingPackages);

  const [running, setRunning] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Load effects on mount
  useEffect(() => {
    window.ipcRenderer.loadEffects().then((result) => {
      if (result.success && result.data) {
        loadEffects(result.data);
        if (result.data.length > 0) {
          setCurrentEffect(result.data[0]);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEffectChange = (effectId: string) => {
    const effect = availableEffects.find((e) => e.id === effectId);
    setCurrentEffect(effect || null);
  };

  const handleApplyEffect = async (mode: 'now' | 'later' = 'now') => {
    if (!currentEffect) {
      notify('Select an effect first', 'info');
      return;
    }

    const canvas = useStore.getState()._canvasInstance as any;
    if (!canvas) return;

    const allPathCoords = currentPaths.flat();
    if (allPathCoords.length === 0 && currentClicks.length === 0) {
      notify('Draw strokes or place dots on the canvas first', 'info');
      return;
    }

    const mergedClicks: number[][] = [...currentClicks];
    for (const p of currentPaths) {
      if (p.length > 0) {
        mergedClicks.push(p[0]);
      }
    }

    let projectId = currentProject?.id;
    if (!projectId) {
      const result = await window.ipcRenderer.createProject(
        'Untitled',
        canvas.getWidth(),
        canvas.getHeight()
      );
      if (result.success && result.data) {
        useStore.getState().setProject(result.data);
        projectId = result.data.id;
      } else {
        notify('Failed to create project: ' + result.error, 'error');
        return;
      }
    }

    const strokeId = `stroke_${Date.now()}`;
    const canvasDataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
    // Snapshot canvas state before applying — used for before/after comparison
    const beforeCanvasJson = JSON.stringify(canvas.toJSON());

    // "Apply later" — queue as pending without running
    if (mode === 'later') {
      addStroke({
        id: strokeId,
        effectId: currentEffect.id,
        effectName: currentEffect.name,
        timestamp: Date.now(),
        status: 'pending',
        params: { ...effectParams },
        pathData: allPathCoords,
        clickData: mergedClicks,
        beforeCanvasJson,
      });
      clearCurrentStrokeData();
      notify('Effect queued. Run it from the Stroke Manager when ready.', 'info');
      return;
    }

    // "Apply now"
    addStroke({
      id: strokeId,
      effectId: currentEffect.id,
      effectName: currentEffect.name,
      timestamp: Date.now(),
      status: 'running',
      params: { ...effectParams },
      pathData: allPathCoords,
      clickData: mergedClicks,
      beforeCanvasJson,
    });

    setRunning(true);

    try {
      const result = await window.ipcRenderer.runEffect({
        projectId: projectId!,
        strokeId,
        effectId: currentEffect.id,
        userInput: effectParams,
        strokeInput: {
          path: allPathCoords,
          clicks: mergedClicks,
        },
        canvasImageDataUrl: canvasDataUrl,
      });

      if (result.success && result.data) {
        updateStroke(strokeId, { status: 'completed', resultDataUrl: result.data.outputImageDataUrl });
        window.dispatchEvent(
          new CustomEvent('qb:load-effect-output', {
            detail: { dataUrl: result.data.outputImageDataUrl },
          })
        );
        clearCurrentStrokeData();
        notify('Effect applied successfully', 'success');
      } else {
        updateStroke(strokeId, { status: 'failed', error: result.error });
        notify('Effect failed: ' + result.error, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStroke(strokeId, { status: 'failed', error: msg });
      notify('Effect error: ' + msg, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleInstallPackages = async () => {
    if (!missingPackages || missingPackages.length === 0) return;
    setInstalling(true);
    try {
      const result = await window.ipcRenderer.installPackages(missingPackages);
      if (result.success) {
        setMissingPackages([]);
        notify('All packages installed successfully!', 'success');
      } else {
        notify('Install failed: ' + result.error, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify('Install error: ' + msg, 'error');
    } finally {
      setInstalling(false);
    }
  };

  // Determine if we're in dot sub-mode within brush
  const isDotMode = currentTool === 'dot';
  const isBrushMode = currentTool === 'brush';
  const showBrushSettings = isBrushMode || isDotMode;

  return (
    <div className="w-72 h-full bg-gray-900/80 backdrop-blur-xl border-l border-white/10 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-white font-semibold text-sm">Control Panel</h2>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1">
        {/* ─── Missing packages alert ────────────────── */}
        {missingPackages && missingPackages.length > 0 && (
          <div className="space-y-2 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-red-300 font-medium">Missing Python Packages</p>
            <div className="flex flex-wrap gap-1">
              {missingPackages.map((pkg) => (
                <span key={pkg} className="text-[10px] bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full">
                  {pkg}
                </span>
              ))}
            </div>
            <button
              onClick={handleInstallPackages}
              disabled={installing}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              {installing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download size={12} />
                  Install All Packages
                </>
              )}
            </button>
          </div>
        )}

        {/* ─── Brush / Dot Settings (unified) ─────────── */}
        {showBrushSettings && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Brush Settings
            </label>

            {/* Brush Mode toggle: Stroke vs Dot */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setTool('brush')}
                className={`flex-1 text-xs py-1.5 transition-all ${
                  isBrushMode
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-gray-800/60 text-gray-400 hover:text-white'
                }`}
              >
                Stroke (B)
              </button>
              <button
                onClick={() => setTool('dot')}
                className={`flex-1 text-xs py-1.5 transition-all ${
                  isDotMode
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-gray-800/60 text-gray-400 hover:text-white'
                }`}
              >
                Dots (D)
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Width</span>
                <span>{brushWidth}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={brushWidth}
                onChange={(e) => setBrushWidth(Number(e.target.value))}
                className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">Color</span>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-6 rounded border border-gray-600 cursor-pointer bg-transparent"
              />
              <span className="text-xs text-gray-500 font-mono">{brushColor}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Opacity</span>
                <span>{brushOpacity}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="border-t border-white/5" />

        {/* ─── Effect Selector ──────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Effect
          </label>
          <select
            value={currentEffect?.id || ''}
            onChange={(e) => handleEffectChange(e.target.value)}
            className="w-full bg-gray-800/80 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            {availableEffects.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.name} — {effect.author}
              </option>
            ))}
          </select>
          {currentEffect && (
            <button
              onClick={() => setShowDesc(!showDesc)}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
            >
              <Info size={12} />
              {showDesc ? 'Hide' : 'Show'} description
            </button>
          )}
          {showDesc && currentEffect && (
            <p className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
              {currentEffect.description}
            </p>
          )}
        </div>

        {/* ─── Dynamic Parameters ───────────────────── */}
        {currentEffect && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Parameters
            </label>
            {Object.entries(currentEffect.user_input).map(([key, def]) => (
              <ParameterInput
                key={key}
                name={key}
                def={def}
                value={effectParams[key]}
                onChange={(val) => setEffectParam(key, val)}
              />
            ))}
          </div>
        )}

        {/* ─── Stroke info ──────────────────────────── */}
        {currentEffect && (
          <div className="text-xs text-gray-500 space-y-1">
            {currentEffect.stroke_input.path !== undefined && (
              <p>Paths drawn: {currentPaths.length}</p>
            )}
            {currentEffect.stroke_input.clicks !== undefined && (
              <p>Points placed: {currentClicks.length}</p>
            )}
          </div>
        )}

        {/* ─── Apply Buttons ─────────────────────────── */}
        <div className="space-y-2">
          <button
            onClick={() => handleApplyEffect('now')}
            disabled={running}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play size={16} />
                Apply Now
              </>
            )}
          </button>
          <button
            onClick={() => handleApplyEffect('later')}
            disabled={running}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-gray-200 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle2 size={14} />
            Queue for Later
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Description tooltip for parameters ──────────────────────
function ParamDescription({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{text}</p>
  );
}

// ─── Dynamic parameter input component ─────────────────────
function ParameterInput({
  name,
  def,
  value,
  onChange,
}: {
  name: string;
  def: EffectDefinition['user_input'][string];
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (def.type) {
    case 'int':
    case 'float': {
      const numVal = typeof value === 'number' ? value : Number(def.default);
      const step = def.step ?? (def.type === 'float' ? 0.01 : 1);
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-300">
            <span>{name}</span>
            <span className="font-mono text-gray-500">
              {def.type === 'float' ? numVal.toFixed(2) : numVal}
            </span>
          </div>
          <input
            type="range"
            min={def.min ?? 0}
            max={def.max ?? 100}
            step={step}
            value={numVal}
            onChange={(e) =>
              onChange(def.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))
            }
            className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <ParamDescription text={def.description} />
        </div>
      );
    }

    case 'color': {
      const colorVal = typeof value === 'string' ? value : String(def.default);
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">{name}</span>
            <input
              type="color"
              value={colorVal}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-6 rounded border border-gray-600 cursor-pointer bg-transparent"
            />
            <span className="text-xs text-gray-500 font-mono">{colorVal}</span>
          </div>
          <ParamDescription text={def.description} />
        </div>
      );
    }

    case 'bool': {
      const boolVal = typeof value === 'boolean' ? value : Boolean(def.default);
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={boolVal}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-gray-300">{name}</span>
          </label>
          <ParamDescription text={def.description} />
        </div>
      );
    }

    default: {
      const strVal = typeof value === 'string' ? value : String(def.default ?? '');
      return (
        <div className="space-y-1">
          <label className="text-xs text-gray-300">{name}</label>
          <input
            type="text"
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-gray-800/80 border border-white/10 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <ParamDescription text={def.description} />
        </div>
      );
    }
  }
}

export default ControlPanel;
