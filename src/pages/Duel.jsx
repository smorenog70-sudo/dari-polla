import { useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, isMatchLocked, formatKickoff } from '../lib/matches'
import { scoreMatch, scoreGroupPositions, scoreThirds } from '../lib/scoring'
import { displayName, displayAvatar } from '../lib/playerDisplay'

export default function Duel() {
  const { user } = useAuth()
  const data = useLeagueData()
  const [rivalId, setRivalId] = useState('')

  const me = data.profiles.find(p => p.id === user.id)

  // Calcular puntos totales de un jugador
  const pointsOf = (uid) => {
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    let pts = 0
    for (const p of data.predictions.filter(x => x.user_id === uid)) {
      const r = resultsById.get(p.match_id)
      if (r) pts += scoreMatch(p, r).total
    }
    pts += scoreGroupPositions(data.groupPreds.filter(x => x.user_id === uid), data.groupResults).total
    pts += scoreThirds(
      data.thirdPreds.filter(x => x.user_id === uid).map(t => t.team),
      data.thirdResults.map(t => t.team)
    ).total
    return pts
  }

  const rivals = useMemo(
    () => data.profiles.filter(p => p.id !== user.id),
    [data.profiles, user.id]
  )

  const comparison = useMemo(() => {
    if (!rivalId) return null

    const myPredsById = new Map(data.predictions.filter(p => p.user_id === user.id).map(p => [p.match_id, p]))
    const rivalPredsById = new Map(data.predictions.filter(p => p.user_id === rivalId).map(p => [p.match_id, p]))
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))

    // Solo partidos donde al menos uno predijo Y el partido está bloqueado (para no espiar)
    const rows = []
    let myWins = 0, rivalWins = 0, ties = 0
    for (const m of TOURNAMENT.matches) {
      const locked = isMatchLocked(m)
      if (!locked) continue
      const myP = myPredsById.get(m.id)
      const rvP = rivalPredsById.get(m.id)
      if (!myP && !rvP) continue
      const result = resultsById.get(m.id)
      const myPts = myP && result ? scoreMatch(myP, result).total : (result ? 0 : null)
      const rvPts = rvP && result ? scoreMatch(rvP, result).total : (result ? 0 : null)
      if (myPts != null && rvPts != null) {
        if (myPts > rvPts) myWins++
        else if (rvPts > myPts) rivalWins++
        else ties++
      }
      rows.push({ match: m, myP, rvP, result, myPts, rvPts })
    }
    return { rows, myWins, rivalWins, ties }
  }, [rivalId, data, user.id])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const rival = rivals.find(r => r.id === rivalId)
  const myTotal = pointsOf(user.id)
  const rivalTotal = rivalId ? pointsOf(rivalId) : 0

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">⚔️ Duelo</h1>
        <p className="text-xs text-ink-300">
          Compárate cara a cara con otro jugador. Solo se muestran los partidos ya cerrados.
        </p>
      </div>

      {/* Selector de rival */}
      <div className="card">
        <label className="label">Elige tu rival</label>
        <select
          value={rivalId}
          onChange={e => setRivalId(e.target.value)}
          className="input"
        >
          <option value="">— Selecciona un jugador —</option>
          {rivals.map(r => (
            <option key={r.id} value={r.id}>
              {displayAvatar(r)} {displayName(r)}
            </option>
          ))}
        </select>
      </div>

      {!rivalId && (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">🤺</div>
          <div>Elige un rival para ver el duelo.</div>
        </div>
      )}

      {rivalId && comparison && (
        <>
          {/* Marcador global */}
          <div className="card">
            <div className="grid grid-cols-3 items-center text-center">
              <div>
                <div className="text-3xl">{displayAvatar(me)}</div>
                <div className="text-sm font-medium truncate">{displayName(me)}</div>
                <div className="text-2xl font-bold text-brand-500 mt-1">{myTotal}</div>
                <div className="text-xs text-ink-500">puntos</div>
              </div>
              <div className="text-ink-500 text-sm">
                <div className="text-2xl font-bold">VS</div>
                <div className="mt-2 text-xs">
                  Duelo: <span className="text-brand-300">{comparison.myWins}</span>
                  {' - '}
                  <span className="text-sky-400">{comparison.rivalWins}</span>
                </div>
                {comparison.ties > 0 && (
                  <div className="text-[10px] text-ink-500">({comparison.ties} empates)</div>
                )}
              </div>
              <div>
                <div className="text-3xl">{displayAvatar(rival)}</div>
                <div className="text-sm font-medium truncate">{displayName(rival)}</div>
                <div className="text-2xl font-bold text-sky-400 mt-1">{rivalTotal}</div>
                <div className="text-xs text-ink-500">puntos</div>
              </div>
            </div>
            <div className="mt-3 text-center text-sm">
              {myTotal > rivalTotal
                ? <span className="text-brand-400">¡Vas ganando el duelo! 🎉</span>
                : myTotal < rivalTotal
                  ? <span className="text-sky-400">Vas perdiendo… ¡a remontar! 💪</span>
                  : <span className="text-ink-300">Empate técnico 🤝</span>}
            </div>
          </div>

          {/* Partido por partido */}
          <div className="card p-0 overflow-hidden">
            <div className="px-3 py-2 bg-ink-700 text-xs uppercase tracking-wider text-ink-300 grid grid-cols-3">
              <span>Partido</span>
              <span className="text-center">Tú</span>
              <span className="text-right">Rival</span>
            </div>
            {comparison.rows.length === 0 ? (
              <div className="p-4 text-center text-sm text-ink-500">
                Aún no hay partidos cerrados para comparar.
              </div>
            ) : (
              comparison.rows.map(({ match: m, myP, rvP, result, myPts, rvPts }) => (
                <div key={m.id} className="px-3 py-2 border-t border-ink-700 grid grid-cols-3 items-center text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-xs">{m.team1} vs {m.team2}</div>
                    {result && (
                      <div className="text-[10px] text-green-400">FT {result.score1}-{result.score2}</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="font-mono">{myP ? `${myP.score1}-${myP.score2}` : '—'}</div>
                    {myPts != null && (
                      <div className={`text-[10px] ${myPts >= (rvPts ?? 0) ? 'text-brand-400' : 'text-ink-500'}`}>
                        +{myPts}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{rvP ? `${rvP.score1}-${rvP.score2}` : '—'}</div>
                    {rvPts != null && (
                      <div className={`text-[10px] ${rvPts >= (myPts ?? 0) ? 'text-sky-400' : 'text-ink-500'}`}>
                        +{rvPts}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
