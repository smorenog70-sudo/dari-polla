import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { groupedMatches, isMatchLocked, TOURNAMENT } from '../lib/matches'
import { resolveTeam, bracketVisualOrder } from '../lib/bracketTeams'
import { flagFor } from '../lib/flags'

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
]

const SLOT_H = 92
const COL_W = 128
const R = 17
const TOP_PAD = 30

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

  const positions = useMemo(() => {
    const pos = {}
    const r32 = roundsMatches.r32 || []
    r32.forEach((m, i) => {
      pos[m.id] = { round: 0, y: TOP_PAD + i * SLOT_H }
    })
    for (let ri = 1; ri < ROUNDS.length; ri++) {
      const key = ROUNDS[ri].key
      const matches = roundsMatches[key] || []
      const prevKey = ROUNDS[ri - 1].key
      const prevMatches = roundsMatches[prevKey] || []
      matches.forEach((m, i) => {
        const a = prevMatches[i * 2]
        const b = prevMatches[i * 2 + 1]
        const ya = a && pos[a.id] ? pos[a.id].y : null
        const yb = b && pos[b.id] ? pos[b.id].y : null
        const y = ya != null && yb != null ? (ya + yb) / 2 : TOP_PAD + i * SLOT_H * Math.pow(2, ri)
        pos[m.id] = { round: ri, y }
      })
    }
    return pos
  }, [roundsMatches])

  const totalHeight = Math.max(...Object.values(positions).map(p => p.y), 0) + R + 40
  const totalWidth = TOP_PAD + ROUNDS.length * COL_W + 80

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const teamAt = (raw) => resolveTeam(raw, bracketTeams)

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏆 Camino a la final</h1>
        <p className="text-xs text-ink-300">
          El cuadro de eliminatorias. Desliza horizontalmente para ver todas las rondas.
          <span className="text-brand-400"> ⬤ naranja</span> = tu pronóstico ·{' '}
          <span className="text-green-400">⬤ verde</span> = resultado real.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          style={{ minWidth: totalWidth }}
        >
          {ROUNDS.map((round, ri) => (
            <text
              key={round.key}
              x={TOP_PAD + ri * COL_W}
              y={14}
              textAnchor="middle"
              className="fill-brand-400"
              style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              {round.label}
            </text>
          ))}

          {ROUNDS.slice(1).map((round, riMinus1) => {
            const ri = riMinus1 + 1
            const matches = roundsMatches[round.key] || []
            const prevKey = ROUNDS[ri - 1].key
            const prevMatches = roundsMatches[prevKey] || []
            const x1 = TOP_PAD + (ri - 1) * COL_W + R
            const xMid = TOP_PAD + (ri - 1) * COL_W + COL_W / 2
            const x2 = TOP_PAD + ri * COL_W - R
            return matches.map((m, i) => {
              const a = prevMatches[i * 2]
              const b = prevMatches[i * 2 + 1]
              const posM = positions[m.id]
              if (!posM) return null
              const ya = a && positions[a.id] ? positions[a.id].y : null
              const yb = b && positions[b.id] ? positions[b.id].y : null
              return (
                <g key={m.id + '-lines'}>
                  {ya != null && (
                    <path
                      d={`M ${x1} ${ya} L ${xMid} ${ya} L ${xMid} ${posM.y} L ${x2} ${posM.y}`}
                      fill="none" stroke="currentColor" className="text-ink-700" strokeWidth="1.5"
                    />
                  )}
                  {yb != null && (
                    <path
                      d={`M ${x1} ${yb} L ${xMid} ${yb} L ${xMid} ${posM.y} L ${x2} ${posM.y}`}
                      fill="none" stroke="currentColor" className="text-ink-700" strokeWidth="1.5"
                    />
                  )}
                </g>
              )
            })
          })}

          {ROUNDS.map((round, ri) => {
            const matches = roundsMatches[round.key] || []
            const x = TOP_PAD + ri * COL_W
            return matches.map(m => {
              const posM = positions[m.id]
              if (!posM) return null
              const pred = myPredsById.get(m.id)
              const result = resultsById.get(m.id)
              const t1 = teamAt(m.team1_raw || m.team1)
              const t2 = teamAt(m.team2_raw || m.team2)
              const isPh1 = /^[0-9WL]/.test(t1 || '')
              const isPh2 = /^[0-9WL]/.test(t2 || '')
              const winner1 = result && result.score1 > result.score2
              const winner2 = result && result.score2 > result.score1
              const gap = 24
              return (
                <g key={m.id}>
                  <TeamCircle
                    x={x} y={posM.y - gap / 2}
                    name={t1} isPlaceholder={isPh1}
                    predScore={pred?.score1} realScore={result?.score1}
                    isWinner={winner1}
                  />
                  <TeamCircle
                    x={x} y={posM.y + gap / 2}
                    name={t2} isPlaceholder={isPh2}
                    predScore={pred?.score2} realScore={result?.score2}
                    isWinner={winner2}
                  />
                </g>
              )
            })
          })}
        </svg>
      </div>

      {(grouped.third || []).length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-2">
            🥉 Tercer puesto
          </div>
          {grouped.third.map(m => {
            const pred = myPredsById.get(m.id)
            const result = resultsById.get(m.id)
            const t1 = teamAt(m.team1_raw || m.team1)
            const t2 = teamAt(m.team2_raw || m.team2)
            return (
              <div key={m.id} className="flex items-center justify-center gap-4 py-2">
                <MiniTeam name={t1} predScore={pred?.score1} realScore={result?.score1} />
                <span className="text-ink-500 text-xs">vs</span>
                <MiniTeam name={t2} predScore={pred?.score2} realScore={result?.score2} />
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-ink-500 text-center px-4">
        Los equipos reales aparecen cuando avanza el torneo. Los círculos muestran tu pronóstico (naranja)
        y el resultado oficial (verde) para cada partido.
      </p>
    </div>
  )
}

function TeamCircle({ x, y, name, isPlaceholder, predScore, realScore, isWinner }) {
  const flag = !isPlaceholder ? flagFor(name) : ''
  const label = name || '?'
  const short = isPlaceholder ? label.slice(0, 4) : label.slice(0, 3).toUpperCase()
  return (
    <g>
      <circle
        cx={x} cy={y} r={R}
        className={isWinner ? 'fill-green-900 stroke-green-500' : 'fill-ink-800 stroke-ink-600'}
        strokeWidth="1.5"
      />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 14 }}>
        {flag || ''}
      </text>
      {!flag && (
        <text
          x={x} y={y} textAnchor="middle" dominantBaseline="central"
          className="fill-ink-300" style={{ fontSize: 8, fontWeight: 600 }}
        >
          {short}
        </text>
      )}
      <text
        x={x} y={y + R + 11} textAnchor="middle"
        className="fill-ink-400" style={{ fontSize: 8 }}
      >
        {label.length > 12 ? label.slice(0, 11) + '…' : label}
      </text>
      {(predScore != null || realScore != null) && (
        <text
          x={x + R + 4} y={y} dominantBaseline="central"
          style={{ fontSize: 9, fontWeight: 700 }}
        >
          {predScore != null && <tspan className="fill-brand-400">{predScore}</tspan>}
          {predScore != null && realScore != null && <tspan className="fill-ink-600">/</tspan>}
          {realScore != null && <tspan className="fill-green-400">{realScore}</tspan>}
        </text>
      )}
    </g>
  )
}

function MiniTeam({ name, predScore, realScore }) {
  const flag = flagFor(name)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-9 h-9 rounded-full bg-ink-800 border border-ink-600 flex items-center justify-center text-base">
        {flag}
      </div>
      <span className="text-[10px] text-ink-400 max-w-[70px] truncate text-center">{name}</span>
      {(predScore != null || realScore != null) && (
        <span className="text-[10px] font-mono">
          {predScore != null && <span className="text-brand-400">{predScore}</span>}
          {predScore != null && realScore != null && <span className="text-ink-600">/</span>}
          {realScore != null && <span className="text-green-400">{realScore}</span>}
        </span>
      )}
    </div>
  )
}
