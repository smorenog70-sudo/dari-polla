import { matchById } from './matches'

/**
 * Estadísticas avanzadas para "Mi progreso".
 * Todas son funciones puras que reciben los rows ya calculados
 * (de playedMatches) y/o el contexto del grupo.
 */

// #1 — Posición en el tiempo: ranking del jugador tras cada partido jugado.
// Devuelve [{ idx, rank, total }] a lo largo de los partidos con resultado.
export function positionOverTime(viewedUserId, allRowsByUser, playedMatchIds) {
  const series = []
  playedMatchIds.forEach((mid, idx) => {
    // puntos acumulados de cada usuario hasta este partido (inclusive)
    const totals = []
    for (const [uid, urows] of allRowsByUser) {
      const ptsByMatch = new Map(urows.map(r => [r.match.id, r.points]))
      let cum = 0
      for (let i = 0; i <= idx; i++) cum += ptsByMatch.get(playedMatchIds[i]) || 0
      totals.push({ uid, cum })
    }
    totals.sort((a, b) => b.cum - a.cum)
    const myRank = totals.findIndex(t => t.uid === viewedUserId) + 1
    const mine = totals.find(t => t.uid === viewedUserId)
    series.push({ idx: idx + 1, rank: myRank, total: mine ? mine.cum : 0 })
  })
  return series
}

// #2 — Mejor y peor DÍA (no fecha): agrupa los partidos jugados por día natural.
export function bestWorstDay(rows) {
  const byDay = new Map() // dayKey -> { dayKey, date, points, played }
  for (const r of rows) {
    if (!r.kickoff) continue
    const dayKey = new Date(r.kickoff).toLocaleDateString('en-CA')
    if (!byDay.has(dayKey)) byDay.set(dayKey, { dayKey, date: new Date(r.kickoff), points: 0, played: 0 })
    const d = byDay.get(dayKey)
    d.points += r.points
    d.played++
  }
  const days = [...byDay.values()].sort((a, b) => a.date - b.date)
  if (days.length === 0) return null
  let best = days[0], worst = days[0]
  for (const d of days) {
    if (d.points > best.points) best = d
    if (d.points < worst.points) worst = d
  }
  const fmt = (d) => d.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
  return {
    best: { label: fmt(best), points: best.points, played: best.played },
    worst: { label: fmt(worst), points: worst.points, played: worst.played },
    sameDay: best.dayKey === worst.dayKey,
  }
}

// #3 — Tasa de acierto: % de ganador y % de marcador exacto.
export function hitRates(rows) {
  const played = rows.length
  if (played === 0) return { played: 0, outcomePct: 0, exactPct: 0, outcomes: 0, exacts: 0 }
  const outcomes = rows.filter(r => r.hitOutcome).length
  const exacts = rows.filter(r => r.exact).length
  return {
    played,
    outcomes, exacts,
    outcomePct: Math.round((outcomes / played) * 100),
    exactPct: Math.round((exacts / played) * 100),
  }
}

