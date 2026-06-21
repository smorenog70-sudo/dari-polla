import { computeTable } from './computeTable'

/**
 * Analiza qué RESULTADO de un partido en curso le conviene más al usuario.
 * Prueba una grilla de marcadores posibles (0-0 hasta 4-4) y, para cada uno,
 * calcula en qué posición quedaría el usuario en la tabla.
 *
 * Devuelve el mejor caso, el peor caso, y el rival directo (por quién hinchar).
 *
 * @param data - objeto de useLeagueData
 * @param matchId - el partido en curso a analizar
 * @param userId - el usuario
 * @param baseSims - otros marcadores ya simulados (Map), para no perderlos
 */
export function analyzeBestOutcome(data, matchId, userId, baseSims = new Map()) {
  // Posición actual (sin simular este partido)
  const baseTable = computeTable(data, baseSims)
  const baseRow = baseTable.find(r => r.id === userId)
  if (!baseRow) return null
  const baseRank = baseRow.rank

  // Probar una grilla de marcadores 0..5 por lado
  const scenarios = []
  for (let s1 = 0; s1 <= 5; s1++) {
    for (let s2 = 0; s2 <= 5; s2++) {
      const sims = new Map(baseSims)
      sims.set(matchId, { score1: s1, score2: s2 })
      const table = computeTable(data, sims)
      const myRow = table.find(r => r.id === userId)
      if (!myRow) continue
      // guardamos también los puntos del rival de arriba en este escenario
      scenarios.push({
        score: `${s1}-${s2}`, s1, s2,
        rank: myRow.rank,
        points: myRow.total,
        rankDelta: baseRank - myRow.rank,
        table, // reutilizable para el rival
      })
    }
  }
  if (scenarios.length === 0) return null

  const best = [...scenarios].sort((a, b) =>
    a.rank - b.rank || b.points - a.points
  )[0]
  const worst = [...scenarios].sort((a, b) =>
    b.rank - a.rank || a.points - b.points
  )[0]

  // Rival directo: el jugador justo encima de mí en la tabla base
  const above = baseTable.find(r => r.rank === baseRank - 1 && r.id !== userId)
  let rivalInfo = null
  if (above) {
    // Reutilizamos las tablas ya calculadas (sin recalcular)
    let bestForCatching = null, bestGap = -Infinity
    for (const sc of scenarios) {
      const me = sc.table.find(r => r.id === userId)
      const rival = sc.table.find(r => r.id === above.id)
      const gap = (me?.total || 0) - (rival?.total || 0)
      if (gap > bestGap) { bestGap = gap; bestForCatching = sc.score }
    }
    rivalInfo = { name: above.name, avatar: above.avatar, bestScore: bestForCatching }
  }

  // No devolvemos las tablas completas (pesadas) en best/worst
  const clean = ({ table, ...rest }) => rest
  return {
    baseRank,
    best: clean(best),
    worst: clean(worst),
    rival: rivalInfo,
    sameOutcome: best.score === worst.score,
  }
}
