import { scoreMatch } from './scoring'
import { matchById } from './matches'

/**
 * ============================================================================
 *  ANALÍTICA — historias que cuentan los datos de predicciones vs realidad
 * ============================================================================
 * Todo se calcula en el cliente a partir de predicciones + resultados.
 * Nada toca la base de datos.
 */

// --- helpers internos ---
function outcomeOf(s1, s2) {
  if (s1 > s2) return 'L'   // local
  if (s1 < s2) return 'V'   // visitante
  return 'E'                // empate
}

// =====================================================================
//  NIVEL GRUPO
// =====================================================================

/**
 * Sesgo de goles del grupo: ¿predicen más o menos goles que la realidad?
 * Compara el promedio de goles predichos vs los reales, solo en partidos jugados.
 */
export function groupGoalBias(predictions, resultsById) {
  let predGoals = 0, realGoals = 0, count = 0
  // promedio de goles reales (una vez por partido jugado)
  const realByMatch = new Map()
  for (const [id, r] of resultsById) {
    realByMatch.set(id, r.score1 + r.score2)
  }
  // promedio de goles predichos (todas las predicciones de partidos jugados)
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    predGoals += (p.score1 + p.score2)
    count++
  }
  for (const [, g] of realByMatch) realGoals += g
  const matchesPlayed = realByMatch.size
  return {
    predAvg: count > 0 ? predGoals / count : 0,
    realAvg: matchesPlayed > 0 ? realGoals / matchesPlayed : 0,
    matchesPlayed,
    predictionsCount: count,
  }
}

/**
 * Partidos donde el grupo acertó más y menos (% de acierto de resultado).
 * Devuelve { easiest: [...], trickiest: [...] }
 */
export function matchDifficulty(predictions, resultsById) {
  const byMatch = new Map() // matchId -> {hits, total}
  for (const p of predictions) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, { hits: 0, total: 0 })
    const agg = byMatch.get(p.match_id)
    agg.total++
    if (outcomeOf(p.score1, p.score2) === outcomeOf(r.score1, r.score2)) agg.hits++
  }
  const rows = []
  for (const [matchId, agg] of byMatch) {
    const m = matchById(matchId)
    if (!m || agg.total < 3) continue // mínimo 3 predicciones para que sea significativo
    const r = resultsById.get(matchId)
    rows.push({
      matchId,
      label: `${m.team1} ${r.score1}-${r.score2} ${m.team2}`,
      team1: m.team1, team2: m.team2,
      score: `${r.score1}-${r.score2}`,
      hitRate: agg.hits / agg.total,
      hits: agg.hits,
      total: agg.total,
    })
  }
  rows.sort((a, b) => b.hitRate - a.hitRate)
  return {
    easiest: rows.slice(0, 3),
    trickiest: rows.slice(-3).reverse(),
    allCount: rows.length,
  }
}

/**
 * Equipos sobre/infravalorados: comparar cuántas veces el grupo predijo que
 * un equipo ganaba vs cuántas realmente ganó (en partidos jugados).
 */
export function teamReality(predictions, resultsById) {
  // Para cada partido jugado: a qué equipo le apostó la mayoría y quién ganó
  const teamStats = new Map() // team -> { predictedWins, actualWins, appearances }

  const bump = (team, field) => {
    if (!teamStats.has(team)) teamStats.set(team, { predictedWins: 0, actualWins: 0, appearances: 0 })
    teamStats.get(team)[field]++
  }

  // agrupar predicciones por partido
  const byMatch = new Map()
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, [])
    byMatch.get(p.match_id).push(p)
  }

  for (const [matchId, preds] of byMatch) {
    const m = matchById(matchId)
    const r = resultsById.get(matchId)
    if (!m || !r) continue
    if (m.team1?.match(/^[0-9WL]/) || m.team2?.match(/^[0-9WL]/)) continue // saltar placeholders

    bump(m.team1, 'appearances')
    bump(m.team2, 'appearances')

    // ¿a quién le apostó la mayoría?
    let votesT1 = 0, votesT2 = 0
    for (const p of preds) {
      const o = outcomeOf(p.score1, p.score2)
      if (o === 'L') votesT1++
      else if (o === 'V') votesT2++
    }
    if (votesT1 > votesT2) bump(m.team1, 'predictedWins')
    else if (votesT2 > votesT1) bump(m.team2, 'predictedWins')

    // ¿quién ganó de verdad?
    const ro = outcomeOf(r.score1, r.score2)
    if (ro === 'L') bump(m.team1, 'actualWins')
    else if (ro === 'V') bump(m.team2, 'actualWins')
  }

  const rows = []
  for (const [team, s] of teamStats) {
    if (s.appearances < 1) continue
    rows.push({
      team,
      predictedWins: s.predictedWins,
      actualWins: s.actualWins,
      gap: s.actualWins - s.predictedWins, // negativo = sobrevalorado (les creyeron de más)
    })
  }
  const overrated = [...rows].filter(r => r.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 4)
  const underrated = [...rows].filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 4)
  return { overrated, underrated }
}

/**
 * Distribución de tipos de resultado predichos por el grupo vs reales.
 * ¿El grupo predice demasiados empates? ¿Pocas goleadas?
 */
