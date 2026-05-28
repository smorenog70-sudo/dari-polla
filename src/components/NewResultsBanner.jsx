import { useState } from 'react'

export default function NewResultsBanner({ newResults, totalNewPoints, dismiss }) {
  const [expanded, setExpanded] = useState(false)

  if (!newResults || newResults.length === 0) return null

  const matchesWithPoints = newResults.filter(r => r.myPrediction)
  const positivePoints = totalNewPoints > 0

  return (
    <div className="card border-brand-500/60 bg-gradient-to-br from-brand-600 to-brand-700">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{positivePoints ? '🎉' : '📢'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-brand-500">
            {newResults.length === 1
              ? '¡Hay un resultado nuevo!'
              : `¡Hay ${newResults.length} resultados nuevos!`}
          </div>
          {matchesWithPoints.length > 0 && (
            <div className="text-sm text-ink-100 mt-1">
              Ganaste <span className="font-bold text-brand-500">{totalNewPoints} puntos</span> en{' '}
              {matchesWithPoints.length === 1 ? 'este partido' : `${matchesWithPoints.length} partidos`}
            </div>
          )}

          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-brand-500 hover:underline mt-2"
            >
              Ver detalles ↓
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 text-xs">
              {newResults.slice(0, 6).map(r => {
                const { match: m, result, myPrediction: p, points: pts } = r
                return (
                  <div key={result.match_id} className="bg-brand-900/40 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {m.team1} <span className="text-ink-300">vs</span> {m.team2}
                      </span>
                      <span className="font-mono whitespace-nowrap">
                        <span className="text-green-300 font-bold">
                          {result.score1}-{result.score2}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-300 mt-1">
                      <span>
                        {p
                          ? <>Tu predicción: <span className="text-ink-100">{p.score1}-{p.score2}</span></>
                          : <span className="italic">No pronosticaste</span>}
                      </span>
                      {pts != null && (
                        <span className={`pill ${pts > 0 ? 'bg-brand-600 text-white' : 'bg-ink-700 text-ink-300'}`}>
                          {pts > 0 ? `+${pts} pts` : '0 pts'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {newResults.length > 6 && (
                <div className="text-ink-300 italic text-center">
                  y {newResults.length - 6} resultados más…
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end mt-3">
            <button
              onClick={dismiss}
              className="text-xs px-3 py-1.5 rounded-full bg-brand-600 text-white hover:bg-brand-700 font-semibold"
            >
              ✓ Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
