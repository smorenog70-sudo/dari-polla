import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import {
  playedMatches,
  streaks,
  evolutionByFecha,
  achievements,
} from '../lib/playerStats'

export default function Progress() {
  const { user } = useAuth()
  const data = useLeagueData()

  const stats = useMemo(() => {
    if (data.loading) return null
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const myPreds = data.predictions.filter(p => p.user_id === user.id)
    const rows = playedMatches(myPreds, resultsById)
    const evolution = evolutionByFecha(myPreds, resultsById)
    const st = streaks(rows)

    // rows por usuario para el logro "rey de la fecha"
    const allRowsByUser = new Map()
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }
    for (const [uid, preds] of predsByUser) {
      allRowsByUser.set(uid, playedMatches(preds, resultsById))
    }

    const ach = achievements(rows, evolution, allRowsByUser, user.id)
    const totalPoints = rows.reduce((s, r) => s + r.points, 0)
    const exactCount = rows.filter(r => r.exact).length

    return { rows, evolution, st, ach, totalPoints, exactCount, played: rows.length }
  }, [data, user.id])

  if (data.loading || !stats) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const unlockedCount = stats.ach.filter(a => a.unlocked).length

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">📈 Mi progreso</h1>
        <p className="text-xs text-ink-300">Tu rendimiento, rachas y logros en la polla.</p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-brand-500">{stats.totalPoints}</div>
          <div className="text-[11px] text-ink-300 mt-0.5">Puntos</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-brand-500">{stats.exactCount}</div>
          <div className="text-[11px] text-ink-300 mt-0.5">Exactos</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-brand-500">{stats.played}</div>
          <div className="text-[11px] text-ink-300 mt-0.5">Jugados</div>
        </div>
      </div>

      {/* Rachas */}
      <div className="card">
        <h2 className="font-semibold mb-3">🔥 Rachas</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center bg-ink-900/50 rounded-lg py-3">
            <div className="text-3xl font-bold text-brand-500">{stats.st.current}</div>
            <div className="text-xs text-ink-300 mt-1">Racha actual</div>
            <div className="text-[10px] text-ink-500">aciertos seguidos</div>
          </div>
          <div className="text-center bg-ink-900/50 rounded-lg py-3">
            <div className="text-3xl font-bold text-brand-400">{stats.st.best}</div>
            <div className="text-xs text-ink-300 mt-1">Mejor racha</div>
            <div className="text-[10px] text-ink-500">tu récord</div>
          </div>
        </div>
        {stats.st.current >= 3 && (
          <p className="text-center text-sm text-brand-400 mt-3">
            ¡Estás en racha! 🔥 No la rompas.
          </p>
        )}
      </div>

      {/* Gráfica de evolución */}
      <div className="card">
        <h2 className="font-semibold mb-3">📊 Evolución por fecha</h2>
        {stats.evolution.length === 0 ? (
          <div className="text-sm text-ink-500 italic text-center py-4">
            Aún no hay resultados para graficar. Vuelve cuando se jueguen partidos.
          </div>
        ) : (
          <EvolutionChart data={stats.evolution} />
        )}
      </div>

      {/* Logros */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">🏅 Logros</h2>
          <span className="text-xs text-ink-300">{unlockedCount} / {stats.ach.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stats.ach.map(a => (
            <div
              key={a.id}
              className={`rounded-lg p-2.5 border ${
                a.unlocked
                  ? 'bg-brand-900/30 border-brand-600'
                  : 'bg-ink-900/40 border-ink-700 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${a.unlocked ? '' : 'grayscale'}`}>{a.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-[10px] text-ink-400 leading-tight">{a.desc}</div>
                </div>
              </div>
              {a.unlocked && (
                <div className="text-[10px] text-brand-400 mt-1 text-right">✓ desbloqueado</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Gráfica de línea del puntaje acumulado, dibujada con SVG puro (sin librerías).
 */
function EvolutionChart({ data }) {
  const W = 320
  const H = 160
  const PAD = { top: 16, right: 12, bottom: 28, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxCum = Math.max(...data.map(d => d.cumulative), 1)
  const n = data.length

  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => PAD.top + innerH - (v / maxCum) * innerH

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.cumulative).toFixed(1)}`)
    .join(' ')

  // Área bajo la curva
  const areaPath =
    `${linePath} L ${x(n - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {/* Líneas de referencia horizontales */}
        {[0, 0.5, 1].map(t => {
          const yy = PAD.top + innerH - t * innerH
          return (
            <g key={t}>
              <line x1={PAD.left} y1={yy} x2={W - PAD.right} y2={yy} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
              <text x={PAD.left - 4} y={yy + 3} textAnchor="end" fontSize="8" fill="#64748b">
                {Math.round(t * maxCum)}
              </text>
            </g>
          )
        })}

        {/* Área */}
        <path d={areaPath} fill="#f97316" fillOpacity="0.15" />
        {/* Línea */}
        <path d={linePath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />

        {/* Puntos + etiquetas */}
        {data.map((d, i) => (
          <g key={d.fecha}>
            <circle cx={x(i)} cy={y(d.cumulative)} r="3" fill="#f97316" />
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="7.5" fill="#cbd5e1">
              {shortLabel(d.label)}
            </text>
            <text x={x(i)} y={y(d.cumulative) - 7} textAnchor="middle" fontSize="8" fill="#fb923c" fontWeight="bold">
              {d.cumulative}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-ink-500 text-center mt-1">Puntos acumulados al cierre de cada fecha</p>
    </div>
  )
}

function shortLabel(label) {
  const map = {
    'Fecha 1': 'F1', 'Fecha 2': 'F2', 'Fecha 3': 'F3',
    'Dieciseisavos': '16vos', 'Octavos': '8vos', 'Cuartos': '4tos',
    'Semifinales': 'Semi', '3er puesto': '3er', 'Final': 'Final',
  }
  return map[label] || label
}
