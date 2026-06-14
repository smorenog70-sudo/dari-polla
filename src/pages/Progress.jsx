import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import {
  playedMatches,
  streaks,
  evolutionByMatch,
  achievements,
} from '../lib/playerStats'
import {
  bettingProfile,
  pointsBreakdown,
  efficiencyVsGroup,
  bestAndWorst,
  personalGoalBias,
} from '../lib/analytics'
import { BiasGauge, DonutChart } from '../components/DataViz'

export default function Progress() {
  const { user } = useAuth()
  const data = useLeagueData()

  const stats = useMemo(() => {
    if (data.loading) return null
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const myPreds = data.predictions.filter(p => p.user_id === user.id)
    const rows = playedMatches(myPreds, resultsById)
    const evolution = evolutionByMatch(myPreds, resultsById)
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

    // Medalla GOAT: ¿es el #1 de la tabla general por puntos de partidos?
    const totalsByUser = []
    for (const [uid, urows] of allRowsByUser) {
      totalsByUser.push({ uid, pts: urows.reduce((s, x) => s + x.points, 0) })
    }
    totalsByUser.sort((a, b) => b.pts - a.pts)
    const myTotal = totalsByUser.find(t => t.uid === user.id)
    const isGoat = totalsByUser.length > 1 && myTotal && myTotal.pts > 0 &&
      totalsByUser[0].uid === user.id
    const goat = ach.find(a => a.id === 'goat')
    if (goat) goat.unlocked = isGoat
    const totalPoints = rows.reduce((s, r) => s + r.points, 0)
    const exactCount = rows.filter(r => r.exact).length

    // Análisis personal estilo data scientist
    const profile = bettingProfile(myPreds, resultsById)
    const breakdown = pointsBreakdown(myPreds, resultsById)
    const efficiency = efficiencyVsGroup(user.id, data.predictions, resultsById)
    const extremes = bestAndWorst(myPreds, resultsById)
    const goalBias = personalGoalBias(myPreds, resultsById)

    return {
      rows, evolution, st, ach, totalPoints, exactCount, played: rows.length,
      profile, breakdown, efficiency, extremes, goalBias,
    }
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
        <h2 className="font-semibold mb-3">📊 Evolución por partido</h2>
        {stats.evolution.length === 0 ? (
          <div className="text-sm text-ink-500 italic text-center py-4">
            Aún no hay resultados para graficar. Vuelve cuando se jueguen partidos.
          </div>
        ) : (
          <EvolutionChart data={stats.evolution} />
        )}
      </div>

      {/* === ANÁLISIS PERSONAL (data scientist) === */}
      {stats.played > 0 && (
        <PersonalAnalysis stats={stats} />
      )}

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
function PersonalAnalysis({ stats }) {
  const { profile, breakdown, efficiency, extremes, goalBias } = stats
  if (!profile) return null

  const goalDiff = goalBias.predAvg - goalBias.realAvg
  const ppmDiff = efficiency.myPpm - efficiency.groupAvg

  // Donut del desglose de puntos
  const b = breakdown.acc
  const segments = [
    { value: b.outcome, color: '#f97316', label: 'Ganador' },
    { value: b.exact, color: '#fb923c', label: 'Exacto' },
    { value: b.home + b.away, color: '#fdba74', label: 'Goles' },
    { value: b.diff, color: '#7c2d12', label: 'Diferencia' },
  ].filter(s => s.value > 0)

  return (
    <>
      {/* Tu arquetipo de apostador */}
      <div className="card bg-brand-900/20 border-brand-600/40">
        <h2 className="font-semibold mb-2">🧬 Tu perfil de apostador</h2>
        <div className="flex items-center gap-3">
          <div className="text-4xl">{profile.emoji}</div>
          <div>
            <div className="text-lg font-bold text-brand-400">{profile.archetype}</div>
            <div className="text-xs text-ink-300">{profile.desc}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
          <div className="bg-ink-900/50 rounded-lg py-2">
            <div className="font-bold text-brand-400">{profile.goalsAvg.toFixed(1)}</div>
            <div className="text-ink-400">goles/pred</div>
          </div>
          <div className="bg-ink-900/50 rounded-lg py-2">
            <div className="font-bold text-brand-400">{Math.round(profile.drawRate * 100)}%</div>
            <div className="text-ink-400">empates</div>
          </div>
          <div className="bg-ink-900/50 rounded-lg py-2">
            <div className="font-bold text-brand-400">{profile.avgDiff.toFixed(1)}</div>
            <div className="text-ink-400">dif. media</div>
          </div>
        </div>
      </div>

      {/* Eficiencia vs el grupo */}
      <div className="card">
        <h2 className="font-semibold mb-1">📐 Tu eficiencia vs el grupo</h2>
        <p className="text-xs text-ink-300 mb-3">Puntos que sacas por partido jugado.</p>
        <div className="flex items-end gap-4">
          <div>
            <div className="text-3xl font-bold text-brand-500">{efficiency.myPpm.toFixed(2)}</div>
            <div className="text-xs text-ink-400">tus pts/partido</div>
          </div>
          <div className="text-ink-500 text-sm mb-1">vs</div>
          <div>
            <div className="text-2xl font-bold text-ink-300">{efficiency.groupAvg.toFixed(2)}</div>
            <div className="text-xs text-ink-400">promedio grupo</div>
          </div>
        </div>
        <p className="text-sm mt-3">
          {Math.abs(ppmDiff) < 0.1
            ? '⚖️ Estás justo en la media del grupo.'
            : ppmDiff > 0
              ? `🔥 Estás ${ppmDiff.toFixed(2)} pts/partido por ENCIMA del promedio. Mejor que el ${efficiency.percentile}% del grupo.`
              : `📉 Estás ${Math.abs(ppmDiff).toFixed(2)} pts/partido por debajo del promedio. Vas mejor que el ${efficiency.percentile}% del grupo.`}
        </p>
      </div>

      {/* De dónde sacas tus puntos */}
      {segments.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">🍩 De dónde salen tus puntos</h2>
          <p className="text-xs text-ink-300 mb-3">El desglose de tus {breakdown.total} puntos.</p>
          <DonutChart segments={segments} />
          <p className="text-[11px] text-ink-500 mt-3">
            {b.exact >= b.outcome
              ? '🎯 Buena parte viene de marcadores exactos — eres preciso.'
              : 'La mayoría viene de acertar el ganador. Atrévete a marcadores exactos para sumar más.'}
          </p>
        </div>
      )}

      {/* Tu sesgo de goles */}
      <div className="card">
        <h2 className="font-semibold mb-1">⚽ Tu sesgo de goles</h2>
        <p className="text-xs text-ink-300 mb-3">¿Predices más o menos goles de los que pasan?</p>
        <BiasGauge predAvg={goalBias.predAvg} realAvg={goalBias.realAvg} max={6} />
        <p className="text-sm mt-3">
          {Math.abs(goalDiff) < 0.2
            ? '🎯 Tu olfato para los goles está bien calibrado.'
            : goalDiff > 0
              ? `📈 Eres optimista: predices ${goalDiff.toFixed(2)} goles de más por partido.`
              : `📉 Eres conservador: predices ${Math.abs(goalDiff).toFixed(2)} goles de menos por partido.`}
        </p>
      </div>

      {/* Mejor y peor momento */}
      {extremes.best && (
        <div className="card">
          <h2 className="font-semibold mb-3">🏔️ Tu mejor y peor momento</h2>
          <div className="space-y-2">
            <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-2">
              <div className="text-[10px] text-green-400 uppercase tracking-wider">Tu obra maestra (+{extremes.best.points})</div>
              <div className="text-sm">{extremes.best.label}</div>
              <div className="text-xs text-ink-400">Predijiste: {extremes.best.predicted}</div>
            </div>
            {extremes.worst && extremes.worst.label !== extremes.best.label && (
              <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-2">
                <div className="text-[10px] text-red-400 uppercase tracking-wider">A olvidar (+{extremes.worst.points})</div>
                <div className="text-sm">{extremes.worst.label}</div>
                <div className="text-xs text-ink-400">Predijiste: {extremes.worst.predicted}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function EvolutionChart({ data }) {
  const n = data.length
  const H = 180
  const PAD = { top: 16, right: 14, bottom: 30, left: 30 }
  // Ancho dinámico: ~26px por partido, mínimo 290. Con muchos, scroll horizontal.
  const innerW = Math.max(260, n * 26)
  const W = innerW + PAD.left + PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxCum = Math.max(...data.map(d => d.cumulative), 1)

  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => PAD.top + innerH - (v / maxCum) * innerH

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.cumulative).toFixed(1)}`)
    .join(' ')

  const areaPath =
    `${linePath} L ${x(n - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`

  // Mostrar etiqueta/valor solo cada "step" puntos para no saturar
  const step = n <= 12 ? 1 : n <= 30 ? 3 : Math.ceil(n / 12)
  const showAt = (i) => i === 0 || i === n - 1 || i % step === 0

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto" style={{ width: W, maxWidth: 'none' }}>
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

        {/* Puntos + etiquetas (solo cada "step") */}
        {data.map((d, i) => (
          <g key={d.matchId}>
            <circle cx={x(i)} cy={y(d.cumulative)} r={n > 40 ? 1.8 : 2.6} fill="#f97316" />
            {showAt(i) && (
              <>
                <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="7" fill="#cbd5e1">
                  {d.label}
                </text>
                <text x={x(i)} y={y(d.cumulative) - 6} textAnchor="middle" fontSize="8" fill="#fb923c" fontWeight="bold">
                  {d.cumulative}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-ink-500 text-center mt-1">
        Puntos acumulados partido a partido{n > 12 ? ' · desliza para ver todos →' : ''}
      </p>
    </div>
  )
}