// #4 — Marcador favorito: la predicción más repetida.
export function favoriteScore(myPreds) {
  const counts = new Map()
  for (const p of myPreds) {
    const key = `${p.score1}-${p.score2}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  let top = null, topN = 0
  for (const [key, n] of counts) {
    if (n > topN) { topN = n; top = key }
  }
  return top ? { score: top, count: topN } : null
}

// #5 — Favoritos vs underdogs: ¿aciertas más con el equipo "grande" o arriesgando?
// Heurística sin odds: el favorito es el equipo con más predicciones de victoria
// en todo el grupo (sabiduría de la multitud). Mide tu acierto cuando vas con
// el favorito de la multitud vs cuando vas contra él.
export function favoriteVsUnderdog(myPreds, resultsById, allPreds) {
  // Para cada partido, cuántos predijeron gana1 / gana2 (consenso del grupo)
  const consensus = new Map() // matchId -> 'team1' | 'team2' | 'draw'
  const tally = new Map()
  for (const p of allPreds) {
    if (!tally.has(p.match_id)) tally.set(p.match_id, { t1: 0, t2: 0, draw: 0 })
    const t = tally.get(p.match_id)
    if (p.score1 > p.score2) t.t1++
    else if (p.score2 > p.score1) t.t2++
    else t.draw++
  }
  for (const [mid, t] of tally) {
    const max = Math.max(t.t1, t.t2, t.draw)
    consensus.set(mid, max === t.t1 ? 'team1' : max === t.t2 ? 'team2' : 'draw')
  }

  let withFav = 0, withFavHit = 0, against = 0, againstHit = 0
  for (const p of myPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    const cons = consensus.get(p.match_id)
    if (!cons) continue
    const myPick = p.score1 > p.score2 ? 'team1' : p.score2 > p.score1 ? 'team2' : 'draw'
    const realOutcome = r.score1 > r.score2 ? 'team1' : r.score2 > r.score1 ? 'team2' : 'draw'
    const hit = myPick === realOutcome
    if (myPick === cons) { withFav++; if (hit) withFavHit++ }
    else { against++; if (hit) againstHit++ }
  }
  return {
    withFav, withFavHit,
    against, againstHit,
    withFavPct: withFav ? Math.round((withFavHit / withFav) * 100) : null,
    againstPct: against ? Math.round((againstHit / against) * 100) : null,
  }
}

// #6 — Sesgo de empates: cuántos empates predices vs cuántos pasan de verdad.
export function drawBias(myPreds, resultsById) {
  let predDraws = 0, realDraws = 0, played = 0
  for (const p of myPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    played++
    if (p.score1 === p.score2) predDraws++
    if (r.score1 === r.score2) realDraws++
  }
  if (played === 0) return null
  return {
    played,
    predDraws, realDraws,
    predPct: Math.round((predDraws / played) * 100),
    realPct: Math.round((realDraws / played) * 100),
  }
}

// #7 — Némesis y talismán.
// Talismán: el equipo que más puntos te ha dado (cuando aparece en tus predicciones acertadas).
// Némesis: el equipo que más veces te ha hecho fallar (aparece y no acertaste).
export function nemesisAndCharm(rows) {
  const byTeam = new Map() // team -> { points, hits, misses }
  for (const r of rows) {
    for (const team of [r.match.team1, r.match.team2]) {
      if (!byTeam.has(team)) byTeam.set(team, { team, points: 0, hits: 0, misses: 0 })
      const t = byTeam.get(team)
      t.points += r.points
      if (r.hitOutcome) t.hits++
      else t.misses++
    }
  }
  const teams = [...byTeam.values()]
  if (teams.length === 0) return null
  const charm = [...teams].sort((a, b) => b.points - a.points || b.hits - a.hits)[0]
  const nemesis = [...teams].sort((a, b) => b.misses - a.misses || a.points - b.points)[0]
  return {
    charm: charm && charm.points > 0 ? charm : null,
    nemesis: nemesis && nemesis.misses > 0 ? nemesis : null,
  }
}

// #8 — Cuánto te falta para subir / quién te persigue.
export function gapToClimb(viewedUserId, totalsByUser) {
  const idx = totalsByUser.findIndex(t => t.uid === viewedUserId)
  if (idx === -1) return null
  const me = totalsByUser[idx]
  const above = idx > 0 ? totalsByUser[idx - 1] : null
  const below = idx < totalsByUser.length - 1 ? totalsByUser[idx + 1] : null
  return {
    rank: idx + 1,
    toClimb: above ? above.pts - me.pts : null,   // puntos para alcanzar al de arriba
    chasedBy: below ? me.pts - below.pts : null,   // ventaja sobre el de abajo
  }
}

// #9 — Percentil dentro del grupo.
export function groupPercentile(viewedUserId, totalsByUser) {
  const n = totalsByUser.length
  if (n <= 1) return null
  const idx = totalsByUser.findIndex(t => t.uid === viewedUserId)
  if (idx === -1) return null
  // % de jugadores que están por debajo de mí
  const below = n - 1 - idx
  return Math.round((below / (n - 1)) * 100)
}

// #10 — Ritmo y proyección al final del torneo.
export function projection(rows, totalMatchesInTournament) {
  const played = rows.length
  if (played === 0) return null
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const perMatch = totalPoints / played
  const projected = Math.round(perMatch * totalMatchesInTournament)
  return {
    perMatch: Math.round(perMatch * 10) / 10,
    projected,
    played,
    totalMatches: totalMatchesInTournament,
  }
}

// #11 — Puntos posibles vs ganados.
// El máximo por partido acertado perfecto es 15 (5 resultado + 5 exacto + 2 local + 2 visitante + 1 dif).
// "Posibles" = partidos que jugaste × 15. "Ganados" = lo que sacaste.
// Mide cuánto aprovechaste del techo teórico.
export function pointsEfficiency(rows) {
  const MAX_PER_MATCH = 15
  const played = rows.length
  if (played === 0) return null
  const possible = played * MAX_PER_MATCH
  const earned = rows.reduce((s, r) => s + r.points, 0)
  return {
    earned,
    possible,
    pct: Math.round((earned / possible) * 100),
    played,
    perfectMatches: rows.filter(r => r.points === MAX_PER_MATCH).length,
    leftOnTable: possible - earned,
  }
}

// #12 — Cómo apuestan los TOP 3 (agregado, sin nombres).
// Compara el estilo de los 3 primeros vs el resto del grupo.
// Recibe rowsByUser (Map uid -> rows) y el orden de la tabla (array de uids).
export function winnersStyle(rowsByUser, rankedUids) {
  if (rankedUids.length < 4) return null
  const top3 = new Set(rankedUids.slice(0, 3))

  const profileFor = (uids) => {
    let totalPreds = 0, exacts = 0, draws = 0, goalsSum = 0, bigScores = 0
    for (const uid of uids) {
      const rows = rowsByUser.get(uid) || []
      for (const r of rows) {
        totalPreds++
        if (r.exact) exacts++
        if (r.pred.score1 === r.pred.score2) draws++
        const g = r.pred.score1 + r.pred.score2
        goalsSum += g
        if (g >= 4) bigScores++
      }
    }
    if (totalPreds === 0) return null
    return {
      exactPct: Math.round((exacts / totalPreds) * 100),
      drawPct: Math.round((draws / totalPreds) * 100),
      avgGoals: Math.round((goalsSum / totalPreds) * 10) / 10,
      bigScorePct: Math.round((bigScores / totalPreds) * 100),
    }
  }

  const topProfile = profileFor([...top3])
  const restProfile = profileFor(rankedUids.slice(3))
  if (!topProfile || !restProfile) return null

  return { top: topProfile, rest: restProfile }
}
