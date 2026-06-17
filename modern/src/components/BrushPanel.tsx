import { useAppStore } from "../store/useAppStore";
import type { EffectSummary, ParamSpec } from "../types";

interface Props {
  effects: EffectSummary[];
}

/**
 * Builds a single parameter control from the brush JSON schema.
 * Mirrors UIManager.createGenericParameterPanel in the legacy Java app.
 */
function ParamControl({
  name,
  spec,
  value,
  onChange,
}: {
  name: string;
  spec: ParamSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const type = spec.type;

  if (type === "bool" || type === "boolean") {
    return (
      <label className="param-row">
        <span>{name}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (type === "int") {
    const min = spec.min ?? 0;
    const max = spec.max ?? 100;
    const num = typeof value === "number" ? value : Number(spec.default ?? min);
    return (
      <label className="param-row">
        <span>{name}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={num}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
        <em>{num}</em>
      </label>
    );
  }

  if (type === "float") {
    const min = spec.min ?? 0;
    const max = spec.max ?? 1;
    const num = typeof value === "number" ? value : Number(spec.default ?? min);
    return (
      <label className="param-row">
        <span>{name}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 100}
          value={num}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <em>{num.toFixed(2)}</em>
      </label>
    );
  }

  if (type === "color") {
    const hex = String(value ?? spec.default ?? "#ff0000");
    return (
      <label className="param-row">
        <span>{name}</span>
        <input
          type="color"
          value={hex.startsWith("#") ? hex : "#ff0000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <code>{hex}</code>
      </label>
    );
  }

  return (
    <label className="param-row">
      <span>{name}</span>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * Control Panel window — brush picker and dynamic parameters (legacy Control Panel).
 */
export function BrushPanel({ effects }: Props) {
  const selectedEffectId = useAppStore((s) => s.selectedEffectId);
  const parameters = useAppStore((s) => s.parameters);
  const setSelectedEffectId = useAppStore((s) => s.setSelectedEffectId);
  const setParameters = useAppStore((s) => s.setParameters);
  const setParameter = useAppStore((s) => s.setParameter);

  const effect = effects.find((e) => e.id === selectedEffectId);

  const selectEffect = (id: string) => {
    const fx = effects.find((e) => e.id === id);
    if (!fx) return;
    setSelectedEffectId(id);
    // Load defaults from effect/*_requirements.json
    const defaults: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(fx.user_input)) {
      defaults[key] = spec.default ?? "";
    }
    setParameters(defaults);
  };

  return (
    <aside className="panel brush-panel">
      <div className="panel-header">
        <h2>Control Panel</h2>
      </div>

      <div className="panel-body">
        <div className="stroke-legend">
          <span>
            <span className="legend-dot anchor" />
            Click = anchor
          </span>
          <span>
            <span className="legend-dot path" />
            Drag = path
          </span>
        </div>

        <label className="field">
          <span>Brush</span>
          <select
            value={selectedEffectId ?? ""}
            onChange={(e) => selectEffect(e.target.value)}
          >
            <option value="">Select brush…</option>
            {effects.map((fx) => (
              <option key={fx.id} value={fx.id}>
                {fx.name}
              </option>
            ))}
          </select>
        </label>

        {effect && (
          <>
            <p className="effect-desc">{effect.description}</p>
            <div>
              <p className="section-label">Parameters</p>
              <div className="params">
                {Object.entries(effect.user_input).map(([name, spec]) => (
                  <ParamControl
                    key={name}
                    name={name}
                    spec={spec}
                    value={parameters[name]}
                    onChange={(v) => setParameter(name, v)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
