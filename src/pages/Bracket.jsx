import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { groupedMatches, formatKickoff, TOURNAMENT } from '../lib/matches'
import { resolveTeam, bracketVisualOrder } from '../lib/bracketTeams'
import { flagFor } from '../lib/flags'

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

  const roundsMatches = useMemo(() => {
    const out = {}
    for (const round of ROUNDS) {
      out[round.key] = round.key === 'final'
        ? (grouped.final || [])
        : bracketVisualOrder(TOURNAMENT.matches, round.key)
    }
    return out
  }, [grouped])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const teamAt = (raw) => resolveTeam(raw, bracketTeams)

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏆 Camino a la final</h1>
        <p className="text-xs text-ink-300">
          El cuadro de eliminatorias. Desliza horizontalmente para ver todas las rondas.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1">
            <span className="text-brand-400 font-bold">1</span> tu pronóstico
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-green-400 font-bold">1</span> resultado real
          </span>
          <span className="inline-flex items-center gap-1">🏆 quién pasó</span>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-stretch gap-3" style={{ minWidth: 'max-content' }}>
          {ROUNDS.map(round => {
            const matches = roundsMatches[round.key] || []
            if (matches.length === 0) return null
            return (
              <div key={round.key} className="w-44 shrink-0 flex flex-col">
                <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-brand-400 mb-2">
                  {round.label}
                </div>
                <div className="flex-1 flex flex-col justify-evenly gap-3">
                  {matches.map(m => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      teamAt={teamAt}
                      pred={myPredsById.get(m.id)}
                      result={resultsById.get(m.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {(grouped.third || []).length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-2">
            🥉 Tercer puesto
          </div>
          {grouped.third.map(m => (
            <div key={m.id} className="max-w-xs mx-auto">
              <MatchCard match={m} teamAt={teamAt} pred={myPredsById.get(m.id)} result={resultsById.get(m.id)} />
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-500 text-center px-4">
        Los equipos reales aparecen cuando avanza el torneo. El trofeo 🏆 marca a quién el admin
        confirmó como ganador de cada llave.
      </p>
    </div>
  )
}

function MatchCard({ match: m, teamAt, pred, result }) {
  const t1 = teamAt(m.team1_raw || m.team1)
  const t2 = teamAt(m.team2_raw || m.team2)
  const isPh1 = /^[0-9WL]/.test(t1 || '')
  const isPh2 = /^[0-9WL]/.test(t2 || '')
  const winner1 = result && result.score1 > result.score2
  const winner2 = result && result.score2 > result.score1

  return (
    <div className="bg-ink-900/60 rounded-lg border border-ink-700">
      {m.kickoff_utc && (
        <div className="text-[9px] text-ink-500 text-center pt-1 truncate px-1">
          {formatKickoff(m.kickoff_utc)}
        </div>
      )}
      <TeamRow name={t1} isPlaceholder={isPh1} predScore={pred?.score1} realScore={result?.score1} isWinner={winner1} />
      <div className="border-t border-ink-700 mx-1.5" />
      <TeamRow name={t2} isPlaceholder={isPh2} predScore={pred?.score2} realScore={result?.score2} isWinner={winner2} />
    </div>
  )
}

function TeamRow({ name, isPlaceholder, predScore, realScore, isWinner }) {
  const flag = !isPlaceholder ? flagFor(name) : '❔'
  const label = name || '?'
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-1.5 min-w-0">
      <span className="text-base shrink-0 leading-none">{flag}</span>
      <span
        className={`flex-1 min-w-0 text-xs truncate ${
          isPlaceholder ? 'text-ink-500 italic' : isWinner ? 'text-ink-50 font-semibold' : 'text-ink-300'
        }`}
        title={label}
      >
        {label}
      </span>
      {isWinner && <span className="text-[10px] shrink-0" title="Ganador">🏆</span>}
      {(predScore != null || realScore != null) && (
        <span className="text-[11px] font-mono shrink-0 tabular-nums">
          {predScore != null && <span className="text-brand-400">{predScore}</span>}
          {predScore != null && realScore != null && <span className="text-ink-600">/</span>}
          {realScore != null && <span className="text-green-400 font-bold">{realScore}</span>}
        </span>
      )}
    </div>
  )
}
