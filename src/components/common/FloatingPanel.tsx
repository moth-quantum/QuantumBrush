import { X } from "lucide-react";

interface FloatingPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function FloatingPanel({ title, onClose, children, width = 200 }: FloatingPanelProps) {
  return (
    <div
      className="rounded-lg overflow-hidden shadow-xl"
      style={{
        width,
        background: "var(--color-bg-panel)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "var(--color-bg-panel-header)" }}
      >
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </span>
        <button
          className="text-text-muted hover:text-text-primary transition-colors"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
