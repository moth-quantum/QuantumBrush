import type { ParamSpec } from "../../types/effect";
import { Slider } from "../common/Slider";
import { ColorPicker } from "../common/ColorPicker";

interface ParamFieldProps {
  name: string;
  spec: ParamSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function ParamField({ name, spec, value, onChange }: ParamFieldProps) {
  switch (spec.type) {
    case "int":
      return (
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            {name}: {String(value ?? spec.default)}
          </label>
          <Slider
            min={spec.min ?? 0}
            max={spec.max ?? 100}
            step={1}
            value={Number(value ?? spec.default)}
            onChange={(v) => onChange(Math.round(v))}
          />
        </div>
      );

    case "float":
      return (
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            {name}: {Number(value ?? spec.default).toFixed(2)}
          </label>
          <Slider
            min={spec.min ?? 0}
            max={spec.max ?? 1}
            step={0.01}
            value={Number(value ?? spec.default)}
            onChange={onChange}
          />
        </div>
      );

    case "bool":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value ?? spec.default)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-bg-surface accent-accent"
          />
          <span className="text-xs text-text-secondary">{name}</span>
        </label>
      );

    case "color":
      return (
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            {name}
          </label>
          <ColorPicker
            value={String(value ?? spec.default ?? "#FF0000")}
            onChange={(c) => onChange(c)}
          />
        </div>
      );

    case "string":
      return (
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            {name}
          </label>
          <input
            type="text"
            value={String(value ?? spec.default ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      );

    default:
      return (
        <div className="text-xs text-text-muted">
          Unknown type: {spec.type} for {name}
        </div>
      );
  }
}
