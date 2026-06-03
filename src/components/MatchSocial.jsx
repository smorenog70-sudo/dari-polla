import { useState } from 'react'
import { useMatchSocial } from '../lib/useMatchSocial'
import { displayName, displayAvatar } from '../lib/playerDisplay'

const REACTION_EMOJIS = ['🔥', '😂', '😱', '👏', '😮', '💪']

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

export default function MatchSocial({ match, user, profile, profilesById, isAdmin }) {
  const { comments, reactions, loading, addComment, deleteComment, setReaction } =
    useMatchSocial(match.id, user.id)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const myReaction = reactions.find(r => r.user_id === user.id)?.emoji

  // Agrupar reacciones por emoji con conteo
  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1
    return acc
  }, {})

  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await addComment(text)
    setText('')
    setSending(false)
  }

  const nameFor = (uid) => {
    const p = profilesById?.[uid]
    return p ? `${displayAvatar(p)} ${displayName(p)}` : 'Jugador'
  }

  return (
    <div className="mt-3 pt-3 border-t border-ink-700">
      {/* Reacciones rápidas */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {REACTION_EMOJIS.map(emoji => {
          const count = reactionCounts[emoji] || 0
          const active = myReaction === emoji
          return (
            <button
              key={emoji}
              onClick={() => setReaction(emoji)}
              className={`text-sm px-2 py-1 rounded-full transition ${
                active
                  ? 'bg-brand-600 ring-1 ring-brand-400'
                  : 'bg-ink-700 hover:bg-ink-600'
              }`}
            >
              {emoji}{count > 0 && <span className="ml-1 text-xs text-ink-100">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toggle de comentarios */}
      <button
        onClick={() => setOpen(o => !o)}
        className="mt-2 text-xs text-ink-300 hover:text-ink-100"
      >
        💬 {comments.length > 0 ? `${comments.length} comentario${comments.length !== 1 ? 's' : ''}` : 'Comentar'}
        {open ? ' ▲' : ' ▼'}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {/* Caja para escribir */}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
              maxLength={280}
              placeholder="Escribe algo…"
              className="input flex-1 text-sm py-1.5"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>

          {/* Lista de comentarios */}
          {loading ? (
            <div className="text-xs text-ink-500">Cargando…</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-ink-500 italic">
              Sé el primero en comentar este partido 🎤
            </div>
          ) : (
            <div className="space-y-2">
              {comments.map(c => {
                const canDelete = c.user_id === user.id || isAdmin
                return (
                  <div key={c.id} className="bg-ink-900/50 rounded-lg p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-brand-300">
                        {nameFor(c.user_id)}
                      </span>
                      <span className="text-[10px] text-ink-500">{timeAgo(c.created_at)}</span>
                    </div>
                    <div className="text-sm text-ink-100 mt-0.5 break-words">{c.body}</div>
                    {canDelete && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-[10px] text-red-400 hover:text-red-300 mt-1"
                      >
                        eliminar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
