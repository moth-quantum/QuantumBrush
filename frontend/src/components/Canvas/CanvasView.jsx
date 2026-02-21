import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import DrawingLayer from './DrawingLayer.jsx'

export default function CanvasView() {
    const image = useAppStore((s) => s.image)
    const layers = useAppStore((s) => s.layers)
    const setImage = useAppStore((s) => s.setImage)
    const isQuickMode = useAppStore((s) => s.isQuickMode)

    // Compute a primitive string to track only visual state changes for the canvas compositor
    const drawRenderKey = layers.map(l => `${l.id}-${l.visible}-${Boolean(l.resultSrc)}`).join(',')
    const hasRunningLayer = layers.some(l => l.status === 'running')

    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
    const [isPanMode, setIsPanMode] = useState(false)
    const [isActivePan, setIsActivePan] = useState(false)
    const isPanning = useRef(false)
    const lastPan = useRef({ x: 0, y: 0 })

    // Draw image + overlays on canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !image) return
        const ctx = canvas.getContext('2d')
        canvas.width = image.width
        canvas.height = image.height
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const drawBase = new Promise((resolve) => {
            const img = new Image()
            img.onload = () => { ctx.drawImage(img, 0, 0); resolve() }
            img.src = image.src
        })

        drawBase.then(async () => {
            // Fetch fresh layers from store without tying them to the dependency array
            const currentLayers = useAppStore.getState().layers
            for (const layer of currentLayers) {
                if (!layer.visible || !layer.resultSrc) continue
                await new Promise((resolve) => {
                    const overlay = new Image()
                    overlay.onload = () => {
                        ctx.drawImage(overlay, 0, 0, image.width, image.height)
                        resolve()
                    }
                    overlay.src = `data:image/png;base64,${layer.resultSrc}`
                })
            }
        })
    }, [image, drawRenderKey]) // Use primitive string to prevent unnecessary clearing/flickering on progress ticks

    // Fit image exactly to current viewport bounds
    const fitView = useCallback(() => {
        if (!image || !containerRef.current) return
        const { clientWidth: cw, clientHeight: ch } = containerRef.current
        const scale = Math.min(cw / image.width, ch / image.height, 1) * 0.92
        const x = (cw - image.width * scale) / 2
        const y = (ch - image.height * scale) / 2
        setTransform({ scale, x, y })
    }, [image])

    // Fit image to viewport on load
    const [lastFittedSrc, setLastFittedSrc] = useState(null)
    useEffect(() => {
        if (image && image.src !== lastFittedSrc) {
            fitView()
            setLastFittedSrc(image.src)
        }
    }, [image, fitView, lastFittedSrc])

    // Zoom on wheel
    const onWheel = useCallback((e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setTransform((t) => {
            const newScale = Math.max(0.05, Math.min(20, t.scale * delta))
            const rect = containerRef.current.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top
            const imgX = (mouseX - t.x) / t.scale
            const imgY = (mouseY - t.y) / t.scale
            return {
                scale: newScale,
                x: mouseX - imgX * newScale,
                y: mouseY - imgY * newScale,
            }
        })
    }, [])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [onWheel])

    // Track Ctrl and Space keys — use state so cursor re-renders
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space' || e.key === 'Control') {
                e.preventDefault()
                setIsPanMode(true)
            }
        }
        const onKeyUp = (e) => {
            if (e.code === 'Space' || e.key === 'Control') {
                setIsPanMode(false)
                setIsActivePan(false)
                isPanning.current = false
            }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    }, [])

    // Called by DrawingLayer when pan mode pointer events fire
    const onPanStart = useCallback((clientX, clientY) => {
        isPanning.current = true
        setIsActivePan(true)
        lastPan.current = { x: clientX, y: clientY }
    }, [])

    const onPanMove = useCallback((clientX, clientY) => {
        if (!isPanning.current) return
        const dx = clientX - lastPan.current.x
        const dy = clientY - lastPan.current.y
        lastPan.current = { x: clientX, y: clientY }
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }, [])

    const onPanEnd = useCallback(() => {
        isPanning.current = false
        setIsActivePan(false)
    }, [])

    // Middle-mouse pan on the container itself (outside image area)
    const onMouseDown = useCallback((e) => {
        if (e.button === 1) {
            e.preventDefault()
            onPanStart(e.clientX, e.clientY)
        }
    }, [onPanStart])

    const onMouseMove = useCallback((e) => {
        onPanMove(e.clientX, e.clientY)
    }, [onPanMove])

    const onMouseUp = useCallback(() => {
        onPanEnd()
    }, [onPanEnd])

    // Drag-and-drop image loading
    const onDragOver = (e) => e.preventDefault()
    const onDrop = useCallback((e) => {
        e.preventDefault()
        const store = useAppStore.getState()
        if (store.image && store.layers.length > 0) {
            if (!window.confirm('You have unsaved layers. Are you sure you want to load a new image and discard them?')) {
                return
            }
        }

        const file = e.dataTransfer.files[0]
        if (!file || !file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const src = ev.target.result
            const img = new Image()
            img.onload = () => {
                store.resetProject()
                setImage({ src, width: img.naturalWidth, height: img.naturalHeight })
            }
            img.src = src
        }
        reader.readAsDataURL(file)
    }, [setImage])

    const selectedEffectId = useAppStore((s) => s.selectedEffectId)
    const effects = useAppStore((s) => s.effects)
    const selectedEffect = effects.find((e) => e.id === selectedEffectId)

    const cursor = isPanMode ? (isActivePan ? 'grabbing' : 'grab') : 'default'

    return (
        <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-[#0a0a0f] select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{ cursor }}
        >
            {/* Checkerboard background */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: 'repeating-conic-gradient(#1a1a2e 0% 25%, #111128 0% 50%)',
                    backgroundSize: '24px 24px',
                }}
            />

            {image ? (
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', imageRendering: transform.scale > 4 ? 'pixelated' : 'auto' }}
                    />
                    <DrawingLayer
                        width={image.width}
                        height={image.height}
                        scale={transform.scale}
                        isPanMode={isPanMode}
                        onPanStart={onPanStart}
                        onPanMove={onPanMove}
                        onPanEnd={onPanEnd}
                    />
                    {isQuickMode && hasRunningLayer && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1px] cursor-not-allowed">
                            <div className="flex items-center gap-3 px-6 py-3 bg-black/80 border border-white/10 rounded-full shadow-2xl text-white font-medium tracking-wide">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin text-amber-400">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                Applying Effect...
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                    <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] px-16 py-14 flex flex-col items-center gap-4 pointer-events-auto">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[var(--color-text-muted)]">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                        </svg>
                        <p className="text-[var(--color-text-muted)] text-sm text-center leading-relaxed">
                            Drop an image here<br />or use <span className="text-neutral-400 font-medium">Open Image</span> in the toolbar
                        </p>
                    </div>
                </div>
            )}

            {/* Zoom level indicator */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300 pointer-events-none">
                <span className="text-[10px] font-bold text-white/50 tracking-wider">ZOOM</span>
                <span className="text-xs font-mono font-medium text-[var(--color-brand)]">{Math.round(transform.scale * 100)}%</span>
            </div>

            {/* Effect Instructions Hint */}
            {selectedEffect?.usage_instructions && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-700 pointer-events-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--color-brand)]">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span className="text-xs font-medium text-white/90">{selectedEffect.usage_instructions}</span>
                </div>
            )}

            {image && (
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                    {/* Context hint */}
                    <span className="text-xs text-[var(--color-text-muted)]/50 pointer-events-none select-none">
                        {isPanMode ? 'Panning…' : 'Hold Ctrl to pan'}
                    </span>
                    <button
                        onClick={fitView}
                        className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)]/80 backdrop-blur px-2.5 py-1.5 rounded-lg border border-white/5 hover:text-white hover:bg-[var(--color-surface)] transition-all active:scale-95 flex items-center gap-1.5"
                        title="Fit image to screen"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 14v6h6M20 10V4h-6M10 20H4v-6M14 4h6v6" />
                        </svg>
                        Fit
                    </button>
                </div>
            )}
        </div>
    )
}