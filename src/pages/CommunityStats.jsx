import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, formatKickoff, isMatchLocked, hasMatchStarted } from '../lib/matches'
import { buildResolver } from '../lib/bracketTeams'
import { useNowTick } from '../lib/useNowTick'
import { teamWithFlag } from '../lib/flags'
import { displayName, displayAvatar } from '../lib/playerDisplay'
import { useAuth } from '../lib/auth'
import {
  groupGoalBias,
  matchDifficulty,
  teamReality,
  outcomeDistribution,
} from '../lib/analytics'
import { CompareBar, BiasGauge, DonutChart } from '../components/DataViz'

const VIEWS = [
  { id: 'analysis', label: '🔬 Análisis' },
  { id: 'matches', label: '⚽ Por partido' },
  { id: 'players', label: '🧑‍🤝‍🧑 Marcadores por persona' },
  { id: 'teams', label: '🏆 Equipos favoritos' },
  { id: 'scores', label: '📊 Marcadores' },
  { id: 'overview', label: '👥 General' },
]

export default function CommunityStats() {
  const data = useLeagueData()
  const [view, setView] = useState('analysis')
  useNowTick(30000) // refresca para reflejar pitazos
  const { resolveMatch } = useMemo(() => buildResolver(data), [data.results, data.config])

  // Agrupar predicciones por partido
  const predsByMatch = useMemo(() => {
    const map = new Map()
    for (const p of data.predictions) {
      if (!map.has(p.match_id)) map.set(p.match_id, [])
      map.get(p.match_id).push(p)
    }
    return map
  }, [data.predictions])

  const profilesById = useMemo(() => {
    const m = {}
    for (const p of data.profiles) m[p.id] = p
    return m
  }, [data.profiles])

  // Estadísticas generales
  const overview = useMemo(() => {
    const totalPlayers = data.profiles.length
    const playersWithPreds = new Set(data.predictions.map(p => p.user_id)).size
    const totalPreds = data.predictions.length
    const avgPredsPerPlayer = playersWithPreds > 0
      ? (totalPreds / playersWithPreds).toFixed(1)
      : 0

    const playersWithGroups = new Set(data.groupPreds.map(p => p.user_id)).size
    const playersWithThirds = new Set(data.thirdPreds.map(p => p.user_id)).size

    return {
      totalPlayers,
      playersWithPreds,
      totalPreds,
      avgPredsPerPlayer,
      playersWithGroups,
      playersWithThirds,
      participationRate: totalPlayers > 0
        ? Math.round((playersWithPreds / totalPlayers) * 100)
        : 0,
    }
  }, [data])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">📊 Estadísticas comunales</h1>
        <p className="text-xs text-ink-300">
          Datos de toda la comunidad. Lo de cada partido se revela <strong>solo cuando ese partido arranca</strong>,
          para que nadie saque ventaja viendo hacia dónde van los demás.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 sticky top-14 bg-ink-900 z-20 py-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
              view === v.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'analysis' && <AnalysisView predictions={data.predictions} results={data.results} />}
      {view === 'overview' && <OverviewView overview={overview} />}
      {view === 'matches' && <MatchesView predsByMatch={predsByMatch} resolveMatch={resolveMatch} />}
      {view === 'players' && <PlayersView predsByMatch={predsByMatch} profilesById={profilesById} />}
      {view === 'teams' && <TeamsView predictions={data.predictions} thirdPreds={data.thirdPreds} groupPreds={data.groupPreds} resolveMatch={resolveMatch} />}
      {view === 'scores' && <ScoresView predictions={data.predictions} />}
    </div>
  )
}

