import { worldCupProgress } from '../lib/worldCupProgress'

/** Barra de progreso simple con etiqueta */
function ProgressBar({ label, played, total, color = '#f97316', suffix = '' }) {
  const pct = total ? Math.round((played / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-ink-300">{label}</span>
        <span className="text-xs text-ink-200 font-semibold">
          {played}<span className="text-ink-500">/{total}{suffix}</span>
        </span>
      </div>
      <div className="h-2 bg-ink-900/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/**
 * Panel "Así va el Mundial" — visible para todos en el Home.
 * Muestra el avance del torneo (partidos, días) y de los puntos en juego
 * de la polla (marcadores, quién pasa, grupos, terceros).
 */
export default function WorldCupProgressCard({ data }) {
  if (data.loading) return null
  const p = worldCupProgress(data)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">🌍 Así va el Mundial</h2>
        <span className="text-xs text-brand-400 font-bold">{p.pct.matches}% jugado</span>
      </div>

      <div className="space-y-3">
        <ProgressBar label="⚽ Partidos jugados" played={p.matches.played} total={p.matches.total} color="#f97316" />
        <ProgressBar label="📅 Días del torneo" played={p.days.passed} total={p.days.total} color="#38bdf8" />
      </div>

      <div className="mt-4 pt-3 border-t border-ink-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-ink-400 font-semibold">🎯 Puntos en juego</span>
          <span className="text-xs text-ink-300">
            <span className="text-brand-400 font-bold">{p.points.remaining}</span> por jugar
          </span>
        </div>
        <div className="space-y-2.5">
          <ProgressBar label="Marcadores" played={p.points.breakdown.match.played} total={p.points.breakdown.match.total} color="#f97316" suffix=" pts" />
          <ProgressBar label="¿Quién pasa? (playoffs)" played={p.points.breakdown.advances.played} total={p.points.breakdown.advances.total} color="#fbbf24" suffix=" pts" />
          <ProgressBar label="Posiciones de grupo" played={p.points.breakdown.groupPos.played} total={p.points.breakdown.groupPos.total} color="#a78bfa" suffix=" pts" />
          <ProgressBar label="Mejores terceros" played={p.points.breakdown.thirds.played} total={p.points.breakdown.thirds.total} color="#34d399" suffix=" pts" />
        </div>
        <div className="mt-3 text-center text-xs text-ink-300">
          De <span className="font-bold text-ink-100">{p.points.total}</span> puntos posibles,
          ya se jugaron <span className="font-bold text-brand-300">{p.points.played}</span>
          {' '}({p.pct.points}%)
        </div>
      </div>
    </div>
  )
}
