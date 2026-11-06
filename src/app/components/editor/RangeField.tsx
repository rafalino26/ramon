"use client";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onBegin?: () => void;
  onEnd?: () => void;
}
export default function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  onBegin,
  onEnd,
}: Props) {
  return (
    <label className="range-field">
      <span>
        {label}
        <output>
          {Math.round(value)}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={onBegin}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onLostPointerCapture={onEnd}
      />
    </label>
  );
}
