import { useEffect } from 'react'
import { useAppStore } from '../../store/appStore.js'

/**
 * BrushPanel — left panel for selecting an effect and adjusting its settings.
 * The settings UI is dynamically generated from effect.user_input descriptors.
 */
export default function BrushPanel() {
    const effects = useAppStore((s) => s.effects)
    const effectsLoaded = useAppStore((s) => s.effectsLoaded)
    const loadEffects = useAppStore((s) => s.loadEffects)
    const selectedEffectId = useAppStore((s) => s.selectedEffectId)
    const selectEffect = useAppStore((s) => s.selectEffect)
    const activeSettings = useAppStore((s) => s.activeSettings)
    const updateSetting = useAppStore((s) => s.updateSetting)

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
            <div className="flex flex-col gap-1 p-2">
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
                        <span className="font-medium block">{effect.name}</span>
                        <span className="text-xs text-[var(--color-text-muted)] block truncate">{effect.id}</span>
                    </button>
                ))}
            </div>

            {/* Settings */}
            {selectedEffect && (
                <>
                    <div className="px-4 py-2.5 border-t border-[var(--color-border)] mt-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Settings</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4">
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

                    {/* Description */}
                    <div className="px-4 py-3 border-t border-[var(--color-border)] mt-auto">
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-4">
                            {selectedEffect.description}
                        </p>
                    </div>
                </>
            )}

            {!selectedEffect && (
                <div className="flex-1 flex items-center justify-center px-4">
                    <p className="text-xs text-[var(--color-text-muted)] text-center">
                        Select an effect above to begin drawing
                    </p>
                </div>
            )}
        </aside>
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
