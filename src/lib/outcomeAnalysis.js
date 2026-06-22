import { computeTable } from './computeTable'
import { matchById } from './matches'

/**
 * Analiza qué RESULTADO de un partido en curso le conviene más al usuario.
 * Prueba una grilla de marcadores posibles y, para cada uno, calcula en qué
 * posición quedaría el usuario en la tabla.
 *
 * En PLAYOFFS también considera quién pasa: si el marcador da empate, prueba
 * ambos equipos pasando (tiempo extra o penales); si hay ganador, ese pasa.
 *
 * Devuelve el mejor caso, el peor caso, y el rival directo (por quién hinchar).
 */
export function analyzeBestOutcome(data, matchId, userId, baseSims = new Map()) {
  const baseTable = computeTable(data, baseSims)
  const baseRow = baseTable.find(r => r.id === userId)
  if (!baseRow) return null
  const baseRank = baseRow.rank

  const match = matchById(matchId)
  const isKnockout = match && match.stage !== 'group'

  // Construir la lista de escenarios a probar
  const combos = []
  for (let s1 = 0; s1 <= 5; s1++) {
    for (let s2 = 0; s2 <= 5; s2++) {
      if (isKnockout && s1 === s2) {
        // Empate en playoff: probar quién pasa (ambos lados)
        combos.push({ s1, s2, advances: 'team1', adv: ` (pasa ${match.team1})` })
        combos.push({ s1, s2, advances: 'team2', adv: ` (pasa ${match.team2})` })
      } else {
        // Marcador con ganador: el que gana pasa (forzado). En grupo, sin advances.
        const advances = isKnockout ? (s1 > s2 ? 'team1' : 'team2') : null
        combos.push({ s1, s2, advances, adv: '' })
      }
    }
  }

  const scenarios = []
  for (const c of combos) {
    const sims = new Map(baseSims)
    sims.set(matchId, { score1: c.s1, score2: c.s2, advances: c.advances })
    const table = computeTable(data, sims)
    const myRow = table.find(r => r.id === userId)
    if (!myRow) continue
    scenarios.push({
      score: `${c.s1}-${c.s2}${c.adv}`, s1: c.s1, s2: c.s2,
      rank: myRow.rank,
      points: myRow.total,
      rankDelta: baseRank - myRow.rank,
      table,
    })
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
