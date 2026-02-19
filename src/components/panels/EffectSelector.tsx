import { useState, useRef, useEffect } from "react";
import { useStore } from "../../store";
import { ChevronDown } from "lucide-react";

export function EffectSelector() {
  const { effects, selectedEffect, setSelectedEffect } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        className="w-full bg-bg-surface border border-border rounded px-3 py-1.5 text-sm text-left flex items-center justify-between hover:border-border-light focus:outline-none focus:border-accent transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedEffect ? "text-text-primary" : "text-text-muted"}>
          {selectedEffect?.name || "Select an effect..."}
        </span>
        <ChevronDown
          size={14}
          className={`text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-bg-surface border border-border rounded shadow-lg z-50 max-h-60 overflow-y-auto">
          {effects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No effects loaded</div>
          ) : (
            effects.map((effect) => (
              <button
                key={effect.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-hover transition-colors ${
                  selectedEffect?.id === effect.id
                    ? "bg-accent/15 text-accent"
                    : "text-text-primary"
                }`}
                onClick={() => {
                  setSelectedEffect(effect);
                  setIsOpen(false);
                }}
              >
                <div className="font-medium">{effect.name}</div>
                <div className="text-xs text-text-muted truncate mt-0.5">
                  {effect.id}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
