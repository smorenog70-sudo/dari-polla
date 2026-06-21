import { useState } from 'react'
import { teamWithFlag } from '../lib/flags'

// Mini gráfico de línea para la posición en el tiempo (eje Y invertido: arriba = mejor puesto)
function PositionChart({ series }) {
  if (!series || series.length < 2) {
    return <p className="text-xs text-ink-500">Necesitas al menos 2 partidos jugados para ver tu evolución de puesto.</p>
  }
  const W = 320, H = 120, pad = 24
  const ranks = series.map(s => s.rank)
  const maxRank = Math.max(...ranks)
  const minRank = Math.min(...ranks)
  const span = Math.max(1, maxRank - minRank)
  const x = (i) => pad + (i / (series.length - 1)) * (W - pad * 2)
  // Y invertido: rank 1 (mejor) arriba
  const y = (rank) => pad + ((rank - minRank) / span) * (H - pad * 2)

  const points = series.map((s, i) => `${x(i)},${y(s.rank)}`).join(' ')
  const last = series[series.length - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* línea de mi puesto */}
        <polyline points={points} fill="none" stroke="var(--brand-500, #f97316)" strokeWidth="2" />
        {series.map((s, i) => (
          <circle key={i} cx={x(i)} cy={y(s.rank)} r="2.5" fill="var(--brand-400, #fb923c)" />
        ))}
        {/* etiqueta del puesto inicial y final */}
        <text x={x(0)} y={y(series[0].rank) - 6} fontSize="9" fill="#94a3b8" textAnchor="middle">{series[0].rank}º</text>
        <text x={x(series.length - 1)} y={y(last.rank) - 6} fontSize="10" fill="#fb923c" textAnchor="middle" fontWeight="bold">{last.rank}º</text>
      </svg>
      <p className="text-[10px] text-ink-500 text-center">Tu puesto partido a partido (arriba = mejor)</p>
    </div>
  )
}

