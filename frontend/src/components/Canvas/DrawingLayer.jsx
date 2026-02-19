import { useRef, useEffect, useCallback, useState } from 'react'
import { useAppStore } from '../../store/appStore.js'

/**
 * DrawingLayer — transparent SVG overlay that captures pointer events
 * and converts them to stroke paths in image coordinates.
 *
 * Props:
 *   width, height  — image dimensions in pixels
 *   scale          — current canvas scale factor (used only for stroke width display)
 */
export default function DrawingLayer({ width, height, scale }) {
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
            // rect.width/height is the rendered size (natural size * CSS scale).
            // Dividing by rect dimensions and multiplying by image dimensions
            // gives us true image-space coordinates regardless of zoom or pan.
            return [
                Math.round((e.clientX - rect.left) / rect.width * width),
                Math.round((e.clientY - rect.top) / rect.height * height),
            ]
        },
        [width, height]
    )

    const onPointerDown = useCallback(
        (e) => {
            if (!selectedEffectId) return
            if (e.button !== 0) return
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            const pt = getImageCoords(e)
            setCurrentPath([pt])
        },
        [selectedEffectId, getImageCoords]
    )

    const onPointerMove = useCallback(
        (e) => {
            if (!drawing.current) return
            const pt = getImageCoords(e)
            setCurrentPath((prev) => {
                if (prev.length === 0) return [pt]
                const last = prev[prev.length - 1]
                if (last[0] === pt[0] && last[1] === pt[1]) return prev
                return [...prev, pt]
            })
        },
        [getImageCoords]
    )

    const onPointerUp = useCallback(
        (e) => {
            if (!drawing.current) return
            drawing.current = false
            const finalPath = currentPath
            if (finalPath.length >= 2) {
                addStroke(finalPath)
                setPreviewPaths((p) => [...p, finalPath])
            }
            setCurrentPath([])
        },
        [currentPath, addStroke]
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

    // Paths are stored in image coords. SVG viewBox matches image dimensions,
    // so no manual coordinate scaling needed at all — SVG handles it via viewBox.
    const pathToD = (pts) => {
        if (pts.length === 0) return ''
        return pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
            .join(' ')
    }

    return (
        <svg
            ref={svgRef}
            // Natural image size — the parent CSS transform scales it visually
            width={width}
            height={height}
            // viewBox matches so coordinates == image pixels, no math needed
            viewBox={`0 0 ${width} ${height}`}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                cursor: selectedEffectId ? 'crosshair' : 'default',
                touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* Committed preview paths (dashed) */}
            {previewPaths.map((pts, i) => (
                <path
                    key={i}
                    d={pathToD(pts)}
                    fill="none"
                    stroke="rgba(255,0,0,0.5)"
                    strokeWidth={5 / scale}
                    strokeDasharray={`${4 / scale},${3 / scale}`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            {/* Current in-progress stroke */}
            {currentPath.length > 1 && (
                <path
                    d={pathToD(currentPath)}
                    fill="none"
                    stroke="rgba(255,0,0,0.5)"
                    strokeWidth={4 / scale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    )
}