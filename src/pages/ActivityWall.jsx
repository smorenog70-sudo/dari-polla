import { useMemo } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { matchById, formatKickoff } from '../lib/matches'
import { scoreMatch } from '../lib/scoring'
import { displayName, displayAvatar } from '../lib/playerDisplay'

/**
 * Muro de actividad: genera un feed de eventos a partir de los datos
 * existentes (resultados, predicciones, perfiles). No requiere tabla nueva.
 *
 * Tipos de evento:
 *  - resultado nuevo (con cuántos acertaron el marcador exacto)
 *  - jugador(es) que clavaron el marcador exacto de un partido
 */
export default function ActivityWall() {
  const data = useLeagueData()

  const profilesById = useMemo(() => {
    const m = {}
    for (const p of data.profiles) m[p.id] = p
    return m
  }, [data.profiles])

  const events = useMemo(() => {
    if (data.loading) return []

    const predsByMatch = new Map()
    for (const p of data.predictions) {
      if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, [])
      predsByMatch.get(p.match_id).push(p)
    }

    const evts = []

    // Ordenar resultados por más reciente
    const sortedResults = [...data.results].sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    )

    for (const r of sortedResults) {
      const m = matchById(r.match_id)
      if (!m) continue
      const preds = predsByMatch.get(r.match_id) || []

      // Quiénes clavaron el marcador exacto
      const exact = preds.filter(p => p.score1 === r.score1 && p.score2 === r.score2)
      // Mejor puntaje del partido
      let topScore = 0
      for (const p of preds) {
        const pts = scoreMatch(p, r).total
        if (pts > topScore) topScore = pts
      }

      evts.push({
        type: 'result',
        at: r.updated_at,
        match: m,
        result: r,
        totalPreds: preds.length,
        exactUsers: exact.map(p => p.user_id),
        topScore,
      })
    }

    return evts.slice(0, 40) // máximo 40 eventos
  }, [data])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const nameTag = (uid) => {
    const p = profilesById[uid]
    return p ? `${displayAvatar(p)} ${displayName(p)}` : 'Alguien'
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">📰 Muro de actividad</h1>
        <p className="text-xs text-ink-300">
          Lo último que ha pasado en la polla: resultados y quién la está clavando.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">🌱</div>
          <div className="font-medium">Todavía no hay actividad</div>
          <div className="text-xs mt-1">
            Cuando empiecen a cargarse resultados, aquí verás el resumen de lo que pasa.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e, idx) => (
            <div key={idx} className="card">
              <div className="flex items-center justify-between text-xs text-ink-300 mb-1">
                <span>⚽ Resultado oficial</span>
                <span>{formatKickoff(e.match.kickoff_utc)}</span>
              </div>
              <div className="flex items-center justify-center gap-2 font-medium">
                <span className="flex-1 text-right">{e.match.team1}</span>
                <span className="pill bg-green-700 text-white font-mono">
                  {e.result.score1} - {e.result.score2}
                </span>
                <span className="flex-1 text-left">{e.match.team2}</span>
              </div>

              {/* Detalle social */}
              <div className="mt-2 text-xs text-ink-300 text-center">
                {e.totalPreds > 0 ? (
                  <>
                    {e.exactUsers.length > 0 ? (
                      <div className="text-brand-300">
                        🎯 {e.exactUsers.length === 1
                          ? `${nameTag(e.exactUsers[0])} clavó el marcador exacto (+${e.topScore})`
                          : `${e.exactUsers.length} jugadores clavaron el marcador exacto`}
                      </div>
                    ) : (
                      <div className="text-ink-500">
                        Nadie acertó el marcador exacto 😬
                      </div>
                    )}
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {e.totalPreds} {e.totalPreds === 1 ? 'persona pronosticó' : 'personas pronosticaron'} este partido
                    </div>
                  </>
                ) : (
                  <div className="text-ink-500">Nadie pronosticó este partido</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
