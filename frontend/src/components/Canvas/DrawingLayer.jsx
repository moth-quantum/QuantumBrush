import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'

export default function DrawingLayer({ width, height, scale, isPanMode, onPanStart, onPanMove, onPanEnd }) {
    const addStroke = useAppStore((s) => s.addStroke)
    const undoLastStroke = useAppStore((s) => s.undoLastStroke)
    const selectedEffectId = useAppStore((s) => s.selectedEffectId)

    const [currentPath, setCurrentPath] = useState([])
    const [previewPaths, setPreviewPaths] = useState([])
    const drawing = useRef(false)
    const svgRef = useRef(null)

    // Undo keyboard shortcut
    useEffect(() => {
        const handle = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                undoLastStroke()
                setPreviewPaths((p) => p.slice(0, -1))
            }
        }
        window.addEventListener('keydown', handle)
        return () => window.removeEventListener('keydown', handle)
    }, [undoLastStroke])

    const getImageCoords = useCallback(
        (e) => {
            const rect = svgRef.current.getBoundingClientRect()
            return [
                Math.round((e.clientX - rect.left) / rect.width * width),
                Math.round((e.clientY - rect.top) / rect.height * height),
            ]
        },
        [width, height]
    )

    const onPointerDown = useCallback(
        (e) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)

            if (isPanMode) {
                onPanStart(e.clientX, e.clientY)
                return
            }

            if (!selectedEffectId) return
            drawing.current = true
            const pt = getImageCoords(e)
            setCurrentPath([pt])
        },
        [isPanMode, selectedEffectId, getImageCoords, onPanStart]
    )

    const onPointerMove = useCallback(
        (e) => {
            if (isPanMode) {
                onPanMove(e.clientX, e.clientY)
                return
            }
            if (!drawing.current) return
            const pt = getImageCoords(e)
            setCurrentPath((prev) => {
                if (prev.length === 0) return [pt]
                const last = prev[prev.length - 1]
                if (last[0] === pt[0] && last[1] === pt[1]) return prev
                return [...prev, pt]
            })
        },
        [isPanMode, getImageCoords, onPanMove]
    )

    const onPointerUp = useCallback(
        (e) => {
            if (isPanMode) {
                onPanEnd()
                return
            }
            if (!drawing.current) return
            drawing.current = false
            const finalPath = currentPath
            if (finalPath.length >= 1) {
                addStroke(finalPath)
                setPreviewPaths((p) => [...p, finalPath])
            }
            setCurrentPath([])
        },
        [isPanMode, currentPath, addStroke, onPanEnd]
    )

    // Sync preview paths with undo
    const layers = useAppStore((s) => s.layers)
    useEffect(() => {
        const totalStrokes = layers
            .filter((l) => l.status === 'idle')
            .reduce((acc, l) => acc + l.strokes.length, 0)
        setPreviewPaths((prev) => {
            if (prev.length > totalStrokes) return prev.slice(0, totalStrokes)
            return prev
        })
    }, [layers])

    const effect = useAppStore.getState().effects.find(e => e.id === selectedEffectId)
    const isLassoEffect = (effect?.selection_mode === 'lasso') || (selectedEffectId === 'GoL' && (useAppStore.getState().activeSettings.Radius === 0))

    const pathToD = (pts, forceClose = false) => {
        if (pts.length === 0) return ''
        let d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
        if (forceClose && pts.length > 2) {
            d += ` Z`
        }
        return d
    }

    // Custom cursors for drawing
    const lassoCursor = `url("data:image/svg+xml,%3Csvg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7 3C4.23858 3 2 5.23858 2 8C2 10.7614 4.23858 13 7 13C7.57007 13 8.11332 12.9052 8.62121 12.7314L11.7513 15.8615C10.7093 17.5954 10.8248 19.8631 12.098 21.4547C13.3713 23.0463 15.5492 23.636 17.4727 22.9103C19.3962 22.1846 20.6713 20.2794 20.6215 18.214C20.5716 16.1486 19.206 14.3317 17.2514 13.7315L14.1213 10.6014C14.2952 10.0935 14.39 9.55024 14.39 8.98017C14.39 6.21875 12.1513 3.98001 9.38983 3.98001C8.61447 3.98001 7.88417 4.15615 7.2346 4.47141L7 3Z' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 6 6, crosshair`
    const brushCursor = `url("data:image/svg+xml,%3Csvg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2v20M2 12h20' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 9 9, crosshair`

    const customCursor = isLassoEffect ? lassoCursor : brushCursor

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: isPanMode ? 'grab' : customCursor,
                touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {previewPaths.map((pts, i) => {
                const layer = useAppStore.getState().layers.find(l => l.strokes.includes(pts))
                const layerEffect = useAppStore.getState().effects.find(e => e.id === layer?.effectId)
                const isLassoLayer = (layerEffect?.selection_mode === 'lasso') || (layer?.effectId === 'GoL' && (layer?.settings.Radius === 0))

                return pts.length === 1 ? (
                    <circle
                        key={i}
                        cx={pts[0][0]}
                        cy={pts[0][1]}
                        r={2.5 / scale}
                        fill="rgba(180,140,255,0.7)"
                    />
                ) : (
                    <path
                        key={i}
                        d={pathToD(pts, isLassoLayer)}
                        fill={isLassoLayer ? "rgba(160,120,255,0.15)" : "none"}
                        stroke="rgba(160,120,255,0.7)"
                        strokeWidth={2 / scale}
                        strokeDasharray={isLassoLayer ? `${5 / scale},${4 / scale}` : "none"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )
            })}

            {/* Current in-progress stroke */}
            {currentPath.length > 1 ? (
                <path
                    d={pathToD(currentPath, isLassoEffect)}
                    fill={isLassoEffect ? "rgba(200,160,255,0.2)" : "none"}
                    stroke="rgba(220,180,255,1)"
                    strokeWidth={3 / scale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ) : currentPath.length === 1 ? (
                <circle
                    cx={currentPath[0][0]}
                    cy={currentPath[0][1]}
                    r={3 / scale}
                    fill="rgba(220,180,255,1)"
                />
            ) : null}
        </svg>
    )
}