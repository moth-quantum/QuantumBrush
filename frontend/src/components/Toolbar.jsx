import { useAppStore } from '../store/appStore.js'
import { api } from '../api/bridge.js'

/**
 * Top toolbar: logo, open image, undo, export
 */
export default function Toolbar() {
    const image = useAppStore((s) => s.image)
    const setImage = useAppStore((s) => s.setImage)
    const undoLastStroke = useAppStore((s) => s.undoLastStroke)
    const exportImage = useAppStore((s) => s.exportImage)

    const openFile = async () => {
        // Try pywebview native dialog first
        const result = await api.openImageDialog()
        if (result) {
            setImage(result)
            return
        }
        // Fallback: browser file input
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = () => {
            const file = input.files[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = (e) => {
                const src = e.target.result
                const img = new Image()
                img.onload = () =>
                    setImage({ src, width: img.naturalWidth, height: img.naturalHeight })
                img.src = src
            }
            reader.readAsDataURL(file)
        }
        input.click()
    }

    return (
        <header className="flex items-center gap-3 px-4 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 z-10">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-[var(--color-brand)]">
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
                    <circle cx="12" cy="2" r="1.5" fill="currentColor" opacity="0.6" />
                    <circle cx="22" cy="12" r="1.5" fill="currentColor" opacity="0.6" />
                    <circle cx="12" cy="22" r="1.5" fill="currentColor" opacity="0.6" />
                    <circle cx="2" cy="12" r="1.5" fill="currentColor" opacity="0.6" />
                </svg>
                <span className="text-sm font-semibold tracking-wide text-white">QuantumBrush</span>
            </div>

            {/* Open */}
            <ToolBtn onClick={openFile} title="Open Image (or drag & drop)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Open Image
            </ToolBtn>

            {/* Undo */}
            <ToolBtn onClick={undoLastStroke} title="Undo last stroke (Ctrl+Z)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.16 2.42L3 13" />
                </svg>
                Undo
            </ToolBtn>

            <div className="flex-1" />

            {/* Export */}
            <button
                onClick={exportImage}
                disabled={!image}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dim)] transition-colors
          disabled:opacity-30 disabled:cursor-not-allowed"
                title="Export merged image"
            >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7,10 12,15 17,10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
            </button>
        </header>
    )
}

function ToolBtn({ onClick, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300
        hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
        >
            {children}
        </button>
    )
}
