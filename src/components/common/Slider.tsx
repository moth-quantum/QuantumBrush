interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

export function Slider({ min, max, step, value, onChange }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-bg-hover rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-bg-primary
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110"
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${percentage}%, var(--color-bg-hover) ${percentage}%)`,
        }}
      />
    </div>
  );
}
