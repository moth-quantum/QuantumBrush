import { useAppStore } from '../store/appStore'

export default function TitleBar() {
    const closeWindow = () => window.pywebview?.api?.close_window?.()
    const minimizeWindow = () => window.pywebview?.api?.minimize_window?.()
    const maximizeWindow = () => window.pywebview?.api?.maximize_window?.()

    return (
        <div className="h-8 flex items-center justify-between bg-[var(--color-surface)] border-b border-[var(--color-border)] select-none">
            {/* Drag Region */}
            <div className="flex-1 h-full flex items-center px-3 pywebview-drag-region cursor-default">
                <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span className="text-[10px] font-bold tracking-widest text-[var(--color-text-muted)] uppercase">QuantumBrush</span>
                </div>
            </div>

            {/* Window Controls */}
            <div className="flex h-full">
                <button
                    onClick={() => window.pywebview?.api?.minimize_window()}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 text-[var(--color-text-muted)] transition-colors"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <button
                    onClick={() => window.pywebview?.api?.toggle_maximize()}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 text-[var(--color-text-muted)] transition-colors"
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                </button>
                <button
                    onClick={() => window.pywebview?.api?.close_window()}
                    className="w-12 h-full flex items-center justify-center hover:bg-red-500 hover:text-white text-[var(--color-text-muted)] transition-colors"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    )
}
