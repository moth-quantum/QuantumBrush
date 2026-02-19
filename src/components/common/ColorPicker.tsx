import { useState } from "react";
import { HexColorPicker } from "react-colorful";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded border-2 border-border cursor-pointer flex-shrink-0"
          style={{ backgroundColor: value }}
          onClick={() => setShowPicker(!showPicker)}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
              onChange(v);
            }
          }}
          className="flex-1 bg-bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary font-mono focus:outline-none focus:border-accent"
          maxLength={7}
        />
      </div>

      {showPicker && (
        <div className="absolute z-50 mt-2 left-0">
          <div
            className="fixed inset-0"
            onClick={() => setShowPicker(false)}
          />
          <div className="relative bg-bg-surface border border-border rounded-lg p-2 shadow-lg">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}
