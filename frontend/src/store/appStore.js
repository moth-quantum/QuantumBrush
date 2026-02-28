import { create } from 'zustand'
import { api } from '../api/bridge.js'
import { nanoid } from '../utils/nanoid.js'

/**
 * Global app state via Zustand.
 *
 * Key concepts:
 *  - `image`: the loaded base canvas image (base64 src + dims)
 *  - `effects`: available brush/effect descriptors from backend
 *  - `layers`: ordered list of EffectLayer objects
 *  - `selectedEffectId` + `activeSettings`: current brush selection
 *
 * Layer lifecycle: idle → running → done | error | aborted
 * Each layer has its own path history for per-layer undo.
 */

export const useAppStore = create((set, get) => ({
    // ── Image ──────────────────────────────────────────────────────
    image: null, // { src: string, width: number, height: number }

    setImage: (image) => set({ image }),

    resetProject: () => {
        const { layers } = get()
        layers.forEach(l => {
            if (l.jobId && l.status === 'running') {
                api.abortJob(l.jobId)
            }
        })
        set({ image: null, layers: [] })
    },

    // ── Settings ───────────────────────────────────────────────────
    isQuickMode: true,
    toggleQuickMode: () => set((s) => ({ isQuickMode: !s.isQuickMode })),

    // ── Effects (brush descriptors) ────────────────────────────────
    effects: [],
    effectsLoaded: false,

    loadEffects: async () => {
        const effects = await api.listEffects()
        set({ effects, effectsLoaded: true })
    },

    // ── Brush selection ────────────────────────────────────────────
    selectedEffectId: null,
    activeSettings: {},

    selectEffect: (effectId) => {
        const { effects } = get()
        const effect = effects.find((e) => e.id === effectId)
        if (!effect) return
        const defaults = {}
        for (const [k, v] of Object.entries(effect.user_input)) {
            defaults[k] = v.default
        }
        set({ selectedEffectId: effectId, activeSettings: defaults })
    },

    updateSetting: (key, value) =>
        set((s) => ({ activeSettings: { ...s.activeSettings, [key]: value } })),

    // ── Layers ─────────────────────────────────────────────────────
    layers: [],

    /**
     * Called when user finishes a stroke (pointerup).
     * Appends to current layer if same effect+settings, else creates new layer.
     */
    addStroke: (path) => {
        const { selectedEffectId, activeSettings, effects, layers } = get()
        if (!selectedEffectId || path.length < 2) return

        const effect = effects.find((e) => e.id === selectedEffectId)
        if (!effect) return

        const settingsKey = JSON.stringify(activeSettings)

        // Check if top layer matches current effect + settings and is idle
        const topLayer = layers[layers.length - 1]
        if (
            topLayer &&
            topLayer.effectId === selectedEffectId &&
            topLayer.settingsKey === settingsKey &&
            topLayer.status === 'idle'
        ) {
            set((s) => ({
                layers: s.layers.map((l) =>
                    l.id === topLayer.id ? { ...l, strokes: [...l.strokes, path] } : l
                ),
            }))
        } else {
            // Create a new layer
            const newLayer = {
                id: nanoid(),
                effectId: selectedEffectId,
                effectName: effect.name,
                settings: { ...activeSettings },
                settingsKey,
                strokes: [path],
                status: 'idle', // idle | running | done | error | aborted
                visible: true,
                resultSrc: null, // base64 PNG of computed result (transparent layer)
                compositeSrc: null, // base64 PNG of full composed canvas at this step (Quick Mode only)
                jobId: null,
                progress: 0,
            }
            set((s) => ({ layers: [...s.layers, newLayer] }))
        }
    },

    /** Undo the last stroke. In quick mode, deletes the topmost valid layer. */
    undoLastStroke: () => {
        const { layers, isQuickMode } = get()
        // Find topmost layer that is not aborted or errored (essentially 'idle' or 'done')
        // In quick mode we delete the whole layer as it represents the last history step.
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i]
            if ((layer.status === 'idle' || layer.status === 'done') && layer.strokes.length > 0) {
                if (isQuickMode || layer.strokes.length === 1) {
                    // Remove the layer entirely (either it's Quick Mode = delete whole step, or 1 stroke left)
                    set((s) => ({ layers: s.layers.filter((l) => l.id !== layer.id) }))
                } else {
                    // Normal mode: just pop the last stroke off the current layer
                    set((s) => ({
                        layers: s.layers.map((l) =>
                            l.id === layer.id
                                ? { ...l, strokes: l.strokes.slice(0, -1) }
                                : l
                        ),
                    }))
                }
                return
            }
        }
    },

    deleteLayer: (layerId) =>
        set((s) => ({ layers: s.layers.filter((l) => l.id !== layerId) })),

    reorderLayers: (from, to) =>
        set((s) => {
            const arr = [...s.layers]
            const [moved] = arr.splice(from, 1)
            arr.splice(to, 0, moved)
            return { layers: arr }
        }),

    toggleVisibility: (layerId) =>
        set((s) => ({
            layers: s.layers.map((l) =>
                l.id === layerId ? { ...l, visible: !l.visible } : l
            ),
        })),

    // ── Effect Processing ──────────────────────────────────────────

    runLayer: async (layerId) => {
        const { layers, image } = get()
        const layer = layers.find((l) => l.id === layerId)
        if (!layer || layer.status === 'running') return

        set((s) => ({
            layers: s.layers.map((l) =>
                l.id === layerId ? { ...l, status: 'running', progress: 0 } : l
            ),
        }))

        try {
            const effect = get().effects.find(e => e.id === layer.effectId)
            const isLasso = (effect?.selection_mode === 'lasso') || (layer.effectId === 'GoL' && layer.settings.Radius === 0)

            const adjustedStrokes = layer.strokes.map(stroke => {
                if (isLasso && stroke.length > 2) {
                    const start = stroke[0]
                    const end = stroke[stroke.length - 1]
                    if (start[0] !== end[0] || start[1] !== end[1]) {
                        return [...stroke, start]
                    }
                }
                return stroke
            })

            // When in Quick Mode, effects read from a canvas composited by all visible layers *before* them
            let effectiveImageB64 = image?.src?.split(',')[1]
            if (get().isQuickMode) {
                const compositedSrc = await createCompositeBefore(layerId, get)
                if (compositedSrc) {
                    effectiveImageB64 = compositedSrc.split(',')[1]
                }
            }

            const strokeInput = {
                path: adjustedStrokes.flat(),
                clicks: adjustedStrokes.map((s) => s[0]),
                image_width: image?.width ?? 800,
                image_height: image?.height ?? 600,
                image_b64: effectiveImageB64,
            }
            const { job_id } = await api.runEffect(layer.effectId, strokeInput, layer.settings)

            set((s) => ({
                layers: s.layers.map((l) => (l.id === layerId ? { ...l, jobId: job_id } : l)),
            }))

            // Poll for completion
            await pollJob(layerId, job_id, set, get)
        } catch (err) {
            set((s) => ({
                layers: s.layers.map((l) =>
                    l.id === layerId ? { ...l, status: 'error', progress: 0 } : l
                ),
            }))
        }
    },

    abortLayer: async (layerId) => {
        const layer = get().layers.find((l) => l.id === layerId)
        if (!layer?.jobId) return
        await api.abortJob(layer.jobId)
        set((s) => ({
            layers: s.layers.map((l) =>
                l.id === layerId ? { ...l, status: 'aborted', progress: 0 } : l
            ),
        }))
    },

    // ── Canvas Merge ───────────────────────────────────────────────

    /**
     * Merges a layer's result PNG into the base canvas image.
     * Composites the result over the current image, then updates image state.
     */
    mergeLayer: (layerId) => {
        const { layers, image } = get()
        const layer = layers.find((l) => l.id === layerId)
        if (!layer?.resultSrc || !image) return

        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')

        const baseImg = new Image()
        baseImg.onload = () => {
            ctx.drawImage(baseImg, 0, 0)
            const overlayImg = new Image()
            overlayImg.onload = () => {
                ctx.drawImage(overlayImg, 0, 0, image.width, image.height)
                const merged = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
                set((s) => ({
                    image: { ...s.image, src: `data:image/png;base64,${merged}` },
                    layers: s.layers.filter((l) => l.id !== layerId),
                }))
            }
            overlayImg.src = `data:image/png;base64,${layer.resultSrc}`
        }
        baseImg.src = image.src
    },

    // ── Export ─────────────────────────────────────────────────────

    exportImage: async () => {
        const { image, layers } = get()
        if (!image) return

        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')

        const loadImg = (src) =>
            new Promise((resolve) => {
                const img = new Image()
                img.onload = () => resolve(img)
                img.src = src
            })

        const base = await loadImg(image.src)
        ctx.drawImage(base, 0, 0)

        for (const layer of layers) {
            if (layer.visible && layer.resultSrc) {
                const overlay = await loadImg(`data:image/png;base64,${layer.resultSrc}`)
                ctx.drawImage(overlay, 0, 0, image.width, image.height)
            }
        }

        const merged = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
        await api.exportImage(merged)
    },
}))

