import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import DrawingLayer from './DrawingLayer.jsx'

/**
 * CanvasView — renders the base image and all visible effect overlays.
 * Supports zoom (wheel), pan (middle-click drag, Space+drag, or Ctrl+drag),
 * and reset zoom/position button.
 */
export default function CanvasView() {
    const image = useAppStore((s) => s.image)
    const layers = useAppStore((s) => s.layers)
    const setImage = useAppStore((s) => s.setImage)

    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
    const [fitTransform, setFitTransform] = useState(null)
    const isPanning = useRef(false)
    const lastPan = useRef({ x: 0, y: 0 })
    const spaceHeld = useRef(false)
    const ctrlHeld = useRef(false)

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
            for (const layer of layers) {
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
    }, [image, layers])

    // Fit image to viewport on load — store it so reset can return here
    useEffect(() => {
        if (!image || !containerRef.current) return
        const { clientWidth: cw, clientHeight: ch } = containerRef.current
        const scale = Math.min(cw / image.width, ch / image.height, 1) * 0.92
        const x = (cw - image.width * scale) / 2
        const y = (ch - image.height * scale) / 2
        const fit = { scale, x, y }
        setFitTransform(fit)
        setTransform(fit)
    }, [image])

    const resetTransform = useCallback(() => {
        if (fitTransform) setTransform(fitTransform)
    }, [fitTransform])

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

    // Track Ctrl and Space keys
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true }
            if (e.key === 'Control') ctrlHeld.current = true
        }
        const onKeyUp = (e) => {
            if (e.code === 'Space') spaceHeld.current = false
            if (e.key === 'Control') { ctrlHeld.current = false; isPanning.current = false }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
        }
    }, [])

    // Pan via middle mouse, Space+drag, or Ctrl+drag
    const onMouseDown = useCallback((e) => {
        if (e.button === 1 || spaceHeld.current || ctrlHeld.current) {
            e.preventDefault()
            isPanning.current = true
            lastPan.current = { x: e.clientX, y: e.clientY }
        }
    }, [])

    const onMouseMove = useCallback((e) => {
        if (!isPanning.current) return
        const dx = e.clientX - lastPan.current.x
        const dy = e.clientY - lastPan.current.y
        lastPan.current = { x: e.clientX, y: e.clientY }
        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }, [])

    const onMouseUp = useCallback(() => { isPanning.current = false }, [])

    // Drag-and-drop image loading
    const onDragOver = (e) => e.preventDefault()
    const onDrop = useCallback((e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (!file || !file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const src = ev.target.result
            const img = new Image()
            img.onload = () => setImage({ src, width: img.naturalWidth, height: img.naturalHeight })
            img.src = src
        }
        reader.readAsDataURL(file)
    }, [setImage])

    const isPanMode = spaceHeld.current || ctrlHeld.current
    const cursor = isPanMode ? (isPanning.current ? 'grabbing' : 'grab') : 'default'

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
                    backgroundImage:
                        'repeating-conic-gradient(#1a1a2e 0% 25%, #111128 0% 50%)',
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
                    {/* Base rendered canvas */}
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', imageRendering: transform.scale > 4 ? 'pixelated' : 'auto' }}
                    />

                    {/* Drawing overlay for capturing strokes */}
                    <DrawingLayer
                        width={image.width}
                        height={image.height}
                        scale={transform.scale}
                    />
                </div>
            ) : (
                /* Empty state drop zone */
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

            {/* Bottom-right HUD: zoom indicator + reset button */}
            {image && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                        onClick={resetTransform}
                        className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)]/80 backdrop-blur px-2 py-1 rounded-md hover:text-white hover:bg-[var(--color-surface)] transition-colors"
                        title="Reset zoom and position"
                    >
                        Reset view
                    </button>
                    <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)]/80 backdrop-blur px-2 py-1 rounded-md pointer-events-none">
                        {Math.round(transform.scale * 100)}%
                    </div>
                </div>
            )}
        </div>
    )
}