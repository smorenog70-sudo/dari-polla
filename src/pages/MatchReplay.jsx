import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, formatKickoff } from '../lib/matches'
import { scoreMatch } from '../lib/scoring'
import { displayName, displayAvatar } from '../lib/playerDisplay'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

export default function MatchReplay() {
  const data = useLeagueData()
  const [selectedId, setSelectedId] = useState(null)
  const [comments, setComments] = useState([])
  const [reactions, setReactions] = useState([])
  const [loadingSocial, setLoadingSocial] = useState(false)

  const profilesById = useMemo(() => {
    const m = {}
    for (const p of data.profiles) m[p.id] = p
    return m
  }, [data.profiles])

  const predsByMatch = useMemo(() => {
    const map = new Map()
    for (const p of data.predictions) {
      if (!map.has(p.match_id)) map.set(p.match_id, [])
      map.get(p.match_id).push(p)
    }
    return map
  }, [data.predictions])

  // Partidos con resultado, más reciente primero
  const playedMatches = useMemo(() => {
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    return TOURNAMENT.matches
      .filter(m => resultsById.has(m.id))
      .map(m => ({ match: m, result: resultsById.get(m.id) }))
      .sort((a, b) => new Date(b.match.kickoff_utc) - new Date(a.match.kickoff_utc))
  }, [data.results])

  // Cargar comentarios + reacciones del partido seleccionado
  useEffect(() => {
    if (!selectedId) return
    setLoadingSocial(true)
    Promise.all([
      supabase.from('match_comments').select('*').eq('match_id', selectedId).order('created_at', { ascending: true }),
      supabase.from('match_reactions').select('*').eq('match_id', selectedId),
    ]).then(([c, r]) => {
      setComments(c.data || [])
      setReactions(r.data || [])
      setLoadingSocial(false)
    })
  }, [selectedId])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const selected = selectedId ? playedMatches.find(p => p.match.id === selectedId) : null

  // Vista de detalle (revive)
  if (selected) {
    const { match: m, result } = selected
    const preds = predsByMatch.get(m.id) || []
    const exactos = []
    const acertaronGanador = []
    for (const p of preds) {
      const s = scoreMatch(p, result)
      if (s.breakdown.exact > 0) exactos.push(p.user_id)
      else if (s.breakdown.outcome > 0) acertaronGanador.push(p.user_id)
    }
    const reactionCounts = reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1
      return acc
    }, {})
    const nameTag = (uid) => {
      const p = profilesById[uid]
      return p ? `${displayAvatar(p)} ${displayName(p)}` : 'Alguien'
    }

    return (
      <div className="space-y-3 pb-20">
        <button onClick={() => setSelectedId(null)} className="text-sm text-brand-500 hover:underline">
          ← Volver
        </button>

        {/* Marcador */}
        <div className="card text-center">
          <div className="text-xs text-ink-300 mb-2">
            {m.group ? `Grupo ${m.group} · ` : ''}{formatKickoff(m.kickoff_utc)}
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="flex-1 text-right font-semibold">{m.team1}</span>
            <span className="text-3xl font-bold text-brand-500 font-mono">
              {result.score1} - {result.score2}
            </span>
            <span className="flex-1 text-left font-semibold">{m.team2}</span>
          </div>
        </div>

        {/* Quiénes acertaron */}
        <div className="card">
          <h2 className="font-semibold mb-2">🎯 ¿Quién la clavó?</h2>
          {exactos.length === 0 && acertaronGanador.length === 0 ? (
            <p className="text-sm text-ink-500">Nadie acertó este partido 😬</p>
          ) : (
            <div className="space-y-2 text-sm">
              {exactos.length > 0 && (
                <div>
                  <div className="text-xs text-brand-400 uppercase tracking-wider mb-1">Marcador exacto (+10)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {exactos.map(uid => (
                      <span key={uid} className="pill bg-brand-700 text-white">{nameTag(uid)}</span>
                    ))}
                  </div>
                </div>
              )}
              {acertaronGanador.length > 0 && (
                <div>
                  <div className="text-xs text-ink-400 uppercase tracking-wider mb-1">Acertaron el ganador</div>
                  <div className="flex flex-wrap gap-1.5">
                    {acertaronGanador.map(uid => (
                      <span key={uid} className="pill bg-ink-700 text-ink-100">{nameTag(uid)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="text-[11px] text-ink-500 mt-2">
            {preds.length} {preds.length === 1 ? 'persona pronosticó' : 'personas pronosticaron'} este partido
          </div>
        </div>

        {/* Reacciones */}
        {reactions.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-2">😎 Reacciones</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="pill bg-ink-700 text-ink-100">{emoji} {count}</span>
              ))}
            </div>
          </div>
        )}

        {/* Comentarios que se escribieron */}
        <div className="card">
          <h2 className="font-semibold mb-2">💬 Lo que se dijo</h2>
          {loadingSocial ? (
            <p className="text-sm text-ink-500">Cargando…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-ink-500 italic">No hubo comentarios en este partido.</p>
          ) : (
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="bg-ink-900/50 rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-brand-300">{nameTag(c.user_id)}</span>
                    <span className="text-[10px] text-ink-500">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="text-sm text-ink-100 mt-0.5 break-words">{c.body}</div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink-500 mt-2">
            Los comentarios se escribieron antes y durante el partido. ¿Quién la embarró con su predicción? 😏
          </p>
        </div>
      </div>
    )
  }

  // Lista de partidos jugados
  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">📜 Revive el partido</h1>
        <p className="text-xs text-ink-300">
          Toca un partido para ver el resultado, quién la clavó y lo que se comentó.
        </p>
      </div>

      {playedMatches.length === 0 ? (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">⏳</div>
          <div>Todavía no hay partidos jugados.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {playedMatches.map(({ match: m, result }) => {
            const preds = predsByMatch.get(m.id) || []
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="card w-full text-left hover:bg-ink-700 transition"
              >
                <div className="flex items-center justify-between text-xs text-ink-300 mb-1">
                  <span>{m.group ? `Grupo ${m.group}` : (m.round || '')}</span>
                  <span>{formatKickoff(m.kickoff_utc)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="flex-1 text-right text-sm font-medium">{m.team1}</span>
                  <span className="pill bg-green-700 text-white font-mono">{result.score1}-{result.score2}</span>
                  <span className="flex-1 text-left text-sm font-medium">{m.team2}</span>
                </div>
                <div className="text-[11px] text-ink-500 text-center mt-1">
                  {preds.length} pronósticos · toca para revivir →
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
