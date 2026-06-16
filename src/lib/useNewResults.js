import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabase'
import { scoreMatch } from './scoring'
import { matchById } from './matches'

const STORAGE_KEY = 'ahk-last-results-check'

/**
 * Detecta resultados nuevos desde la última vez que el usuario abrió la app
 * y calcula cuántos puntos ganó en esos partidos. Marca como vista al despachar.
 *
 * Retorna: { newResults: [...], totalNewPoints, dismiss() }
 *
 * Cada `newResults` es { match, result, myPrediction, points }.
 */
export function useNewResults(userId) {
  const [allResults, setAllResults] = useState([])
  const [myPreds, setMyPreds] = useState([])
  const [lastSeen, setLastSeen] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw || null
    } catch { return null }
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = async () => {
      const [rRes, pRes] = await Promise.all([
        supabase.from('results').select('*').order('updated_at', { ascending: false }),
        supabase.from('predictions').select('*').eq('user_id', userId),
      ])
      if (cancelled) return
      setAllResults(rRes.data || [])
      setMyPreds(pRes.data || [])
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  const newResults = useMemo(() => {
    if (!allResults.length) return []

    const predsById = new Map(myPreds.map(p => [p.match_id, p]))
    const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0

    return allResults
      .filter(r => {
        const updatedMs = new Date(r.updated_at).getTime()
        return updatedMs > lastSeenMs
      })
      .map(r => {
        const m = matchById(r.match_id)
        const myPred = predsById.get(r.match_id)
        const pts = myPred ? scoreMatch(myPred, r).total : null
        return { match: m, result: r, myPrediction: myPred || null, points: pts }
      })
      .filter(x => x.match) // ignorar si no hay partido (defensive)
  }, [allResults, myPreds, lastSeen])

  const totalNewPoints = useMemo(
    () => newResults.reduce((sum, r) => sum + (r.points || 0), 0),
    [newResults]
  )

  const dismiss = () => {
    const now = new Date().toISOString()
    try { localStorage.setItem(STORAGE_KEY, now) } catch {}
    setLastSeen(now)
  }

  // Si es la primera vez en este dispositivo, marcamos como visto sin notificar
  // (no queremos saturar de notificaciones de partidos viejos).
  useEffect(() => {
    if (lastSeen) return
    if (allResults.length === 0) return
    // marcar como visto el más reciente
    const newest = allResults[0]
    if (newest?.updated_at) {
      try { localStorage.setItem(STORAGE_KEY, newest.updated_at) } catch {}
      setLastSeen(newest.updated_at)
    }
  }, [lastSeen, allResults])

  return { newResults, totalNewPoints, dismiss }
}
