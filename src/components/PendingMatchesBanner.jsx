import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TOURNAMENT, formatKickoff } from '../lib/matches'
import { useNowTick } from '../lib/useNowTick'

const HOURS_AHEAD = 3              // partidos en las próximas 3 horas
const URGENT_MIN = 30               // urgente: faltan menos de 30 min para el cierre (40 min antes del pitazo)
const CRITICAL_MIN = 15             // crítico: < 15 min para cierre
const LOCK_OFFSET_MIN = 10          // partidos cierran 10 min antes del pitazo

function minutesUntil(targetMs, nowMs) {
  return Math.round((targetMs - nowMs) / 60000)
}

export default function PendingMatchesBanner({ userPredictions = [], resolveMatch }) {
  // re-render every 30s to recalculate countdowns
  const now = useNowTick(30000)

  const predictedSet = useMemo(
    () => new Set(userPredictions.map(p => p.match_id)),
    [userPredictions]
  )

  const upcoming = useMemo(() => {
    const cutoffMs = now + HOURS_AHEAD * 60 * 60 * 1000

    return TOURNAMENT.matches
      .filter(m => {
        if (!m.kickoff_utc) return false
        const ko = new Date(m.kickoff_utc).getTime()
        const lockTime = ko - LOCK_OFFSET_MIN * 60 * 1000
        // mostrar solo partidos cuyo cierre aún no pasó y arrancan dentro de la ventana
        return lockTime > now && ko < cutoffMs
      })
      .map(m => {
        const rm = resolveMatch ? resolveMatch(m) : m
        const ko = new Date(m.kickoff_utc).getTime()
        const lockTime = ko - LOCK_OFFSET_MIN * 60 * 1000
        const minsToLock = minutesUntil(lockTime, now)
        return {
          ...rm,
          minsToLock,
          minsToKickoff: minutesUntil(ko, now),
          predicted: predictedSet.has(m.id),
          urgent: minsToLock <= URGENT_MIN,
          critical: minsToLock <= CRITICAL_MIN,
        }
      })
      .sort((a, b) => a.minsToLock - b.minsToLock)
  }, [now, predictedSet])

  // no hay partidos próximos en la ventana
  if (upcoming.length === 0) return null

  // separar pendientes (sin pronóstico) de ya-pronosticados
  const pending = upcoming.filter(m => !m.predicted)
  const predicted = upcoming.filter(m => m.predicted)

  // si todos ya tienen pronóstico, mostramos un banner verde discreto
  if (pending.length === 0) {
    return (
      <div className="card border-green-700/40 bg-green-900/20">
        <div className="flex items-start gap-3">
          <div className="text-2xl">✅</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-green-300 text-sm">
              Todo al día
            </div>
            <div className="text-xs text-green-200/80 mt-0.5">
              Ya pronosticaste {predicted.length === 1 ? 'el partido' : `los ${predicted.length} partidos`} de las próximas {HOURS_AHEAD} horas. ¡Que comience el espectáculo!
            </div>
          </div>
        </div>
      </div>
    )
  }

  // si hay pendientes, banner de alerta
  const mostUrgent = pending[0]
  const isCritical = mostUrgent.critical
  const isUrgent = mostUrgent.urgent

  // colores según urgencia
  const wrapClass = isCritical
    ? 'card border-red-500/60 bg-red-900/30 animate-pulse'
    : isUrgent
      ? 'card border-orange-500/60 bg-orange-900/30'
      : 'card border-brand-500/40 bg-brand-500/10'

  const titleColor = isCritical ? 'text-red-300' : isUrgent ? 'text-orange-300' : 'text-brand-500'

  return (
    <Link to="/predicciones" className={`block ${wrapClass} hover:opacity-90 transition`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">
          {isCritical ? '🚨' : isUrgent ? '⏰' : '⚠️'}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${titleColor}`}>
            {pending.length === 1
              ? '¡Tienes 1 pronóstico pendiente!'
              : `¡Tienes ${pending.length} pronósticos pendientes!`}
          </div>
          <div className="text-xs text-ink-100/90 mt-2 space-y-1.5">
            {pending.slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {m.team1} <span className="text-ink-300">vs</span> {m.team2}
                </span>
                <span className={`font-mono text-xs whitespace-nowrap ${
                  m.critical ? 'text-red-300 font-bold' :
                  m.urgent ? 'text-orange-300' :
                  'text-ink-300'
                }`}>
                  {m.minsToLock <= 0
                    ? 'cierra ya'
                    : m.minsToLock < 60
                      ? `${m.minsToLock} min`
                      : `${Math.floor(m.minsToLock / 60)}h ${m.minsToLock % 60}m`
                  }
                </span>
              </div>
            ))}
            {pending.length > 4 && (
              <div className="text-ink-300 italic">y {pending.length - 4} más…</div>
            )}
          </div>
          <div className="text-xs text-ink-100/70 mt-2 underline">
            Toca para ir a pronosticar →
          </div>
        </div>
      </div>
    </Link>
  )
}
