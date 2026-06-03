import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

/**
 * Carga y administra comentarios + reacciones de un partido específico.
 * Devuelve helpers para publicar/borrar comentarios y fijar la reacción propia.
 */
export function useMatchSocial(matchId, userId) {
  const [comments, setComments] = useState([])
  const [reactions, setReactions] = useState([]) // [{match_id, user_id, emoji}]
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!matchId) return
    setLoading(true)
    const [c, r] = await Promise.all([
      supabase.from('match_comments').select('*').eq('match_id', matchId).order('created_at', { ascending: false }),
      supabase.from('match_reactions').select('*').eq('match_id', matchId),
    ])
    setComments(c.data || [])
    setReactions(r.data || [])
    setLoading(false)
  }, [matchId])

  useEffect(() => { load() }, [load])

  const addComment = async (body) => {
    const text = (body || '').trim()
    if (!text) return { error: 'Comentario vacío' }
    if (text.length > 280) return { error: 'Máximo 280 caracteres' }
    const { data, error } = await supabase
      .from('match_comments')
      .insert({ match_id: matchId, user_id: userId, body: text })
      .select()
      .single()
    if (!error && data) {
      setComments(prev => [data, ...prev])
    }
    return { error: error?.message }
  }

  const deleteComment = async (id) => {
    const { error } = await supabase.from('match_comments').delete().eq('id', id)
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== id))
    }
    return { error: error?.message }
  }

  const setReaction = async (emoji) => {
    // Si ya tenía esta reacción, la quita (toggle)
    const mine = reactions.find(r => r.user_id === userId)
    if (mine && mine.emoji === emoji) {
      const { error } = await supabase
        .from('match_reactions')
        .delete()
        .eq('match_id', matchId)
        .eq('user_id', userId)
      if (!error) setReactions(prev => prev.filter(r => r.user_id !== userId))
      return
    }
    // upsert la reacción
    const { error } = await supabase
      .from('match_reactions')
      .upsert({ match_id: matchId, user_id: userId, emoji }, { onConflict: 'match_id,user_id' })
    if (!error) {
      setReactions(prev => {
        const others = prev.filter(r => r.user_id !== userId)
        return [...others, { match_id: matchId, user_id: userId, emoji }]
      })
    }
  }

  return { comments, reactions, loading, addComment, deleteComment, setReaction, refresh: load }
}
