import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { computeTable } from '../lib/computeTable'
import { analyzeBestOutcome } from '../lib/outcomeAnalysis'
import { TOURNAMENT, matchById, formatKickoff, hasMatchStarted } from '../lib/matches'
import { resolveTeam, autoResolveGroupPositions } from '../lib/bracketTeams'
import { computeGroupTables } from '../lib/groupTables'
import { teamWithFlag } from '../lib/flags'
import { useAuth } from '../lib/auth'

export default function Simulator() {
  const data = useLeagueData()
  const { user } = useAuth()
  // Map<match_id, {score1, score2}>
  const [sims, setSims] = useState(new Map())

  // Partidos simulables: los que aún NO tienen resultado oficial.
  // Priorizamos los que ya empezaron o están por empezar.
  const realResultIds = useMemo(
    () => new Set(data.results.map(r => r.match_id)),
    [data.results]
  )

  // Resolver nombres de playoffs (1A→equipo) para que 16avos/octavos/etc.
  // ya definidos también se puedan simular.
  const bracketTeams = useMemo(() => {
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const gt = computeGroupTables(resultsById)
    return { ...autoResolveGroupPositions(gt), ...(data.config.bracket_teams || {}) }
  }, [data.results, data.config.bracket_teams])

  const resolveMatchTeams = (m) => {
    if (m.stage === 'group') return m
    return {
      ...m,
      team1: resolveTeam(m.team1_raw || m.team1, bracketTeams),
      team2: resolveTeam(m.team2_raw || m.team2, bracketTeams),
    }
  }

  const simulableMatches = useMemo(() => {
    return TOURNAMENT.matches
      // Solo partidos que YA EMPEZARON (predicciones ya cerradas y visibles)
      // y que aún NO tienen resultado oficial cargado. Así nadie puede simular
      // partidos futuros para deducir las predicciones secretas de los demás.
      .filter(m => hasMatchStarted(m) && !realResultIds.has(m.id))
      .map(resolveMatchTeams) // resolver nombres ANTES de filtrar placeholders
      .filter(m => !m.team1?.match(/^[0-9WL]/) && !m.team2?.match(/^[0-9WL]/)) // solo los que ya se resolvieron
      .sort((a, b) => new Date(b.kickoff_utc) - new Date(a.kickoff_utc)) // más reciente primero
  }, [realResultIds, bracketTeams])

  const setScore = (matchId, side, value) => {
    const v = value === '' ? '' : Math.max(0, Math.min(20, parseInt(value) || 0))
    setSims(prev => {
      const next = new Map(prev)
      const cur = next.get(matchId) || { score1: '', score2: '' }
      const updated = { ...cur, [side]: v }
      next.set(matchId, updated)
      return next
    })
  }

  const setSimAdvances = (matchId, who) => {
    setSims(prev => {
      const next = new Map(prev)
      const cur = next.get(matchId) || { score1: '', score2: '' }
      next.set(matchId, { ...cur, advances: cur.advances === who ? null : who })
      return next
    })
  }

  // Calcula el "quién pasa" efectivo de una simulación según su marcador.
  // Lo fuerza el marcador salvo empate (ahí vale lo elegido).
  const effectiveAdvancesOf = (match, s) => {
    if (!match || match.stage === 'group') return null
    const a = Number(s.score1), b = Number(s.score2)
    if (a > b) return 'team1'
    if (b > a) return 'team2'
    return s.advances ?? null
  }

  // Para la tabla solo pasamos las simulaciones completas
  const completeSims = useMemo(() => {
    const m = new Map()
    for (const [id, s] of sims) {
      if (s.score1 !== '' && s.score2 !== '' && s.score1 != null && s.score2 != null) {
        const match = simulableMatches.find(x => x.id === id) || matchById(id)
        m.set(id, {
          score1: Number(s.score1),
          score2: Number(s.score2),
          advances: effectiveAdvancesOf(match, s),
        })
      }
    }
    return m
  }, [sims, simulableMatches])

  const liveTable = useMemo(() => computeTable(data, completeSims), [data, completeSims])

  // Análisis de "qué resultado te conviene" para el primer partido simulable.
  // Excluimos ese partido de la base para analizar sus escenarios desde cero.
  const analysis = useMemo(() => {
    if (data.loading || simulableMatches.length === 0) return null
    const target = simulableMatches[0]
    const baseSims = new Map(completeSims)
    baseSims.delete(target.id) // analizar este partido en limpio
    const res = analyzeBestOutcome(data, target.id, user.id, baseSims)
    return res ? { ...res, matchId: target.id } : null
  }, [data, simulableMatches, completeSims, user.id])

  const clearAll = () => setSims(new Map())
  const activeCount = completeSims.size

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔮 Simulador en vivo</h1>
        <p className="text-xs text-ink-300">
          Pon los marcadores que quieras y mira cómo quedaría la tabla si los partidos
          terminaran así. Es solo tuyo: nada de esto afecta los puntos oficiales ni lo ven los demás.
        </p>
      </div>

      {/* Partidos para simular — AHORA ARRIBA */}
      <div className="card">
        <h2 className="font-semibold mb-1">⚽ Pon los marcadores</h2>
        <p className="text-xs text-ink-300 mb-3">
          Solo puedes simular partidos que ya arrancaron. Los partidos futuros no se pueden
          simular porque las predicciones de los demás todavía son secretas.
        </p>
        {simulableMatches.length === 0 ? (
          <div className="text-center py-6 text-ink-400">
            <div className="text-3xl mb-2">⏳</div>
            <div className="text-sm font-medium">No hay partidos en curso ahora mismo</div>
            <div className="text-xs mt-1 text-ink-500">
              Cuando arranque un partido que aún no tenga resultado oficial, aparecerá aquí para simular.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {simulableMatches.map(m => {
              const sim = sims.get(m.id) || { score1: '', score2: '' }
              const started = hasMatchStarted(m)
              return (
                <div key={m.id} className={`rounded-lg p-2 ${started ? 'bg-brand-900/20 border border-brand-700/40' : 'bg-ink-900/40'}`}>
                  <div className="flex items-center justify-between text-[10px] text-ink-400 mb-1">
                    <span>{m.group ? `Grupo ${m.group} · ` : ''}{formatKickoff(m.kickoff_utc)}</span>
                    {started && <span className="text-brand-400">🔴 en juego</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-right text-sm truncate">{teamWithFlag(m.team1)}</span>
                    <input
                      type="number" min="0" max="20" inputMode="numeric"
                      value={sim.score1}
                      onChange={e => setScore(m.id, 'score1', e.target.value)}
                      className="w-11 text-center bg-ink-800 border border-ink-600 rounded py-1 text-sm"
                      placeholder="-"
                    />
                    <span className="text-ink-500 text-xs">-</span>
                    <input
                      type="number" min="0" max="20" inputMode="numeric"
                      value={sim.score2}
                      onChange={e => setScore(m.id, 'score2', e.target.value)}
                      className="w-11 text-center bg-ink-800 border border-ink-600 rounded py-1 text-sm"
                      placeholder="-"
                    />
                    <span className="flex-1 text-left text-sm truncate">{teamWithFlag(m.team2)}</span>
                  </div>

                  {/* PLAYOFFS: quién pasa (+10). Bloqueado por marcador, libre solo en empate. */}
                  {m.stage !== 'group' && (() => {
                    const bothFilled = sim.score1 !== '' && sim.score2 !== '' && sim.score1 != null && sim.score2 != null
                    const isDraw = bothFilled && Number(sim.score1) === Number(sim.score2)
                    const forced = bothFilled && !isDraw ? (Number(sim.score1) > Number(sim.score2) ? 'team1' : 'team2') : null
                    const effective = forced || (isDraw ? sim.advances : null)
                    const enabled = isDraw
                    const btn = (who) => `flex-1 text-[11px] py-1 rounded border transition ${
                      effective === who ? 'bg-brand-600 border-brand-500 text-white font-semibold' : 'bg-ink-800 border-ink-600 text-ink-300'
                    } ${!enabled ? 'cursor-default opacity-90' : ''}`
                    return (
                      <div className="mt-2 bg-ink-900/60 rounded-lg p-1.5">
                        <div className="text-[9px] text-ink-400 text-center mb-1">¿Quién pasa? (+10)</div>
                        <div className="flex gap-1">
                          <button type="button" disabled={!enabled} onClick={() => enabled && setSimAdvances(m.id, 'team1')} className={btn('team1')}>
                            {teamWithFlag(m.team1)}
                          </button>
                          <button type="button" disabled={!enabled} onClick={() => enabled && setSimAdvances(m.id, 'team2')} className={btn('team2')}>
                            {teamWithFlag(m.team2)}
                          </button>
                        </div>
                        {isDraw && (
                          <div className="text-[9px] text-brand-300 text-center mt-1">⚖️ Empate: elige quién pasa</div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Análisis de qué resultado conviene (solo si hay 1 partido simulable, para no saturar) */}
                  {analysis && analysis.matchId === m.id && (
                    <div className="mt-2 pt-2 border-t border-ink-700/50 text-[11px] space-y-1">
                      <div className="text-green-300">
                        ✅ Te conviene que quede <span className="font-mono font-bold">{analysis.best.score}</span>
                        {analysis.best.rankDelta > 0
                          ? ` → subes ${analysis.best.rankDelta} ${analysis.best.rankDelta === 1 ? 'puesto' : 'puestos'} (${analysis.best.rank}º)`
                          : ` → te mantienes ${analysis.best.rank}º`}
                      </div>
                      <div className="text-red-300">
                        ⚠️ Te perjudica <span className="font-mono font-bold">{analysis.worst.score}</span>
                        {analysis.worst.rankDelta < 0
                          ? ` → bajas ${Math.abs(analysis.worst.rankDelta)} ${Math.abs(analysis.worst.rankDelta) === 1 ? 'puesto' : 'puestos'} (${analysis.worst.rank}º)`
                          : ` → te mantienes ${analysis.worst.rank}º`}
                      </div>
                      {analysis.rival && (
                        <div className="text-ink-300">
                          🎯 Para alcanzar a <span className="font-medium">{analysis.rival.avatar} {analysis.rival.name}</span> (arriba tuyo),
                          tu mejor resultado es <span className="font-mono font-bold">{analysis.rival.bestScore}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabla proyectada — AHORA ABAJO */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">
            {activeCount > 0 ? '📊 Tabla proyectada' : '📊 Tabla actual'}
          </h2>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs px-2 py-1 rounded-lg bg-ink-700 hover:bg-ink-600 text-ink-200">
              Limpiar ({activeCount})
            </button>
          )}
        </div>
        {activeCount === 0 && (
          <p className="text-xs text-ink-500 mb-2">
            Pon marcadores arriba para ver cómo se movería la tabla. ⬆️
          </p>
        )}
        <div className="overflow-hidden rounded-lg border border-ink-700">
          <table className="w-full text-sm">
            <tbody>
              {liveTable.map((r) => {
                const isMe = r.id === user.id
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-ink-700 first:border-t-0 ${isMe ? 'bg-brand-900/30' : ''}`}
                  >
                    <td className="py-1.5 px-2 font-mono text-ink-300 w-10">
                      <div className="flex items-center gap-1">
                        <span>{r.tied ? 'T' : ''}{r.rank}</span>
                        {activeCount > 0 && r.delta !== 0 && (
                          <span className={`text-[9px] ${r.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {r.delta > 0 ? `▲${r.delta}` : `▼${Math.abs(r.delta)}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 truncate">
                      {r.avatar} {r.name} {isMe && <span className="text-[10px] text-brand-400">(tú)</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-brand-400 w-16">
                      {r.total}
                      {activeCount > 0 && r.gained > 0 && (
                        <span className="text-[9px] text-green-400 ml-1">+{r.gained}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-ink-500 text-center px-4">
        💡 Tip: simula el marcador del partido que se está jugando para ver en vivo
        cómo cambiaría tu posición gol a gol.
      </p>
    </div>
  )
}