// ── Helpers ──────────────────────────────────────────────────────

async function pollJob(layerId, jobId, set, get) {
    const POLL_INTERVAL = 400
    while (true) {
        await sleep(POLL_INTERVAL)

        // Check if aborted externally
        const current = get().layers.find((l) => l.id === layerId)
        if (!current || current.status === 'aborted') return

        const { status, progress, result } = await api.getJobStatus(jobId)

        if (status === 'done') {
            let compositeSrc = null;
            if (get().isQuickMode) {
                // If quick mode, generate the full composed render at this point
                // which includes all prior layers + this new result.
                // We mock evaluating up to this layer by passing it into createCompositeBefore, 
                // but wait, `createCompositeBefore` stops *before* the target layer.
                // Let's create `createCompositeUpTo` instead.
                compositeSrc = await createCompositeUpTo(layerId, result, get)
            }

            set((s) => ({
                layers: s.layers.map((l) =>
                    l.id === layerId
                        ? { ...l, status: 'done', progress: 1, resultSrc: result, compositeSrc }
                        : l
                ),
            }))
            return
        }

        if (status === 'error') {
            set((s) => ({
                layers: s.layers.map((l) =>
                    l.id === layerId ? { ...l, status: 'error', progress: 0 } : l
                ),
            }))
            return
        }

        set((s) => ({
            layers: s.layers.map((l) =>
                l.id === layerId ? { ...l, progress } : l
            ),
        }))
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const loadImg = (src) =>
    new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = src
    })

