import { matchById, TOURNAMENT } from './matches'
import { confederationOf } from './confederations'
import { matchProbabilities, modelPick } from './fifaModel'
import { venueInfo } from './venues'

/**
 * "Laboratorio de datos": análisis estadístico HONESTO sobre los partidos
 * jugados y las predicciones del grupo. Cada función reporta su tamaño de
 * muestra (n) para que la UI pueda mostrar el nivel de confianza real.
 *
 * Principio: con pocos datos, describimos; no inventamos precisión.
 */

// Nivel de confianza según tamaño de muestra. Honesto a propósito.
export function confidenceLevel(n) {
  if (n >= 60) return { level: 'alta', label: '🟢 Confianza alta', note: 'Muestra grande' }
  if (n >= 25) return { level: 'media', label: '🟡 Confianza media', note: 'Muestra moderada' }
  if (n >= 10) return { level: 'baja', label: '🟠 Confianza baja', note: 'Pocos datos: tómalo como tendencia' }
  return { level: 'muy-baja', label: '🔴 Solo indicativo', note: 'Muy pocos datos para concluir' }
}

// Resultado de un partido: 'team1' | 'team2' | 'draw'
function outcomeOf(s1, s2) {
  if (s1 > s2) return 'team1'
  if (s2 > s1) return 'team2'
  return 'draw'
}

// ============================================================
//  ÁREA 1 — ANÁLISIS DEL GRUPO
// ============================================================

/**
 * Sabiduría de la multitud: ¿el consenso del grupo predice mejor que el
 * jugador promedio? Compara el acierto del "voto mayoritario" contra el
 * promedio individual.
 */
export function wisdomOfCrowd(predictions, resultsById) {
  const byMatch = new Map() // matchId -> [{outcome}]
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, [])
    byMatch.get(p.match_id).push(outcomeOf(p.score1, p.score2))
  }

  let crowdHits = 0, matchesCounted = 0
  let individualHits = 0, individualTotal = 0

  for (const [mid, outcomes] of byMatch) {
    const r = resultsById.get(mid)
    const real = outcomeOf(r.score1, r.score2)
    // voto mayoritario
    const tally = { team1: 0, team2: 0, draw: 0 }
    for (const o of outcomes) tally[o]++
    const crowdPick = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
    if (crowdPick === real) crowdHits++
    matchesCounted++
    // aciertos individuales
    for (const o of outcomes) {
      individualTotal++
      if (o === real) individualHits++
    }
  }

  const crowdPct = matchesCounted ? Math.round((crowdHits / matchesCounted) * 100) : 0
  const indivPct = individualTotal ? Math.round((individualHits / individualTotal) * 100) : 0
  return {
    crowdPct, indivPct,
    matchesCounted,
    crowdWins: crowdPct > indivPct,
    n: matchesCounted,
    confidence: confidenceLevel(matchesCounted),
  }
}

/**
 * Calibración del grupo: cuando un % del grupo coincide en un resultado,
 * ¿con qué frecuencia ocurre? Agrupa por nivel de consenso (bins).
 * Es el análisis de calibración clásico.
 */
export function groupCalibration(predictions, resultsById) {
  const byMatch = new Map()
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, [])
    byMatch.get(p.match_id).push(outcomeOf(p.score1, p.score2))
  }

  // Para cada partido, el % que apostó al resultado mayoritario y si acertó
  const bins = [
    { min: 0.33, max: 0.5, label: '33-50%', hits: 0, total: 0 },
    { min: 0.5, max: 0.65, label: '50-65%', hits: 0, total: 0 },
    { min: 0.65, max: 0.8, label: '65-80%', hits: 0, total: 0 },
    { min: 0.8, max: 1.01, label: '80-100%', hits: 0, total: 0 },
  ]

  let n = 0
  for (const [mid, outcomes] of byMatch) {
    const r = resultsById.get(mid)
    const real = outcomeOf(r.score1, r.score2)
    const tally = { team1: 0, team2: 0, draw: 0 }
    for (const o of outcomes) tally[o]++
    const [topPick, topCount] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
    const conf = topCount / outcomes.length
    const bin = bins.find(b => conf >= b.min && conf < b.max)
    if (bin) {
      bin.total++
      if (topPick === real) bin.hits++
      n++
    }
  }

  return {
    bins: bins.filter(b => b.total > 0).map(b => ({
      label: b.label,
      expected: b.label,
      actual: b.total ? Math.round((b.hits / b.total) * 100) : 0,
      total: b.total,
    })),
    n,
    confidence: confidenceLevel(n),
  }
}

/**
 * Sesgos del grupo: ¿predicen más/menos empates de los que pasan?
 * ¿sobreestiman goles?
 */
