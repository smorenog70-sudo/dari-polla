import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { groupedMatches, isMatchLocked, formatKickoff, TOURNAMENT } from '../lib/matches'
import { resolveTeamWithFlag, bracketVisualOrder } from '../lib/bracketTeams'

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
]

export default function Bracket() {
  const { user } = useAuth()
  const data = useLeagueData()

  const myPredsById = useMemo(() => {
    const m = new Map()
    for (const p of data.predictions) {
      if (p.user_id === user.id) m.set(p.match_id, p)
    }
    return m
  }, [data.predictions, user.id])

  const resultsById = useMemo(
    () => new Map(data.results.map(r => [r.match_id, r])),
    [data.results]
  )

  const grouped = useMemo(() => groupedMatches(), [])

  const bracketTeams = data.config?.bracket_teams || {}

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏆 Camino a la final</h1>
        <p className="text-xs text-ink-300">
          El cuadro de eliminatorias con tus pronósticos. Desliza horizontalmente para ver todas las rondas.
        </p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 min-w-max pb-2">
          {ROUNDS.map(round => {
            const matches = round.key === 'final'
              ? (grouped[round.key] || [])
              : bracketVisualOrder(TOURNAMENT.matches, round.key)
            if (matches.length === 0) return null
            return (
              <div key={round.key} className="flex flex-col gap-2" style={{ minWidth: 180 }}>
                <div className="text-center text-xs font-semibold uppercase tracking-wider text-brand-400 sticky top-0">
                  {round.label}
                </div>
                <div className="flex flex-col gap-2 justify-around h-full">
                  {matches.map(m => (
                    <BracketMatch
                      key={m.id}
                      match={m}
                      bracketTeams={bracketTeams}
                      pred={myPredsById.get(m.id)}
                      result={resultsById.get(m.id)}
                      locked={isMatchLocked(m)}
                      isFinal={round.key === 'final'}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tercer puesto aparte */}
      {(grouped.third || []).length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-2">
            🥉 Tercer puesto
          </div>
          {grouped.third.map(m => (
            <BracketMatch
              key={m.id}
              match={m}
              bracketTeams={bracketTeams}
              pred={myPredsById.get(m.id)}
              result={resultsById.get(m.id)}
              locked={isMatchLocked(m)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-500 text-center px-4">
        Los equipos reales aparecen cuando avanza el torneo. Tu pronóstico se muestra en cada llave;
        el resultado oficial aparece marcado en verde cuando se juega.
      </p>
    </div>
  )
}

function BracketMatch({ match, bracketTeams, pred, result, locked, isFinal }) {
  const teamLine = (team, predScore, realScore, isWinner) => (
    <div className={`flex items-center justify-between gap-1 px-2 py-1 rounded ${
      isWinner ? 'bg-green-900/30' : ''
    }`}>
      <span className="text-xs truncate flex-1">{team}</span>
      <span className="flex items-center gap-1">
        {predScore != null && (
          <span className="text-[11px] font-mono text-brand-400">{predScore}</span>
        )}
        {realScore != null && (
          <span className="text-[11px] font-mono text-green-400 font-bold">{realScore}</span>
        )}
      </span>
    </div>
  )

  const realWinner1 = result && result.score1 > result.score2
  const realWinner2 = result && result.score2 > result.score1

  // Resolver placeholders (2A, W73...) a equipos reales si el admin ya los asignó
  const team1 = resolveTeamWithFlag(match.team1_raw || match.team1, bracketTeams)
  const team2 = resolveTeamWithFlag(match.team2_raw || match.team2, bracketTeams)

  return (
    <div className={`rounded-lg border p-1.5 ${
      isFinal ? 'border-brand-500 bg-brand-900/20' : 'border-ink-700 bg-ink-800/50'
    }`}>
      {teamLine(team1, pred?.score1, result?.score1, realWinner1)}
      <div className="border-t border-ink-700 my-0.5" />
      {teamLine(team2, pred?.score2, result?.score2, realWinner2)}
      <div className="text-[9px] text-ink-500 text-center mt-1 flex items-center justify-center gap-1">
        {locked && <span className="text-red-400">🔒</span>}
        {result ? (
          <span className="text-green-400">Final</span>
        ) : (
          <span>{shortDate(match.kickoff_utc)}</span>
        )}
      </div>
      {/* Leyenda de colores en la final para que se entienda */}
      {isFinal && (pred || result) && (
        <div className="text-[8px] text-ink-500 text-center mt-1 leading-tight">
          <span className="text-brand-400">naranja</span> = tu pronóstico ·{' '}
          <span className="text-green-400">verde</span> = real
        </div>
      )}
    </div>
  )
}

function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}