// ===================================================================
// VIEW: General
// ===================================================================
function OverviewView({ overview }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Jugadores totales" value={overview.totalPlayers} icon="👥" />
        <StatCard label="Han pronosticado" value={overview.playersWithPreds} icon="✏️" />
        <StatCard
          label="Tasa de participación"
          value={`${overview.participationRate}%`}
          icon="📈"
        />
        <StatCard label="Pronósticos totales" value={overview.totalPreds} icon="⚽" />
        <StatCard
          label="Promedio por jugador"
          value={overview.avgPredsPerPlayer}
          icon="📊"
        />
        <StatCard
          label="Llenaron grupos"
          value={overview.playersWithGroups}
          icon="🅰️"
        />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2 text-brand-500">¿Qué muestra esta página?</h3>
        <p className="text-xs text-ink-300 leading-relaxed">
          Aquí ves cómo está pronosticando toda la comunidad. Las estadísticas y los marcadores
          de cada partido (cómo viene votando la gente y qué puso cada quien) aparecen
          <strong> únicamente cuando ese partido arranca</strong>. Antes del pitazo quedan ocultos,
          para que quien va ganando no pueda copiar la tendencia y apostar sobre seguro.
        </p>
      </div>
    </div>
  )
}

// ===================================================================
// VIEW: Por partido
// ===================================================================
function MatchesView({ predsByMatch, resolveMatch }) {
  const matches = useMemo(() => {
    return TOURNAMENT.matches
      .filter(m => predsByMatch.has(m.id))
      .map(resolveMatch)
      .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))
  }, [predsByMatch, resolveMatch])

  if (matches.length === 0) {
    return (
      <div className="card text-center py-8 text-ink-300">
        <div className="text-3xl mb-2">📭</div>
        <div>Aún nadie ha pronosticado partidos.</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {matches.map(m => (
        <MatchStatsCard key={m.id} match={m} predictions={predsByMatch.get(m.id) || []} />
      ))}
    </div>
  )
}

