import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'

/**
 * BrushPanel — left panel for selecting an effect and adjusting its settings.
 */
export default function BrushPanel() {
    const effects = useAppStore((s) => s.effects)
    const effectsLoaded = useAppStore((s) => s.effectsLoaded)
    const loadEffects = useAppStore((s) => s.loadEffects)
    const selectedEffectId = useAppStore((s) => s.selectedEffectId)
    const selectEffect = useAppStore((s) => s.selectEffect)
    const activeSettings = useAppStore((s) => s.activeSettings)
    const updateSetting = useAppStore((s) => s.updateSetting)

    const [showInfo, setShowInfo] = useState(false)

    useEffect(() => {
        if (!effectsLoaded) loadEffects()
    }, [effectsLoaded, loadEffects])

    const selectedEffect = effects.find((e) => e.id === selectedEffectId)

    return (
        <aside className="w-64 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Effects</p>
            </div>

            {/* Effect list */}
            <div className={`${selectedEffect ? 'flex-[0.4]' : 'flex-1'} flex flex-col min-h-0 transition-all duration-300`}>
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    {!effectsLoaded && (
                        <p className="text-xs text-[var(--color-text-muted)] px-2 py-4 text-center">Loading effects…</p>
                    )}
                    {effects.map((effect) => (
                        <button
                            key={effect.id}
                            onClick={() => selectEffect(effect.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm ${selectedEffectId === effect.id
                                ? 'bg-[var(--color-brand)]/20 text-white border border-[var(--color-brand)]/40'
                                : 'text-neutral-400 hover:text-white hover:bg-[var(--color-surface-3)]'
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-medium">{effect.name}</span>
                                {selectedEffectId === effect.id && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                                )}
                            </div>
                            <span className="text-xs text-[var(--color-text-muted)] block truncate">{effect.author}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Settings & Description */}
            {selectedEffect && (
                <>
                    {/* Settings (40%) */}
                    <div className="flex-[0.4] flex flex-col min-h-0 border-t border-[var(--color-border)]">
                        <div className="px-4 py-2.5 border-t border-[var(--color-border)] mt-1 flex justify-between items-center">
                            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Settings</p>
                            <button
                                onClick={() => setShowInfo(true)}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-white transition-colors"
                                title="Learn more about this effect"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4 scrollbar-thin">
                            {Object.entries(selectedEffect.user_input).map(([key, spec]) => (
                                <SettingControl
                                    key={key}
                                    label={key}
                                    spec={spec}
                                    value={activeSettings[key]}
                                    onChange={(v) => updateSetting(key, v)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Scrollable Mini Description (20%) */}
                    <div className="flex-[0.2] flex flex-col min-h-0 px-4 py-3 border-t border-[var(--color-border)] bg-black/10">
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed text-pretty">
                                {selectedEffect.description}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowInfo(true)}
                            className="mt-2 text-[10px] text-[var(--color-brand)] hover:underline font-medium"
                        >
                            Read Full Details →
                        </button>
                    </div>
                </>
            )}



            {showInfo && selectedEffect && (
                <InfoModal effect={selectedEffect} onClose={() => setShowInfo(false)} />
            )}
        </aside>
    )
}

function InfoModal({ effect, onClose }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-lg bg-[var(--color-surface-2)] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-white">{effect.name}</h2>
                        <p className="text-xs text-[var(--color-text-muted)]">by {effect.author} • v{effect.version}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-[var(--color-text-muted)] hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">Overview</h3>
                        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{effect.description}</p>
                    </div>

                    {(effect.long_description || effect.usage_instructions) && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            {effect.long_description && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">How it Works</h3>
                                    <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{effect.long_description}</p>
                                </div>
                            )}
                            {effect.usage_instructions && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">Instructions</h3>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                        <p className="text-sm text-white/90 leading-relaxed italic">
                                            {effect.usage_instructions}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 border-t border-white/5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Technical Details</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 p-2 rounded-lg">
                                <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">ID</p>
                                <p className="text-xs font-mono text-white">{effect.id}</p>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                                <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Selection Mode</p>
                                <p className="text-xs text-white capitalize">{effect.selection_mode || 'Brush'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--color-brand)]/20"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    )
}

function SettingControl({ label, spec, value, onChange }) {
    const { type } = spec

    if (type === 'int' || type === 'float') {
        const step = type === 'int' ? 1 : 0.01
        return (
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-neutral-300">{label}</label>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        {type === 'int' ? value : Number(value).toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min={spec.min}
                    max={spec.max}
                    step={step}
                    value={value ?? spec.default}
                    onChange={(e) => onChange(type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] opacity-50">
                    <span>{spec.min}</span>
                    <span>{spec.max}</span>
                </div>
            </div>
        )
    }

    if (type === 'color') {
        return (
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">{label}</label>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">{value ?? spec.default}</span>
                    <input
                        type="color"
                        value={value ?? spec.default}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer"
                    />
                </div>
            </div>
        )
    }

    if (type === 'bool') {
        const checked = value ?? spec.default
        return (
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">{label}</label>
                <button
                    role="switch"
                    aria-checked={checked}
                    onClick={() => onChange(!checked)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-surface-3)]'
                        }`}
                >
                    <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>
        )
    }

    return null
}
