import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, formatKickoff, isMatchLocked } from '../lib/matches'
import { useNowTick } from '../lib/useNowTick'

const VIEWS = [
  { id: 'matches', label: '⚽ Por partido' },
  { id: 'teams', label: '🏆 Equipos favoritos' },
  { id: 'scores', label: '📊 Marcadores' },
  { id: 'overview', label: '👥 General' },
]

export default function CommunityStats() {
  const data = useLeagueData()
  const [view, setView] = useState('matches')
  useNowTick(60000) // refresca cada minuto para reflejar bloqueos

  // Agrupar predicciones por partido
  const predsByMatch = useMemo(() => {
    const map = new Map()
    for (const p of data.predictions) {
      if (!map.has(p.match_id)) map.set(p.match_id, [])
      map.get(p.match_id).push(p)
    }
    return map
  }, [data.predictions])

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
          Datos agregados anónimos de toda la comunidad AHK Copa Interna.
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

      {view === 'overview' && <OverviewView overview={overview} />}
      {view === 'matches' && <MatchesView predsByMatch={predsByMatch} />}
      {view === 'teams' && <TeamsView predictions={data.predictions} thirdPreds={data.thirdPreds} groupPreds={data.groupPreds} />}
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
          Aquí ves cómo está pronosticando toda la comunidad de AHK, sin revelar predicciones individuales.
          Solo aparecen marcadores cuando el partido ya está bloqueado (10 min antes del pitazo), para que nadie pueda
          copiar las predicciones de otros antes del cierre.
        </p>
      </div>
    </div>
  )
}

// ===================================================================
// VIEW: Por partido
// ===================================================================
function MatchesView({ predsByMatch }) {
  // Mostrar solo partidos con al menos 1 predicción
  const matches = useMemo(() => {
    return TOURNAMENT.matches
      .filter(m => predsByMatch.has(m.id))
      .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))
  }, [predsByMatch])

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
  const locked = isMatchLocked(match)
  const total = predictions.length

  // Distribución de resultados (Local / Empate / Visitante)
  const distribution = useMemo(() => {
    let local = 0, empate = 0, visitante = 0
    for (const p of predictions) {
      if (p.score1 > p.score2) local++
      else if (p.score1 < p.score2) visitante++
      else empate++
    }
    return { local, empate, visitante }
  }, [predictions])

  // Top 3 marcadores predichos (solo si locked)
  const topScores = useMemo(() => {
    if (!locked) return []
    const counter = new Map()
    for (const p of predictions) {
      const key = `${p.score1}-${p.score2}`
      counter.set(key, (counter.get(key) || 0) + 1)
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [predictions, locked])

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
        <span className="flex-1 text-right">{match.team1}</span>
        <span className="text-ink-300 text-xs">vs</span>
        <span className="flex-1 text-left">{match.team2}</span>
      </div>

      {/* Barra de distribución de resultados */}
      <div className="space-y-1.5">
        <DistroBar label={match.team1 + ' gana'} count={distribution.local} pct={pct(distribution.local)} color="bg-brand-500" />
        <DistroBar label="Empate" count={distribution.empate} pct={pct(distribution.empate)} color="bg-ink-500" />
        <DistroBar label={match.team2 + ' gana'} count={distribution.visitante} pct={pct(distribution.visitante)} color="bg-brand-500" />
      </div>

      {/* Top 3 marcadores - solo si locked */}
      {locked && topScores.length > 0 && (
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

      {!locked && (
        <div className="mt-2 text-[10px] text-ink-500 italic">
          🔒 Los marcadores específicos se revelan cuando el partido se bloquea
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
// VIEW: Equipos favoritos
// ===================================================================
function TeamsView({ predictions, thirdPreds, groupPreds }) {
  // Contar: cuántas veces cada equipo fue predicho como ganador
  const winnerCounts = useMemo(() => {
    const counter = new Map()
    for (const p of predictions) {
      const m = matchById(p.match_id)
      if (!m) continue
      if (p.score1 > p.score2) bump(counter, m.team1)
      else if (p.score1 < p.score2) bump(counter, m.team2)
    }
    return [...counter.entries()]
      .filter(([team]) => !team.startsWith('W') && !team.startsWith('L') && !team.match(/^\d/))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [predictions])

  // Top mejores terceros más predichos
  const topThirds = useMemo(() => {
    const counter = new Map()
    for (const tp of thirdPreds) bump(counter, tp.team)
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [thirdPreds])

  // Top primeros de grupo (position 1)
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
              <span className="flex-1 truncate">{team}</span>
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
// VIEW: Marcadores
// ===================================================================
function ScoresView({ predictions }) {
  // Solo considerar predicciones de partidos ya bloqueados
  const blockedPreds = useMemo(() => {
    return predictions.filter(p => {
      const m = matchById(p.match_id)
      return m && isMatchLocked(m)
    })
  }, [predictions])

  const stats = useMemo(() => {
    if (blockedPreds.length === 0) return null
    let goals = 0
    let highest = { p: null, sum: 0 }
    let zeros = 0
    let goleadas = 0
    const scoreCounter = new Map()

    for (const p of blockedPreds) {
      goals += p.score1 + p.score2
      const sum = p.score1 + p.score2
      if (sum > highest.sum) highest = { p, sum }
      if (p.score1 === 0 && p.score2 === 0) zeros++
      if (Math.abs(p.score1 - p.score2) >= 3) goleadas++
      const key = `${p.score1}-${p.score2}`
      scoreCounter.set(key, (scoreCounter.get(key) || 0) + 1)
    }

    const topScores = [...scoreCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    return {
      total: blockedPreds.length,
      avgGoals: (goals / blockedPreds.length).toFixed(1),
      zerosPct: Math.round((zeros / blockedPreds.length) * 100),
      goleadasPct: Math.round((goleadas / blockedPreds.length) * 100),
      topScores,
    }
  }, [blockedPreds])

  if (!stats) {
    return (
      <div className="card text-center py-8 text-ink-300">
        <div className="text-3xl mb-2">🔒</div>
        <div>Aún no hay partidos bloqueados.</div>
        <div className="text-xs mt-1">
          Los marcadores específicos se muestran solo después de que los partidos cierran sus pronósticos.
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
          Top 10 marcadores que más se repiten en toda la comunidad (solo partidos ya cerrados)
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
