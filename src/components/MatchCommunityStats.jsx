import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { displayName, displayAvatar } from '../lib/playerDisplay'

/**
 * Desglose comunitario de un partido (se revela solo tras el pitazo):
 *  - Resumen agregado: cuántos apostaron gana team1 / empate / gana team2 (con %).
 *  - Distribución de marcadores más repetidos.
 *  - Lista de qué puso cada persona, resaltando al usuario actual.
 *
 * Compartido entre "Estadísticas comunales → Marcadores por persona" y el
 * Simulador en vivo (fusión de ambos).
 *
 * @param match - partido con nombres ya resueltos (team1/team2)
 * @param predictions - predicciones de ESE partido [{user_id, score1, score2}]
 * @param profilesById - mapa id -> perfil
 */
export default function MatchCommunityStats({ match, predictions, profilesById }) {
  const { user } = useAuth()

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

  if (total === 0) {
    return <div className="text-xs text-ink-500 text-center py-2">Nadie puso marcador en este partido.</div>
  }

  return (
    <div className="space-y-3">
      {/* Resumen agregado: hacia dónde se inclinó la comunidad */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
        <div>
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

      {/* Qué puso cada persona */}
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
