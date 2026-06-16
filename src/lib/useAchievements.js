import { useMemo } from 'react'
import { useAuth } from './auth'
import { useLeagueData } from './useLeagueData'
import { playedMatches, achievements, evolutionByMatch } from './playerStats'

/**
 * Calcula las medallas del usuario actual (mismas que muestra "Mi progreso").
 * Reutilizable desde Home (para el banner) y Progress (para el detalle).
 */
export function useAchievements() {
  const { user } = useAuth()
  const data = useLeagueData()

  return useMemo(() => {
    if (data.loading) return { achievements: [], loading: true }
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const myPreds = data.predictions.filter(p => p.user_id === user.id)
    const rows = playedMatches(myPreds, resultsById)
    const evolution = evolutionByMatch(myPreds, resultsById)

    const allRowsByUser = new Map()
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }
    for (const [uid, preds] of predsByUser) {
      allRowsByUser.set(uid, playedMatches(preds, resultsById))
    }

    const ach = achievements(rows, evolution, allRowsByUser, user.id)

    // GOAT (#1 de la tabla general por puntos de partidos)
    const totals = []
    for (const [uid, urows] of allRowsByUser) {
      totals.push({ uid, pts: urows.reduce((s, x) => s + x.points, 0) })
    }
    totals.sort((a, b) => b.pts - a.pts)
    const myTotal = totals.find(t => t.uid === user.id)
    const isGoat = totals.length > 1 && myTotal && myTotal.pts > 0 && totals[0].uid === user.id
    const goat = ach.find(a => a.id === 'goat')
    if (goat) goat.unlocked = isGoat

    return { achievements: ach, loading: false }
  }, [data, user.id])
}