export function groupBiases(predictions, resultsById) {
  let predDraws = 0, realDraws = 0, n = 0
  let predGoalsSum = 0, realGoalsSum = 0
  const seenMatches = new Set()

  for (const p of predictions) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    n++
    if (p.score1 === p.score2) predDraws++
    predGoalsSum += p.score1 + p.score2
    // empates y goles reales: contar una vez por partido
    if (!seenMatches.has(p.match_id)) {
      seenMatches.add(p.match_id)
      if (r.score1 === r.score2) realDraws++
      realGoalsSum += r.score1 + r.score2
    }
  }

  const matchesN = seenMatches.size
  return {
    predDrawPct: n ? Math.round((predDraws / n) * 100) : 0,
    realDrawPct: matchesN ? Math.round((realDraws / matchesN) * 100) : 0,
    predGoalsAvg: n ? Math.round((predGoalsSum / n) * 10) / 10 : 0,
    realGoalsAvg: matchesN ? Math.round((realGoalsSum / matchesN) * 10) / 10 : 0,
    n: matchesN,
    confidence: confidenceLevel(matchesN),
  }
}

/**
 * Partidos más difíciles y más fáciles: % del grupo que acertó el ganador.
 */
export function matchDifficulty(predictions, resultsById) {
  const byMatch = new Map()
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, { hits: 0, total: 0 })
    const r = resultsById.get(p.match_id)
    const real = outcomeOf(r.score1, r.score2)
    const m = byMatch.get(p.match_id)
    m.total++
    if (outcomeOf(p.score1, p.score2) === real) m.hits++
  }

  const rows = []
  for (const [mid, { hits, total }] of byMatch) {
    const match = matchById(mid)
    if (!match || total < 3) continue
    rows.push({
      matchId: mid,
      team1: match.team1, team2: match.team2,
      hitPct: Math.round((hits / total) * 100),
      total,
    })
  }
  rows.sort((a, b) => a.hitPct - b.hitPct)
  return {
    hardest: rows.slice(0, 3),
    easiest: rows.slice(-3).reverse(),
    n: rows.length,
  }
}

// ============================================================
//  ÁREA 2 — ANÁLISIS DE EQUIPOS
// ============================================================

/**
 * Predictibilidad por equipo: en los partidos de cada equipo, ¿qué % del
 * grupo acertó? Equipos "predecibles" vs "sorpresa".
 */
export function teamPredictability(predictions, resultsById) {
  const byTeam = new Map() // team -> { hits, total, matches:Set }
  for (const p of predictions) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    const match = matchById(p.match_id)
    if (!match) continue
    const real = outcomeOf(r.score1, r.score2)
    const correct = outcomeOf(p.score1, p.score2) === real
    for (const team of [match.team1, match.team2]) {
      if (!byTeam.has(team)) byTeam.set(team, { team, hits: 0, total: 0, matches: new Set() })
      const t = byTeam.get(team)
      t.total++
      t.matches.add(p.match_id)
      if (correct) t.hits++
    }
  }

  const rows = []
  for (const t of byTeam.values()) {
    if (t.matches.size < 1) continue
    rows.push({
      team: t.team,
      predictablePct: t.total ? Math.round((t.hits / t.total) * 100) : 0,
      matchesPlayed: t.matches.size,
      n: t.total,
    })
  }
  rows.sort((a, b) => b.predictablePct - a.predictablePct)
  return {
    mostPredictable: rows.slice(0, 5),
    mostSurprising: rows.slice(-5).reverse(),
    n: rows.length,
  }
}

/**
 * Rendimiento real por equipo: goles a favor, en contra, diferencia.
 * Puramente descriptivo.
 */
export function teamPerformance(resultsById) {
  const byTeam = new Map()
  for (const m of TOURNAMENT.matches) {
    if (m.stage !== 'group') continue
    const r = resultsById.get(m.id)
    if (!r) continue
    for (const [team, gf, ga] of [[m.team1, r.score1, r.score2], [m.team2, r.score2, r.score1]]) {
      if (!byTeam.has(team)) byTeam.set(team, { team, gf: 0, ga: 0, played: 0 })
      const t = byTeam.get(team)
      t.gf += gf; t.ga += ga; t.played++
    }
  }
  const rows = [...byTeam.values()].map(t => ({
    ...t, gd: t.gf - t.ga,
    avgGf: t.played ? Math.round((t.gf / t.played) * 10) / 10 : 0,
  }))
  rows.sort((a, b) => b.gd - a.gd)
  return { rows, n: rows.length }
}

/**
 * Análisis por sede (ground): goles promedio por estadio.
 * MUY pocos datos por sede — se marca como indicativo.
 */
export function venueAnalysis(resultsById) {
  const byVenue = new Map()
  for (const m of TOURNAMENT.matches) {
    const r = resultsById.get(m.id)
    if (!r || !m.ground) continue
    if (!byVenue.has(m.ground)) byVenue.set(m.ground, { venue: m.ground, goals: 0, played: 0, homeWins: 0 })
    const v = byVenue.get(m.ground)
    v.goals += r.score1 + r.score2
    v.played++
  }
  const rows = [...byVenue.values()]
    .map(v => ({ ...v, avgGoals: v.played ? Math.round((v.goals / v.played) * 10) / 10 : 0 }))
    .sort((a, b) => b.avgGoals - a.avgGoals)
  return { rows, n: rows.length }
}

