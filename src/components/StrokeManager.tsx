import { useState } from 'react';
import { Layers, CheckCircle2, XCircle, Loader2, Clock, Eye, EyeOff, Trash2, RotateCcw, Play } from 'lucide-react';
import { useStore } from '../store';

const statusIcons = {
  pending: <Clock size={14} className="text-yellow-400" />,
  running: <Loader2 size={14} className="text-blue-400 animate-spin" />,
  completed: <CheckCircle2 size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
};

const statusColors = {
  pending: 'border-yellow-500/20 bg-yellow-900/10',
  running: 'border-blue-500/30 bg-blue-900/10',
  completed: 'border-green-500/20 bg-green-900/10',
  failed: 'border-red-500/20 bg-red-900/10',
};

const StrokeManager = () => {
  const strokes = useStore((s) => s.strokes);
  const isOpen = useStore((s) => s.strokeManagerOpen);
  const toggleStrokeManager = useStore((s) => s.toggleStrokeManager);
  const removeStroke = useStore((s) => s.removeStroke);
  const reapplyStroke = useStore((s) => s.reapplyStroke);
  const notify = useStore((s) => s.notify);

  const [compareStrokeId, setCompareStrokeId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCompareToggle = (strokeId: string) => {
    if (compareStrokeId === strokeId) {
      // Turn off comparison — re-show the effect output
      setCompareStrokeId(null);
      window.dispatchEvent(new CustomEvent('qb:compare-end'));
    } else {
      // Start comparison — temporarily hide the effect output to show "before"
      setCompareStrokeId(strokeId);
      window.dispatchEvent(new CustomEvent('qb:compare-start', { detail: { strokeId } }));
      notify('Showing canvas before this effect. Click again to restore.', 'info');
    }
  };

  const handleRemove = (strokeId: string) => {
    if (compareStrokeId === strokeId) {
      setCompareStrokeId(null);
      window.dispatchEvent(new CustomEvent('qb:compare-end'));
    }
    removeStroke(strokeId);
  };

  const handleReapply = async (strokeId: string) => {
    const stroke = strokes.find((s) => s.id === strokeId);
    if (!stroke) return;
    if (stroke.status === 'running') return;
    reapplyStroke(strokeId);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-52 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 flex flex-col z-40">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-white">Stroke Manager</span>
          <span className="text-xs text-gray-500">({strokes.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500">
            {compareStrokeId ? '👁 Comparing before/after' : 'Manage applied effects'}
          </span>
          <button
            onClick={toggleStrokeManager}
            className="text-gray-400 hover:text-white text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Stroke list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {strokes.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            No strokes yet. Draw on the canvas and apply an effect.
          </p>
        ) : (
          [...strokes].reverse().map((stroke) => (
            <div
              key={stroke.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${statusColors[stroke.status]} transition-colors ${
                compareStrokeId === stroke.id ? 'ring-1 ring-yellow-400/50' : ''
              }`}
            >
              {statusIcons[stroke.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-medium truncate">
                    {stroke.effectName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(stroke.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {stroke.error && (
                  <p className="text-xs text-red-400 truncate mt-0.5">{stroke.error}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Before/After compare (only for completed strokes) */}
                {stroke.status === 'completed' && (
                  <button
                    onClick={() => handleCompareToggle(stroke.id)}
                    title={compareStrokeId === stroke.id ? 'Show after (restore effect)' : 'Show before (hide effect)'}
                    className={`p-1 rounded transition-all ${
                      compareStrokeId === stroke.id
                        ? 'text-yellow-400 bg-yellow-400/10'
                        : 'text-gray-500 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {compareStrokeId === stroke.id ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}

                {/* Re-apply (for failed or completed — re-run the effect) */}
                {(stroke.status === 'completed' || stroke.status === 'failed') && (
                  <button
                    onClick={() => handleReapply(stroke.id)}
                    title="Re-apply this effect"
                    className="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}

                {/* Apply now (for pending strokes) */}
                {stroke.status === 'pending' && (
                  <button
                    onClick={() => handleReapply(stroke.id)}
                    title="Apply this effect now"
                    className="p-1 rounded text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 transition-all"
                  >
                    <Play size={13} />
                  </button>
                )}

                {/* Remove */}
                <button
                  onClick={() => handleRemove(stroke.id)}
                  title="Remove from history"
                  className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <span className="text-[10px] text-gray-500 capitalize w-14 text-right">{stroke.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StrokeManager;
