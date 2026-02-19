import { useStore } from "../../store";
import { ParamField } from "./ParamField";

export function ParameterForm() {
  const { selectedEffect, paramValues, setParamValue, resetParamDefaults } =
    useStore();

  if (!selectedEffect) return null;

  const entries = Object.entries(selectedEffect.user_input);

  return (
    <div className="mt-3 space-y-3">
      {selectedEffect.description && (
        <p className="text-xs text-text-muted whitespace-pre-line leading-relaxed">
          {selectedEffect.description}
        </p>
      )}

      {entries.map(([key, spec]) => (
        <ParamField
          key={key}
          name={key}
          spec={spec}
          value={paramValues[key]}
          onChange={(val) => setParamValue(key, val)}
        />
      ))}

      {entries.length > 0 && (
        <button
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
          onClick={resetParamDefaults}
        >
          Reset to defaults
        </button>
      )}
    </div>
  );
}