// ============================================================
//  ÁREA 3 — PROBABILIDADES EMPÍRICAS
// ============================================================

/**
 * Probabilidad empírica de los PRÓXIMOS partidos según las predicciones
 * del grupo (los que ya cerraron/empezaron, para no filtrar secretos).
 * Esto SÍ es válido: es literalmente lo que el grupo cree.
 */
export function empiricalProbabilities(predictions, resultsById, onlyStarted) {
  const byMatch = new Map()
  for (const p of predictions) {
    const match = matchById(p.match_id)
    if (!match) continue
    // solo partidos sin resultado aún, pero ya visibles (empezados)
    if (resultsById.has(p.match_id)) continue
    if (onlyStarted && !onlyStarted(match)) continue
    if (!byMatch.has(p.match_id)) {
      byMatch.set(p.match_id, { match, team1: 0, team2: 0, draw: 0, scores: new Map() })
    }
    const e = byMatch.get(p.match_id)
    e[outcomeOf(p.score1, p.score2)]++
    const key = `${p.score1}-${p.score2}`
    e.scores.set(key, (e.scores.get(key) || 0) + 1)
  }

  const rows = []
  for (const e of byMatch.values()) {
    const total = e.team1 + e.team2 + e.draw
    if (total < 3) continue
    // marcador más popular
    let topScore = null, topN = 0
    for (const [k, n] of e.scores) if (n > topN) { topN = n; topScore = k }
    rows.push({
      matchId: e.match.id,
      team1: e.match.team1, team2: e.match.team2,
      kickoff: e.match.kickoff_utc,
      pTeam1: Math.round((e.team1 / total) * 100),
      pDraw: Math.round((e.draw / total) * 100),
      pTeam2: Math.round((e.team2 / total) * 100),
      topScore, topScorePct: Math.round((topN / total) * 100),
      total,
    })
  }
  rows.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
  return { rows, n: rows.length }
}

// ============================================================
//  CAMINO 2 — MODELO FIFA vs GRUPO vs REALIDAD
// ============================================================

/**
 * Para los partidos jugados, compara tres "predictores":
 *   - Modelo FIFA (basado en ranking, con base histórica grande)
 *   - El consenso del grupo (voto mayoritario)
 *   - El resultado real
 * Mide quién acierta más: ¿el modelo o la sabiduría del grupo?
 */
export function modelVsCrowd(predictions, resultsById) {
  const byMatch = new Map()
  for (const p of predictions) {
    if (!resultsById.has(p.match_id)) continue
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, [])
    byMatch.get(p.match_id).push(outcomeOf(p.score1, p.score2))
  }

  let modelHits = 0, crowdHits = 0, n = 0
  const detail = []
  for (const [mid, outcomes] of byMatch) {
    const match = matchById(mid)
    const r = resultsById.get(mid)
    if (!match) continue
    const real = outcomeOf(r.score1, r.score2)

    // pick del modelo
    const mPick = modelPick(match.team1, match.team2)
    // pick del grupo (mayoría)
    const tally = { team1: 0, team2: 0, draw: 0 }
    for (const o of outcomes) tally[o]++
    const cPick = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]

    const mHit = mPick === real
    const cHit = cPick === real
    if (mHit) modelHits++
    if (cHit) crowdHits++
    n++
    detail.push({
      matchId: mid, team1: match.team1, team2: match.team2,
      modelHit: mHit, crowdHit: cHit, real,
    })
  }

  return {
    n,
    modelPct: n ? Math.round((modelHits / n) * 100) : 0,
    crowdPct: n ? Math.round((crowdHits / n) * 100) : 0,
    modelHits, crowdHits,
    confidence: confidenceLevel(n),
  }
}

/**
 * Próximos partidos: probabilidad del MODELO FIFA + info de la sede.
 * Solo partidos ya cerrados (para no filtrar predicciones secretas).
 */
export function modelForecast(onlyStarted) {
  const rows = []
  for (const m of TOURNAMENT.matches) {
    if (m.stage !== 'group') continue
    if (m.team1?.match(/^[0-9WL]/) || m.team2?.match(/^[0-9WL]/)) continue
    if (onlyStarted && !onlyStarted(m)) continue
    const prob = matchProbabilities(m.team1, m.team2)
    const venue = venueInfo(m.ground)
    rows.push({
      matchId: m.id, team1: m.team1, team2: m.team2,
      kickoff: m.kickoff_utc, prob, venue, ground: m.ground,
    })
  }
  rows.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
  return { rows: rows.slice(0, 8), n: rows.length }
}
