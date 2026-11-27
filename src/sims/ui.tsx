// Building blocks shared by the concept simulators, so they look and behave
// alike: labelled sliders and choices that work with the keyboard, panels,
// bars and stats. Colours come from the theme tokens, so dark mode just works.
import { type ReactNode, useId } from 'react'

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Formats the value shown next to the label and read out by screen readers. */
  format?: (value: number) => string
  hint?: string
}

export function Slider({ label, value, min, max, step, onChange, format = String, hint }: SliderProps) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span aria-hidden="true" className="font-mono text-sm">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

interface ChoiceProps<T extends string> {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
}

/** A row of toggle buttons that behaves as a radio group. */
export function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === value}
            onClick={() => onChange(o.id)}
            className={`rounded border px-3 py-1 text-sm ${o.id === value ? 'border-brand bg-brand text-chalk' : 'border-slate-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** A horizontal bar for a value between 0 and 1. Muted bars are drawn grey. */
export function Bar({ label, fraction, text, muted = false }: { label: ReactNode; fraction: number; text: string; muted?: boolean }) {
  return (
    <div className={`grid grid-cols-[minmax(5rem,9rem)_1fr_3.5rem] items-center gap-2 text-sm ${muted ? 'text-slate-400' : ''}`}>
      <span className="truncate font-mono">{label}</span>
      <span className="h-3 rounded bg-slate-100" aria-hidden="true">
        <span className={`block h-3 rounded ${muted ? 'bg-slate-300' : 'bg-brand'}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
      </span>
      <span className="text-right font-mono">{text}</span>
    </div>
  )
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-mono text-xl font-semibold">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  )
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`
