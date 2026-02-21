import { useAppStore } from '../../store/appStore.js'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * LayersPanel — right panel showing all effect layers.
 * Supports reordering (drag), delete, run/abort, visibility toggle, and merge.
 */
export default function LayersPanel() {
    const layers = useAppStore((s) => s.layers)
    const reorderLayers = useAppStore((s) => s.reorderLayers)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const handleDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return
        const from = layers.findIndex((l) => l.id === active.id)
        const to = layers.findIndex((l) => l.id === over.id)
        if (from !== -1 && to !== -1) reorderLayers(from, to)
    }

    return (
        <aside className="w-72 shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Layers</p>
                <span className="text-xs text-[var(--color-text-muted)]">{layers.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {layers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[var(--color-text-muted)]">
                            <polygon points="12,2 2,7 12,12 22,7" />
                            <polyline points="2,17 12,22 22,17" />
                            <polyline points="2,12 12,17 22,12" />
                        </svg>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                            Select an effect and draw on the canvas to create layers
                        </p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col gap-2">
                                {[...layers].reverse().map((layer) => (
                                    <LayerCard key={layer.id} layer={layer} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </aside>
    )
}

function LayerCard({ layer }) {
    const runLayer = useAppStore((s) => s.runLayer)
    const abortLayer = useAppStore((s) => s.abortLayer)
    const deleteLayer = useAppStore((s) => s.deleteLayer)
    const toggleVisibility = useAppStore((s) => s.toggleVisibility)
    const mergeLayer = useAppStore((s) => s.mergeLayer)

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: layer.id,
        disabled: layer.status === 'running',
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    const statusColor = {
        idle: 'text-neutral-500',
        running: 'text-amber-400',
        done: 'text-emerald-400',
        error: 'text-red-400',
        aborted: 'text-neutral-500',
    }[layer.status] || 'text-neutral-500'

    const statusLabel = {
        idle: `${layer.strokes.length} stroke${layer.strokes.length !== 1 ? 's' : ''}`,
        running: 'Processing…',
        done: 'Done',
        error: 'Error',
        aborted: 'Aborted',
    }[layer.status]

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden
        ${layer.status === 'running' ? 'border-amber-500/30' : ''}
        ${layer.status === 'done' ? 'border-emerald-500/20' : ''}
      `}
        >
            {/* Progress bar (running only) */}
            {layer.status === 'running' && (
                <div className="h-0.5 bg-[var(--color-surface-3)]">
                    <div
                        className="h-full bg-amber-400 transition-all duration-300"
                        style={{ width: `${Math.round(layer.progress * 100)}%` }}
                    />
                </div>
            )}

            <div className="p-3">
                {/* Title row */}
                <div className="flex items-start gap-2">
                    {/* Drag handle */}
                    <button
                        {...attributes}
                        {...listeners}
                        className="mt-0.5 text-[var(--color-text-muted)] hover:text-neutral-400 cursor-grab active:cursor-grabbing shrink-0"
                        title="Drag to reorder"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                        </svg>
                    </button>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{layer.effectName}</p>
                        <p className={`text-xs mt-0.5 ${statusColor}`}>{statusLabel}</p>
                    </div>

                    {/* Visibility toggle (only when done and has result) */}
                    {layer.status === 'done' && layer.resultSrc && (
                        <button
                            onClick={() => toggleVisibility(layer.id)}
                            className={`p-1 rounded transition-colors ${layer.visible ? 'text-emerald-400 hover:text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                            title={layer.visible ? 'Hide overlay' : 'Show overlay'}
                        >
                            {layer.visible ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Delete */}
                    {layer.status !== 'running' && (
                        <button
                            onClick={() => deleteLayer(layer.id)}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                            title="Delete layer"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Settings preview */}
                <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(layer.settings).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-xs bg-[var(--color-surface-3)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">
                            {k}: {typeof v === 'boolean' ? (v ? 'on' : 'off') : typeof v === 'string' ? (
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm border border-white/20" style={{ background: v }} />
                                    {v}
                                </span>
                            ) : v}
                        </span>
                    ))}
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex flex-col gap-2">
                    {(() => {
                        const effect = useAppStore.getState().effects.find(e => e.id === layer.effectId)
                        if (!effect || layer.status !== 'idle') return null

                        const count = layer.strokes.length
                        const min = effect.min_strokes ?? 1
                        const max = effect.max_strokes

                        let warning = null
                        if (count < min) {
                            warning = `Requires at least ${min} stroke${min === 1 ? '' : 's'}`
                        } else if (max && count > max) {
                            warning = `Max ${max} stroke${max === 1 ? '' : 's'} allowed`
                        }

                        if (!warning) return null

                        return (
                            <div className="text-[10px] bg-red-500/10 text-red-400 p-2 rounded border border-red-500/20 leading-tight">
                                ⚠️ {warning}. You have {count}.
                            </div>
                        )
                    })()}

                    {(layer.status === 'idle' || layer.status === 'aborted' || layer.status === 'error') && (
                        <button
                            onClick={() => runLayer(layer.id)}
                            disabled={(() => {
                                const effect = useAppStore.getState().effects.find(e => e.id === layer.effectId)
                                if (!effect) return false
                                const count = layer.strokes.length
                                return count < (effect.min_strokes ?? 1) || (effect.max_strokes && count > effect.max_strokes)
                            })()}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                                ${(() => {
                                    const effect = useAppStore.getState().effects.find(e => e.id === layer.effectId)
                                    const count = layer.strokes.length
                                    const disabled = effect && (count < (effect.min_strokes ?? 1) || (effect.max_strokes && count > effect.max_strokes))
                                    return disabled
                                        ? 'bg-neutral-800 text-neutral-600 border border-neutral-700 cursor-not-allowed'
                                        : 'bg-[var(--color-brand)]/20 text-[var(--color-brand)] border border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/30'
                                })()}`}
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                            Run Effect
                        </button>
                    )}

                    {layer.status === 'running' && (
                        <>
                            <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-amber-400
                bg-amber-400/10 border border-amber-400/20">
                                <Spinner />
                                {Math.round(layer.progress * 100)}%
                            </div>
                            <button
                                onClick={() => abortLayer(layer.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-400/30
                  hover:bg-red-400/10 transition-colors"
                            >
                                Abort
                            </button>
                        </>
                    )}

                    {layer.status === 'done' && layer.resultSrc && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    // Let runLayer automatically reset layer status and progress
                                    runLayer(layer.id)
                                }}
                                className="flex-[0.4] flex items-center justify-center py-1.5 rounded-lg text-xs font-medium bg-neutral-500/15 text-neutral-400 border border-neutral-500/25 hover:bg-neutral-500/25 transition-colors"
                            >
                                Rerun
                            </button>
                            <button
                                onClick={() => mergeLayer(layer.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium
                    bg-emerald-500/15 text-emerald-400 border border-emerald-500/25
                    hover:bg-emerald-500/25 transition-colors"
                            >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20,6 9,17 4,12" />
                                </svg>
                                Merge to Canvas
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Spinner() {
    return (
        <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="animate-spin"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