export function outcomeDistribution(predictions, resultsById) {
  const pred = { L: 0, E: 0, V: 0 }
  const real = { L: 0, E: 0, V: 0 }
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    pred[outcomeOf(p.score1, p.score2)]++
  }
  for (const [, r] of resultsById) {
    real[outcomeOf(r.score1, r.score2)]++
  }
  const predTotal = pred.L + pred.E + pred.V || 1
  const realTotal = real.L + real.E + real.V || 1
  return {
    pred: { L: pred.L / predTotal, E: pred.E / predTotal, V: pred.V / predTotal },
    real: { L: real.L / realTotal, E: real.E / realTotal, V: real.V / realTotal },
    predCounts: pred,
    realCounts: real,
  }
}

// =====================================================================
//  NIVEL PERSONAL
// =====================================================================

/**
 * Perfil del apostador: ¿arriesga o juega seguro?
 * Analiza la diferencia de goles que suele predecir y su tasa de empates.
 */
export function bettingProfile(userPreds, resultsById) {
  if (userPreds.length === 0) return null
  let totalDiff = 0, draws = 0, bigScores = 0, exactByGoals = 0
  let highScoring = 0 // predicciones con 4+ goles totales
  for (const p of userPreds) {
    const diff = Math.abs(p.score1 - p.score2)
    totalDiff += diff
    if (p.score1 === p.score2) draws++
    if (diff >= 3) bigScores++
    if (p.score1 + p.score2 >= 4) highScoring++
  }
  const n = userPreds.length
  const avgDiff = totalDiff / n
  const drawRate = draws / n
  const goalsAvg = userPreds.reduce((s, p) => s + p.score1 + p.score2, 0) / n

  // Determinar "arquetipo"
  let archetype, emoji, desc
  if (drawRate > 0.3) {
    archetype = 'El Diplomático'; emoji = '🤝'
    desc = 'Predices muchos empates. Evitas el riesgo de elegir un ganador.'
  } else if (avgDiff >= 1.8 || bigScores / n > 0.25) {
    archetype = 'El Arriesgado'; emoji = '🎲'
    desc = 'Te la juegas con goleadas y marcadores amplios.'
  } else if (goalsAvg >= 3) {
    archetype = 'El Goleador'; emoji = '⚽'
    desc = 'Ves goles por todos lados. Predices partidos abiertos.'
  } else if (avgDiff < 1.2) {
    archetype = 'El Cauteloso'; emoji = '🛡️'
    desc = 'Juegas seguro: marcadores cerrados, victorias por la mínima.'
  } else {
    archetype = 'El Equilibrado'; emoji = '⚖️'
    desc = 'Mezclas riesgo y prudencia sin casarte con un estilo.'
  }

  return {
    archetype, emoji, desc,
    avgDiff, drawRate, goalsAvg,
    bigScoreRate: bigScores / n,
    n,
  }
}

/**
 * De dónde saca sus puntos el usuario (desglose acumulado por tipo).
 */
export function pointsBreakdown(userPreds, resultsById) {
  const acc = { outcome: 0, exact: 0, home: 0, away: 0, diff: 0 }
  let total = 0
  for (const p of userPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    const s = scoreMatch(p, r)
    acc.outcome += s.breakdown.outcome
    acc.exact += s.breakdown.exact
    acc.home += s.breakdown.home
    acc.away += s.breakdown.away
    acc.diff += s.breakdown.diff
    total += s.total
  }
  return { acc, total }
}

/**
 * Eficiencia del usuario vs el grupo: puntos por partido jugado.
 */
export function efficiencyVsGroup(userId, predictions, resultsById) {
  const byUser = new Map()
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, { pts: 0, n: 0 })
    const r = resultsById.get(p.match_id)
    const s = scoreMatch(p, r)
    const agg = byUser.get(p.user_id)
    agg.pts += s.total
    agg.n++
  }
  const mine = byUser.get(userId)
  const myPpm = mine && mine.n > 0 ? mine.pts / mine.n : 0
  let groupSum = 0, groupCount = 0
  const allPpm = []
  for (const [, agg] of byUser) {
    if (agg.n > 0) {
      const ppm = agg.pts / agg.n
      allPpm.push(ppm)
      groupSum += ppm
      groupCount++
    }
  }
  const groupAvg = groupCount > 0 ? groupSum / groupCount : 0
  // percentil del usuario
  allPpm.sort((a, b) => a - b)
  const below = allPpm.filter(v => v < myPpm).length
  const percentile = allPpm.length > 0 ? Math.round((below / allPpm.length) * 100) : 0
  return { myPpm, groupAvg, percentile, playersCount: groupCount }
}

/**
 * Mejor y peor partido del usuario (por puntos sacados).
 */
export function bestAndWorst(userPreds, resultsById) {
  let best = null, worst = null
  for (const p of userPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    const m = matchById(p.match_id)
    if (!m) continue
    const s = scoreMatch(p, r)
    const entry = {
      label: `${m.team1} ${r.score1}-${r.score2} ${m.team2}`,
      predicted: `${p.score1}-${p.score2}`,
      points: s.total,
    }
    if (!best || s.total > best.points) best = entry
    if (!worst || s.total < worst.points) worst = entry
  }
  return { best, worst }
}

/**
 * Sesgo de goles personal: ¿predice más o menos goles que la realidad?
 */
export function personalGoalBias(userPreds, resultsById) {
  let predGoals = 0, realGoals = 0, n = 0
  for (const p of userPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    predGoals += p.score1 + p.score2
    realGoals += r.score1 + r.score2
    n++
  }
  return {
    predAvg: n > 0 ? predGoals / n : 0,
    realAvg: n > 0 ? realGoals / n : 0,
    n,
  }
}