function Stat({ label, value, sub, color = 'text-brand-400' }) {
  return (
    <div className="bg-ink-900/40 rounded-lg p-2 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-ink-400 leading-tight">{label}</div>
      {sub && <div className="text-[9px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AdvancedStats({ s }) {
  const [tab, setTab] = useState('rendimiento')
  if (!s) return null

  const TABS = [
    { id: 'rendimiento', label: '📊 Rendimiento' },
    { id: 'patrones', label: '🎯 Patrones' },
    { id: 'comparativa', label: '🏆 Comparativa' },
  ]

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">🔬 Estadísticas avanzadas</h2>

      {/* Pestañas internas */}
      <div className="flex gap-1 mb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === RENDIMIENTO === */}
      {tab === 'rendimiento' && (
        <div className="space-y-3">
          {/* #1 Posición en el tiempo */}
          <div>
            <div className="text-xs font-medium text-ink-200 mb-1">📈 Tu posición en el tiempo</div>
            <PositionChart series={s.positionSeries} />
          </div>

          {/* #3 Tasa de acierto */}
          {s.hitRates && s.hitRates.played > 0 && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🎯 Tasa de acierto</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Aciertas el ganador" value={`${s.hitRates.outcomePct}%`}
                  sub={`${s.hitRates.outcomes} de ${s.hitRates.played}`} />
                <Stat label="Marcador exacto" value={`${s.hitRates.exactPct}%`}
                  sub={`${s.hitRates.exacts} de ${s.hitRates.played}`} color="text-green-400" />
              </div>
            </div>
          )}

          {/* #2 Mejor y peor día */}
          {s.bestWorstDay && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">📅 Tu mejor y peor día</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={`Mejor día (${s.bestWorstDay.best.label})`}
                  value={`${s.bestWorstDay.best.points} pts`}
                  sub={`${s.bestWorstDay.best.played} partidos`} color="text-green-400" />
                <Stat label={`Peor día (${s.bestWorstDay.worst.label})`}
                  value={`${s.bestWorstDay.worst.points} pts`}
                  sub={`${s.bestWorstDay.worst.played} partidos`} color="text-red-400" />
              </div>
              {s.bestWorstDay.sameDay && (
                <p className="text-[9px] text-ink-500 mt-1">Solo has jugado un día hasta ahora.</p>
              )}
            </div>
          )}

          {/* #11 Puntos posibles vs ganados */}
          {s.pointsEfficiency && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">💰 Puntos: ganados vs posibles</div>
              <div className="bg-ink-900/40 rounded-lg p-3">
                <div className="flex items-end justify-between mb-1">
                  <span className="text-lg font-bold text-brand-400">{s.pointsEfficiency.earned}</span>
                  <span className="text-xs text-ink-500">de {s.pointsEfficiency.possible} posibles</span>
                </div>
                <div className="bg-ink-800 rounded-full h-3 overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full" style={{ width: `${s.pointsEfficiency.pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                  <span>{s.pointsEfficiency.pct}% del máximo</span>
                  <span>{s.pointsEfficiency.leftOnTable} pts dejados en la mesa</span>
                </div>
                {s.pointsEfficiency.perfectMatches > 0 && (
                  <div className="text-[10px] text-green-400 mt-1">
                    💎 {s.pointsEfficiency.perfectMatches} {s.pointsEfficiency.perfectMatches === 1 ? 'partido perfecto' : 'partidos perfectos'} (15/15)
                  </div>
                )}
              </div>
              <p className="text-[9px] text-ink-500 mt-1">
                El máximo por partido es 15 pts (acertar marcador exacto + todo). Esto mide cuánto aprovechaste.
              </p>
            </div>
          )}

          {/* #10 Proyección */}
          {s.projection && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🔮 Ritmo y proyección</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Puntos por partido" value={s.projection.perMatch} />
                <Stat label="Proyección final"
                  value={`~${s.projection.projected}`}
                  sub={`si sigues tu ritmo`} color="text-purple-400" />
              </div>
              <p className="text-[9px] text-ink-500 mt-1">
                Estimado a {s.projection.totalMatches} partidos del torneo. Es solo una proyección a tu ritmo actual.
              </p>
            </div>
          )}
        </div>
      )}

      {/* === PATRONES === */}
      {tab === 'patrones' && (
        <div className="space-y-3">
          {/* #4 Marcador favorito */}
          {s.favoriteScore && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🎲 Tu marcador favorito</div>
              <div className="bg-ink-900/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold font-mono text-brand-400">{s.favoriteScore.score}</div>
                <div className="text-[10px] text-ink-400">Lo has predicho {s.favoriteScore.count} {s.favoriteScore.count === 1 ? 'vez' : 'veces'}</div>
              </div>
            </div>
          )}

          {/* #6 Sesgo de empates */}
          {s.drawBias && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🤝 Sesgo de empates</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Empates que predices" value={`${s.drawBias.predPct}%`}
                  sub={`${s.drawBias.predDraws} de ${s.drawBias.played}`} />
                <Stat label="Empates reales" value={`${s.drawBias.realPct}%`}
                  sub={`${s.drawBias.realDraws} de ${s.drawBias.played}`} color="text-ink-200" />
              </div>
              <p className="text-[9px] text-ink-500 mt-1">
                {s.drawBias.predPct > s.drawBias.realPct + 8 ? 'Predices más empates de los que pasan.'
                  : s.drawBias.predPct < s.drawBias.realPct - 8 ? 'Predices pocos empates para los que pasan.'
                  : 'Tu intuición de empates está bien calibrada.'}
              </p>
            </div>
          )}

          {/* #5 Favoritos vs underdogs */}
          {s.favVsUnder && (s.favVsUnder.withFav > 0 || s.favVsUnder.against > 0) && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">⚖️ Con el favorito vs arriesgando</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Yendo con el favorito"
                  value={s.favVsUnder.withFavPct != null ? `${s.favVsUnder.withFavPct}%` : '—'}
                  sub={`${s.favVsUnder.withFavHit}/${s.favVsUnder.withFav} aciertos`} />
                <Stat label="Arriesgando (underdog)"
                  value={s.favVsUnder.againstPct != null ? `${s.favVsUnder.againstPct}%` : '—'}
                  sub={`${s.favVsUnder.againstHit}/${s.favVsUnder.against} aciertos`} color="text-orange-400" />
              </div>
              <p className="text-[9px] text-ink-500 mt-1">
                "Favorito" = lo que predijo la mayoría del grupo en ese partido.
              </p>
            </div>
          )}
        </div>
      )}

      {/* === COMPARATIVA === */}
      {tab === 'comparativa' && (
        <div className="space-y-3">
          {/* #8 Cuánto te falta para subir */}
          {s.gapToClimb && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🪜 Tu lucha en la tabla</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Para subir de puesto"
                  value={s.gapToClimb.toClimb != null ? `${s.gapToClimb.toClimb} pts` : '👑'}
                  sub={s.gapToClimb.toClimb != null ? 'al de arriba' : '¡Eres el líder!'}
                  color="text-green-400" />
                <Stat label="Te persiguen"
                  value={s.gapToClimb.chasedBy != null ? `${s.gapToClimb.chasedBy} pts` : '—'}
                  sub={s.gapToClimb.chasedBy != null ? 'de ventaja' : 'eres el último'}
                  color="text-red-400" />
              </div>
            </div>
          )}

          {/* #9 Percentil */}
          {s.percentile != null && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">📊 Tu lugar en el grupo</div>
              <div className="bg-ink-900/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-brand-400">Mejor que el {s.percentile}%</div>
                <div className="text-[10px] text-ink-400">de la polla</div>
              </div>
            </div>
          )}

          {/* #7 Némesis y talismán */}
          {s.nemesisCharm && (s.nemesisCharm.charm || s.nemesisCharm.nemesis) && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🍀 Talismán y némesis</div>
              <div className="grid grid-cols-2 gap-2">
                {s.nemesisCharm.charm ? (
                  <div className="bg-green-900/15 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-ink-400 uppercase tracking-wider">🍀 Talismán</div>
                    <div className="text-sm font-bold mt-0.5">{teamWithFlag(s.nemesisCharm.charm.team)}</div>
                    <div className="text-[9px] text-green-400">{s.nemesisCharm.charm.points} pts contigo</div>
                  </div>
                ) : <div />}
                {s.nemesisCharm.nemesis ? (
                  <div className="bg-red-900/15 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-ink-400 uppercase tracking-wider">😤 Némesis</div>
                    <div className="text-sm font-bold mt-0.5">{teamWithFlag(s.nemesisCharm.nemesis.team)}</div>
                    <div className="text-[9px] text-red-400">{s.nemesisCharm.nemesis.misses} fallos</div>
                  </div>
                ) : <div />}
              </div>
            </div>
          )}

          {/* #12 Cómo apuestan los top 3 (agregado, sin nombres) */}
          {s.winnersStyle && (
            <div>
              <div className="text-xs font-medium text-ink-200 mb-1">🏆 Cómo apuestan los líderes</div>
              <p className="text-[10px] text-ink-400 mb-2">Estilo de los 3 primeros vs el resto del grupo (sin nombres).</p>
              <div className="space-y-2">
                <StyleRow label="🎯 Marcadores exactos"
                  top={s.winnersStyle.top.exactPct} rest={s.winnersStyle.rest.exactPct} unit="%" />
                <StyleRow label="🤝 Empates que predicen"
                  top={s.winnersStyle.top.drawPct} rest={s.winnersStyle.rest.drawPct} unit="%" />
                <StyleRow label="⚽ Goles por marcador"
                  top={s.winnersStyle.top.avgGoals} rest={s.winnersStyle.rest.avgGoals} unit="" />
                <StyleRow label="💥 Marcadores con 4+ goles"
                  top={s.winnersStyle.top.bigScorePct} rest={s.winnersStyle.rest.bigScorePct} unit="%" />
              </div>
              <p className="text-[9px] text-ink-500 mt-2">
                💡 {interpretWinners(s.winnersStyle)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StyleRow({ label, top, rest, unit }) {
  const topWins = top > rest
  return (
    <div className="bg-ink-900/40 rounded-lg p-2">
      <div className="text-[11px] text-ink-200 mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className={`rounded p-1 ${topWins ? 'bg-brand-900/30' : 'bg-ink-800'}`}>
          <div className="text-sm font-bold text-brand-400">{top}{unit}</div>
          <div className="text-[9px] text-ink-400">Top 3</div>
        </div>
        <div className="rounded p-1 bg-ink-800">
          <div className="text-sm font-bold text-ink-200">{rest}{unit}</div>
          <div className="text-[9px] text-ink-400">El resto</div>
        </div>
      </div>
    </div>
  )
}

function interpretWinners(ws) {
  const { top, rest } = ws
  const notes = []
  if (top.exactPct > rest.exactPct + 3) notes.push('los líderes aciertan más marcadores exactos')
  if (top.drawPct < rest.drawPct - 3) notes.push('predicen menos empates')
  else if (top.drawPct > rest.drawPct + 3) notes.push('predicen más empates')
  if (top.bigScorePct > rest.bigScorePct + 3) notes.push('arriesgan más con goleadas')
  else if (top.bigScorePct < rest.bigScorePct - 3) notes.push('son más conservadores con los goles')
  if (notes.length === 0) return 'Los líderes apuestan parecido al resto: ganan por precisión, no por estilo.'
  return 'En promedio, ' + notes.join(', ') + '.'
}
