import { scoreMatch, scoreGroupPositions, scoreThirds } from './scoring'

/**
 * Calcula la tabla de posiciones (solo puntos de partidos + bonus),
 * permitiendo inyectar resultados SIMULADOS además de los reales.
 *
 * @param data - el objeto de useLeagueData
 * @param simulatedResults - Map<match_id, {score1, score2}> con marcadores simulados
 *                           que se suman/sobreponen a los resultados reales.
 * @returns array ordenado con { id, name, avatar, total, real, delta, rank, tied }
 */
export function computeTable(data, simulatedResults = new Map()) {
  if (data.loading) return []

  const predsByUser = new Map()
  for (const p of data.predictions) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
    predsByUser.get(p.user_id).push(p)
  }
  const gpByUser = new Map()
  for (const g of data.groupPreds) {
    if (!gpByUser.has(g.user_id)) gpByUser.set(g.user_id, [])
    gpByUser.get(g.user_id).push(g)
  }
  const tpByUser = new Map()
  for (const t of data.thirdPreds) {
    if (!tpByUser.has(t.user_id)) tpByUser.set(t.user_id, [])
    tpByUser.get(t.user_id).push(t.team)
  }
  const actualThirds = data.thirdResults.map(r => r.team)

  // Resultados reales
  const realById = new Map(data.results.map(r => [r.match_id, r]))
  // Resultados efectivos = reales + simulados (los simulados ganan si chocan)
  const effectiveById = new Map(realById)
  for (const [matchId, sim] of simulatedResults) {
    effectiveById.set(matchId, { match_id: matchId, score1: sim.score1, score2: sim.score2, advances: sim.advances ?? null })
  }

  const scoreWith = (byId) => {
    const map = {}
    for (const prof of data.profiles) {
      const myPreds = predsByUser.get(prof.id) || []
      let pts = 0
      for (const p of myPreds) {
        const r = byId.get(p.match_id)
        if (r) pts += scoreMatch(p, r).total
      }
      let bonus = 0
      bonus += scoreGroupPositions(gpByUser.get(prof.id) || [], data.groupResults).total
      bonus += scoreThirds(tpByUser.get(prof.id) || [], actualThirds).total
      map[prof.id] = pts + bonus
    }
    return map
  }

  const realScores = scoreWith(realById)
  const effScores = scoreWith(effectiveById)

  // Ranking real (para comparar el "antes")
  const realRanking = Object.entries(realScores)
    .sort((a, b) => b[1] - a[1])
    .map(([id], i) => ({ id, rank: i + 1 }))
  const realRankById = {}
  realRanking.forEach(r => { realRankById[r.id] = r.rank })

  const rows = data.profiles.map(prof => ({
    id: prof.id,
    name: (prof.nickname || '').trim() || prof.display_name,
    avatar: (prof.avatar || '').trim() || '⚽',
    total: effScores[prof.id] || 0,
    real: realScores[prof.id] || 0,
  })).sort((a, b) => b.total - a.total)

  // Rank estilo golf + delta vs posición real
  rows.forEach((r, i) => {
    if (i > 0 && r.total === rows[i - 1].total) {
      r.rank = rows[i - 1].rank
      r.tied = true
      rows[i - 1].tied = true
    } else {
      r.rank = i + 1
      r.tied = false
    }
    const realRank = realRankById[r.id]
    r.delta = realRank ? realRank - r.rank : 0  // positivo = sube con la simulación
    r.gained = r.total - r.real                 // puntos ganados con la simulación
  })

  return rows
}