async function createCompositeBefore(layerId, get) {
    const { image, layers } = get()
    if (!image) return null

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    const base = await loadImg(image.src)
    ctx.drawImage(base, 0, 0)

    for (const layer of layers) {
        if (layer.id === layerId) break // Stop before the target layer
        if (layer.visible && layer.resultSrc && layer.status === 'done') {
            const overlay = await loadImg(`data:image/png;base64,${layer.resultSrc}`)
            ctx.drawImage(overlay, 0, 0, image.width, image.height)
        }
    }

    return canvas.toDataURL('image/png')
}

async function createCompositeUpTo(layerId, thisLayerResultSrc, get) {
    const { image, layers } = get()
    if (!image) return null

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    const base = await loadImg(image.src)
    ctx.drawImage(base, 0, 0)

    for (const layer of layers) {
        if (layer.id === layerId) {
            // Draw the current layer's result we just got
            const overlay = await loadImg(`data:image/png;base64,${thisLayerResultSrc}`)
            ctx.drawImage(overlay, 0, 0, image.width, image.height)
            break
        }
        if (layer.visible && layer.resultSrc && layer.status === 'done') {
            const overlay = await loadImg(`data:image/png;base64,${layer.resultSrc}`)
            ctx.drawImage(overlay, 0, 0, image.width, image.height)
        }
    }

    return canvas.toDataURL('image/png')
}