function MatchStatsCard({ match, predictions }) {
  const started = hasMatchStarted(match)
  const total = predictions.length

  const distribution = useMemo(() => {
    let local = 0, empate = 0, visitante = 0
    for (const p of predictions) {
      if (p.score1 > p.score2) local++
      else if (p.score1 < p.score2) visitante++
      else empate++
    }
    return { local, empate, visitante }
  }, [predictions])

  const topScores = useMemo(() => {
    if (!started) return []
    const counter = new Map()
    for (const p of predictions) {
      const key = `${p.score1}-${p.score2}`
      counter.set(key, (counter.get(key) || 0) + 1)
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [predictions, started])

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between text-xs text-ink-300 mb-2">
        <span>
          {match.group ? `Grupo ${match.group} · ` : ''}
          {formatKickoff(match.kickoff_utc)}
        </span>
        <span className="pill bg-ink-700 text-ink-100">
          {total} {total === 1 ? 'pronóstico' : 'pronósticos'}
        </span>
      </div>
      <div className="font-medium mb-3 flex items-center gap-2">
        <span className="flex-1 text-right">{teamWithFlag(match.team1)}</span>
        <span className="text-ink-300 text-xs">vs</span>
        <span className="flex-1 text-left">{teamWithFlag(match.team2)}</span>
      </div>

      {started ? (
        <>
          {/* Barra de distribución de resultados */}
          <div className="space-y-1.5">
            <DistroBar label={match.team1 + ' gana'} count={distribution.local} pct={pct(distribution.local)} color="bg-brand-500" />
            <DistroBar label="Empate" count={distribution.empate} pct={pct(distribution.empate)} color="bg-ink-500" />
            <DistroBar label={match.team2 + ' gana'} count={distribution.visitante} pct={pct(distribution.visitante)} color="bg-brand-500" />
          </div>

          {/* Top 3 marcadores */}
          {topScores.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ink-700">
              <div className="text-xs text-ink-300 uppercase tracking-wider mb-2">Marcadores más predichos</div>
              <div className="flex flex-wrap gap-2">
                {topScores.map(([score, count]) => (
                  <div key={score} className="pill bg-brand-700 text-white">
                    <span className="font-mono font-bold">{score}</span>
                    <span className="ml-1 text-ink-100">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-1 text-center py-3 text-sm text-ink-400 bg-ink-900/50 rounded-lg">
          🔒 Las estadísticas se revelan cuando arranque el partido
        </div>
      )}
    </div>
  )
}

function DistroBar({ label, count, pct, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="truncate">{label}</span>
        <span className="text-ink-300 ml-2 whitespace-nowrap">{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-ink-900 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ===================================================================
// VIEW: Marcadores por persona (revela al pitazo)
// ===================================================================
function PlayersView({ predsByMatch, profilesById }) {
  // Solo partidos que ya arrancaron, más reciente primero
  const matches = useMemo(() => {
    return TOURNAMENT.matches
      .filter(m => predsByMatch.has(m.id) && hasMatchStarted(m))
      .sort((a, b) => new Date(b.kickoff_utc) - new Date(a.kickoff_utc))
  }, [predsByMatch])

  const upcomingCount = useMemo(() => {
    return TOURNAMENT.matches.filter(m => predsByMatch.has(m.id) && !hasMatchStarted(m)).length
  }, [predsByMatch])

  if (matches.length === 0) {
    return (
      <div className="card text-center py-8 text-ink-300">
        <div className="text-3xl mb-2">🔒</div>
        <div>Todavía no hay partidos que hayan arrancado.</div>
        <div className="text-xs mt-1">
          Los marcadores de cada persona se revelan cuando el partido empieza.
          {upcomingCount > 0 && ` (${upcomingCount} ${upcomingCount === 1 ? 'partido pronosticado' : 'partidos pronosticados'} esperando el pitazo)`}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="card bg-brand-900/20 border-brand-700/40">
        <p className="text-xs text-ink-200">
          🧑‍🤝‍🧑 Aquí ves qué marcador puso cada persona en los partidos que ya arrancaron, más un resumen
          de cuántos van por cada resultado.
        </p>
      </div>
      {matches.map(m => (
        <PlayerScoresCard
          key={m.id}
          match={m}
          predictions={predsByMatch.get(m.id) || []}
          profilesById={profilesById}
        />
      ))}
    </div>
  )
}

function PlayerScoresCard({ match, predictions, profilesById }) {
  const { user } = useAuth()
  // Resumen agregado
  const agg = useMemo(() => {
    let local = 0, empate = 0, visitante = 0
    const scoreCounter = new Map()
    for (const p of predictions) {
      if (p.score1 > p.score2) local++
      else if (p.score1 < p.score2) visitante++
      else empate++
      const key = `${p.score1}-${p.score2}`
      scoreCounter.set(key, (scoreCounter.get(key) || 0) + 1)
    }
    const topScores = [...scoreCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { local, empate, visitante, topScores }
  }, [predictions])

  // Lista de marcadores por persona, ordenada por nombre
  const rows = useMemo(() => {
    return predictions
      .map(p => ({
        userId: p.user_id,
        prof: profilesById[p.user_id],
        score1: p.score1,
        score2: p.score2,
      }))
      .sort((a, b) => {
        const na = a.prof ? displayName(a.prof) : 'zzz'
        const nb = b.prof ? displayName(b.prof) : 'zzz'
        return na.localeCompare(nb)
      })
  }, [predictions, profilesById])

  const total = predictions.length
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  return (
    <div className="card">
      <div className="flex items-center justify-between text-xs text-ink-300 mb-2">
        <span>
          {match.group ? `Grupo ${match.group} · ` : ''}
          {formatKickoff(match.kickoff_utc)}
        </span>
        <span className="pill bg-ink-700 text-ink-100">{total} {total === 1 ? 'marcador' : 'marcadores'}</span>
      </div>
      <div className="font-medium mb-3 flex items-center gap-2">
        <span className="flex-1 text-right">{teamWithFlag(match.team1)}</span>
        <span className="text-ink-300 text-xs">vs</span>
        <span className="flex-1 text-left">{teamWithFlag(match.team2)}</span>
      </div>

      {/* Resumen agregado */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
        <div className="bg-ink-900/50 rounded-lg py-1.5">
          <div className="font-bold text-brand-400">{agg.local}</div>
          <div className="text-ink-400 truncate px-1">gana {match.team1}</div>
          <div className="text-[10px] text-ink-500">{pct(agg.local)}%</div>
        </div>
        <div className="bg-ink-900/50 rounded-lg py-1.5">
          <div className="font-bold text-ink-200">{agg.empate}</div>
          <div className="text-ink-400">empate</div>
          <div className="text-[10px] text-ink-500">{pct(agg.empate)}%</div>
        </div>
        <div className="bg-ink-900/50 rounded-lg py-1.5">
          <div className="font-bold text-brand-400">{agg.visitante}</div>
          <div className="text-ink-400 truncate px-1">gana {match.team2}</div>
          <div className="text-[10px] text-ink-500">{pct(agg.visitante)}%</div>
        </div>
      </div>

      {/* Marcadores más comunes */}
      {agg.topScores.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-ink-400 uppercase tracking-wider mb-1">Marcadores más repetidos</div>
          <div className="flex flex-wrap gap-1.5">
            {agg.topScores.map(([score, count]) => (
              <span key={score} className="pill bg-brand-700 text-white text-xs">
                <span className="font-mono font-bold">{score}</span>
                <span className="ml-1">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabla por persona */}
      <div className="border-t border-ink-700 pt-2">
        <div className="text-[10px] text-ink-400 uppercase tracking-wider mb-1.5">Qué puso cada quien</div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {rows.map((r, idx) => {
            const isMe = r.userId === user.id
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 text-sm py-0.5 px-1.5 rounded ${
                  isMe ? 'bg-brand-900/40 outline outline-1 outline-brand-500/50' : ''
                }`}
              >
                <span className="flex-1 truncate">
                  {r.prof ? `${displayAvatar(r.prof)} ${displayName(r.prof)}` : 'Jugador'}
                  {isMe && <span className="ml-1 text-[10px] text-brand-400 font-bold">(tú)</span>}
                </span>
                <span className="font-mono font-bold text-brand-400 whitespace-nowrap">
                  {r.score1} - {r.score2}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===================================================================
// VIEW: Equipos favoritos
// ===================================================================
function TeamsView({ predictions, thirdPreds, groupPreds, resolveMatch }) {
  const winnerCounts = useMemo(() => {
    const counter = new Map()
    for (const p of predictions) {
      const m = resolveMatch(matchById(p.match_id))
      if (!m) continue
      if (p.score1 > p.score2) bump(counter, m.team1)
      else if (p.score1 < p.score2) bump(counter, m.team2)
    }
    return [...counter.entries()]
      .filter(([team]) => !team.startsWith('W') && !team.startsWith('L') && !team.match(/^\d/))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [predictions])

  const topThirds = useMemo(() => {
    const counter = new Map()
    for (const tp of thirdPreds) bump(counter, tp.team)
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [thirdPreds])

  const topGroupWinners = useMemo(() => {
    const counter = new Map()
    for (const gp of groupPreds) {
      if (gp.position === 1) bump(counter, gp.team)
    }
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [groupPreds])

  return (
    <div className="space-y-3">
      <RankList
        title="🏆 Equipos con más victorias predichas"
        subtitle="Equipos a los que más jugadores apuestan que ganen sus partidos"
        items={winnerCounts}
        empty="Aún no hay suficientes pronósticos."
      />

      <RankList
        title="🥇 Más predichos como primero de grupo"
        subtitle="Quién creen los jugadores que ganará cada grupo"
        items={topGroupWinners}
        empty="Aún no hay predicciones de grupos."
      />

      <RankList
        title="🥉 Mejores terceros más predichos"
        subtitle="Los 8 equipos que más jugadores apuestan que clasificarán como mejor tercero"
        items={topThirds}
        empty="Aún no hay predicciones de terceros."
      />
    </div>
  )
}

function RankList({ title, subtitle, items, empty }) {
  const max = items[0]?.[1] || 0
  return (
    <div className="card">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-xs text-ink-300 mb-3">{subtitle}</p>
      {items.length === 0 ? (
        <div className="text-sm text-ink-500 italic">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map(([team, count], idx) => (
            <div key={team} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-ink-500 font-mono text-xs">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </span>
              <span className="flex-1 truncate">{teamWithFlag(team)}</span>
              <div className="w-32 h-2 bg-ink-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-ink-300 text-xs">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================================================================
// VIEW: Marcadores (agregado, revela al pitazo)
// ===================================================================
function ScoresView({ predictions }) {
  // Solo predicciones de partidos que YA ARRANCARON
  const startedPreds = useMemo(() => {
    return predictions.filter(p => {
      const m = matchById(p.match_id)
      return m && hasMatchStarted(m)
    })
  }, [predictions])

  const stats = useMemo(() => {
    if (startedPreds.length === 0) return null
    let goals = 0
    let zeros = 0
    let goleadas = 0
    const scoreCounter = new Map()

    for (const p of startedPreds) {
      goals += p.score1 + p.score2
      if (p.score1 === 0 && p.score2 === 0) zeros++
      if (Math.abs(p.score1 - p.score2) >= 3) goleadas++
      const key = `${p.score1}-${p.score2}`
      scoreCounter.set(key, (scoreCounter.get(key) || 0) + 1)
    }

    const topScores = [...scoreCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    return {
      total: startedPreds.length,
      avgGoals: (goals / startedPreds.length).toFixed(1),
      zerosPct: Math.round((zeros / startedPreds.length) * 100),
      goleadasPct: Math.round((goleadas / startedPreds.length) * 100),
      topScores,
    }
  }, [startedPreds])

  if (!stats) {
    return (
      <div className="card text-center py-8 text-ink-300">
        <div className="text-3xl mb-2">🔒</div>
        <div>Aún no hay partidos que hayan arrancado.</div>
        <div className="text-xs mt-1">
          Los marcadores se muestran solo después de que cada partido empieza.
        </div>
      </div>
    )
  }

  const maxCount = stats.topScores[0]?.[1] || 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Marcadores analizados" value={stats.total} icon="📊" />
        <StatCard label="Goles promedio" value={stats.avgGoals} icon="⚽" />
        <StatCard label="Predicciones 0-0" value={`${stats.zerosPct}%`} icon="🥱" />
        <StatCard label="Goleadas (≥3 dif)" value={`${stats.goleadasPct}%`} icon="🔥" />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">📈 Marcadores más predichos</h3>
        <p className="text-xs text-ink-300 mb-3">
          Top 10 marcadores que más se repiten en toda la comunidad (solo partidos que ya arrancaron)
        </p>
        <div className="space-y-2">
          {stats.topScores.map(([score, count], idx) => (
            <div key={score} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-ink-500 font-mono text-xs">{idx + 1}</span>
              <span className="font-mono font-bold w-12">{score}</span>
              <div className="flex-1 h-2 bg-ink-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-ink-300 text-xs">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===================================================================
// helpers
// ===================================================================
function AnalysisView({ predictions, results }) {
  const resultsById = useMemo(() => new Map(results.map(r => [r.match_id, r])), [results])

  const analysis = useMemo(() => {
    if (resultsById.size === 0) return null
    return {
      goalBias: groupGoalBias(predictions, resultsById),
      difficulty: matchDifficulty(predictions, resultsById),
      teams: teamReality(predictions, resultsById),
      outcomes: outcomeDistribution(predictions, resultsById),
    }
  }, [predictions, resultsById])

  if (!analysis) {
    return (
      <div className="card text-center py-8 text-ink-300">
        <div className="text-3xl mb-2">🔬</div>
        <div>Aún no hay partidos jugados para analizar.</div>
        <div className="text-xs mt-1">Los análisis aparecen cuando se carguen resultados.</div>
      </div>
    )
  }

  const { goalBias, difficulty, teams, outcomes } = analysis
  const goalDiff = goalBias.predAvg - goalBias.realAvg

  return (
    <div className="space-y-3">
      {/* Sesgo de goles del grupo */}
      <div className="card">
        <h3 className="font-semibold mb-1">⚽ ¿El grupo es optimista con los goles?</h3>
        <p className="text-xs text-ink-300 mb-3">
          Promedio de goles que predice la comunidad vs los que pasan de verdad.
        </p>
        <BiasGauge predAvg={goalBias.predAvg} realAvg={goalBias.realAvg} max={6} />
        <p className="text-sm mt-3 text-ink-100">
          {Math.abs(goalDiff) < 0.15
            ? '🎯 El grupo le atina al ritmo de goles del torneo, casi sin sesgo.'
            : goalDiff > 0
              ? `📈 El grupo es optimista: predice ${goalDiff.toFixed(2)} goles de más por partido. La realidad es más tacaña.`
              : `📉 El grupo es pesimista: predice ${Math.abs(goalDiff).toFixed(2)} goles de menos por partido. Hay más goles de los que esperaban.`}
        </p>
      </div>

      {/* Distribución de resultados */}
      <div className="card">
        <h3 className="font-semibold mb-1">🥅 Local, empate o visitante</h3>
        <p className="text-xs text-ink-300 mb-3">
          Cómo reparte el grupo sus apuestas vs cómo terminan los partidos.
        </p>
        <CompareBar label="Gana el local" predPct={outcomes.pred.L} realPct={outcomes.real.L} />
        <CompareBar label="Empate" predPct={outcomes.pred.E} realPct={outcomes.real.E} />
        <CompareBar label="Gana el visitante" predPct={outcomes.pred.V} realPct={outcomes.real.V} />
        <p className="text-xs text-ink-400 mt-2">
          {outcomes.pred.E > outcomes.real.E + 0.08
            ? '🤝 El grupo predice más empates de los que ocurren — cuidado con jugar al empate.'
            : outcomes.real.E > outcomes.pred.E + 0.08
              ? '😮 Hubo más empates de los que el grupo esperaba.'
              : '⚖️ El grupo lee bastante bien el tipo de resultado.'}
        </p>
      </div>

      {/* Partido más fácil y más trampa */}
      <div className="card">
        <h3 className="font-semibold mb-1">🎯 Los partidos fáciles y las trampas</h3>
        <p className="text-xs text-ink-300 mb-3">
          Dónde acertó casi todo el mundo y dónde casi nadie vio venir el resultado.
        </p>
        <div className="space-y-2">
          <div className="text-[10px] text-green-400 uppercase tracking-wider">Los que todos clavaron</div>
          {difficulty.easiest.map(m => (
            <DifficultyRow key={m.matchId} m={m} good />
          ))}
          <div className="text-[10px] text-red-400 uppercase tracking-wider mt-3">Las trampas (casi nadie acertó)</div>
          {difficulty.trickiest.map(m => (
            <DifficultyRow key={m.matchId} m={m} />
          ))}
        </div>
      </div>

      {/* Equipos sobre/infravalorados */}
      {(teams.overrated.length > 0 || teams.underrated.length > 0) && (
        <div className="card">
          <h3 className="font-semibold mb-1">📊 Equipos que engañaron al grupo</h3>
          <p className="text-xs text-ink-300 mb-3">
            Comparación entre las victorias que el grupo les apostó y las que realmente lograron.
          </p>
          {teams.overrated.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Sobrevalorados (les creyeron de más)</div>
              <div className="flex flex-wrap gap-1.5">
                {teams.overrated.map(t => (
                  <span key={t.team} className="pill bg-red-900/40 text-red-200 text-xs">
                    {teamWithFlag(t.team)} <span className="opacity-70">({t.predictedWins}→{t.actualWins})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {teams.underrated.length > 0 && (
            <div>
              <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1">Infravalorados (sorprendieron)</div>
              <div className="flex flex-wrap gap-1.5">
                {teams.underrated.map(t => (
                  <span key={t.team} className="pill bg-green-900/40 text-green-200 text-xs">
                    {teamWithFlag(t.team)} <span className="opacity-70">({t.predictedWins}→{t.actualWins})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-ink-500 mt-2">
            (victorias predichas por el grupo → victorias reales)
          </p>
        </div>
      )}
    </div>
  )
}

function DifficultyRow({ m, good }) {
  const pct = Math.round(m.hitRate * 100)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1 truncate text-xs">{m.label}</span>
      <div className="w-20 h-1.5 bg-ink-900 rounded-full overflow-hidden">
        <div className={`h-full ${good ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-ink-300 w-14 text-right">{m.hits}/{m.total} ({pct}%)</span>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="card text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-brand-500">{value}</div>
      <div className="text-xs text-ink-300 mt-0.5">{label}</div>
    </div>
  )
}

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}
