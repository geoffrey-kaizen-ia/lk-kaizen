"use client";

// Slider de plage reutilisable. Track rempli jusqu'a la valeur courante (effet "bande"),
// reglable a la souris, borne par min/max. Utilise pour les cadences quotidiennes et,
// au besoin, pour d'autres reglages numeriques de la page settings.

export default function RangeSlider({
  label,
  value,
  min,
  max,
  onChange,
  valueSuffix = "",
  hint,
  name,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  valueSuffix?: string;
  hint?: string;
  name?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs font-medium text-text-muted">{label}</label>
        <span className="font-display text-lg font-semibold text-foreground">
          {value}
          {valueSuffix && (
            <span className="ml-1 text-xs font-normal text-text-dim">{valueSuffix}</span>
          )}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block h-2 w-full cursor-pointer appearance-none rounded-full outline-none
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-accent
          [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:transition-colors
          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-raised) ${pct}%, var(--panel-raised) 100%)`,
        }}
      />

      {name && <input type="hidden" name={name} value={value} />}

      {hint && <p className="mt-1.5 text-[10px] text-text-dim">{hint}</p>}
    </div>
  );
}
