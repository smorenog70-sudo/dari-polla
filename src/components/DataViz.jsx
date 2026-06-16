/**
 * Componentes de visualización reutilizables (SVG/CSS puro, sin librerías).
 */

// Barra comparativa horizontal: predicho vs real
export function CompareBar({ label, predPct, realPct, predLabel = 'Predicho', realLabel = 'Real' }) {
  return (
    <div className="mb-2.5">
      <div className="text-xs text-ink-200 mb-1">{label}</div>
      <div className="space-y-1">
        <Bar value={predPct} color="bg-brand-500" tag={predLabel} />
        <Bar value={realPct} color="bg-sky-500" tag={realLabel} />
      </div>
    </div>
  )
}

function Bar({ value, color, tag }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-ink-500 w-12 shrink-0">{tag}</span>
      <div className="flex-1 h-3 bg-ink-900 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-ink-300 w-8 text-right">{pct}%</span>
    </div>
  )
}

// Medidor de sesgo: una línea con un marcador de "predicho" vs "real"
export function BiasGauge({ predAvg, realAvg, max = 5 }) {
  const predPct = Math.min(100, (predAvg / max) * 100)
  const realPct = Math.min(100, (realAvg / max) * 100)
  const diff = predAvg - realAvg
  return (
    <div>
      <div className="relative h-8 bg-ink-900 rounded-lg overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-ink-700" style={{ width: `${realPct}%` }} />
        <div
          className="absolute inset-y-0 w-0.5 bg-brand-400"
          style={{ left: `${predPct}%` }}
          title="Predicho"
        />
      </div>
      <div className="flex justify-between text-[10px] mt-1">
        <span className="text-sky-400">Real: {realAvg.toFixed(2)}</span>
        <span className={diff > 0 ? 'text-brand-400' : 'text-ink-400'}>
          Predicho: {predAvg.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

// Donut de proporciones (3 segmentos) en SVG puro
export function DonutChart({ segments }) {
  // segments: [{ value, color, label }]
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const R = 40, C = 50, STROKE = 16
  const circ = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
        <circle cx={C} cy={C} r={R} fill="none" stroke="#1e293b" strokeWidth={STROKE} />
        {segments.map((seg, i) => {
          const frac = seg.value / total
          const dash = frac * circ
          const el = (
            <circle
              key={i}
              cx={C} cy={C} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${C} ${C})`}
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ background: seg.color }} />
            <span className="text-ink-200">{seg.label}</span>
            <span className="text-ink-500">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
