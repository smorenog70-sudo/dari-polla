// Sistema de puntos (del Excel "Polla Mundialista 2026"):
//   - Ganador o empate ............. 5 pts
//   - Marcador exacto .............. 5 pts (aditivo al de ganador/empate)
//   - Goles del local .............. 2 pts
//   - Goles del visitante .......... 2 pts
//   - Diferencia de gol ............ 1 pt
//   - Posición final en grupo ...... 5 pts (por cada posición exacta acertada)
//   - Mejor tercero ................ 5 pts (por cada equipo que efectivamente clasifique como mejor tercero)

/**
 * Calcula puntos de un partido individual.
 * @param {{score1:number,score2:number}} pred
 * @param {{score1:number,score2:number}} actual
 * @returns {{total:number, breakdown:object}}
 */
export function scoreMatch(pred, actual) {
  if (!pred || !actual) return { total: 0, breakdown: {} }

  const breakdown = {
    outcome: 0,
    exact: 0,
    home: 0,
    away: 0,
    diff: 0,
    advances: 0,
  }

  // Ganador / empate
  const predOutcome = Math.sign(pred.score1 - pred.score2)
  const actualOutcome = Math.sign(actual.score1 - actual.score2)
  if (predOutcome === actualOutcome) breakdown.outcome = 5

  // Marcador exacto (aditivo)
  if (pred.score1 === actual.score1 && pred.score2 === actual.score2) {
    breakdown.exact = 5
  }

  // Goles local
  if (pred.score1 === actual.score1) breakdown.home = 2
  // Goles visitante
  if (pred.score2 === actual.score2) breakdown.away = 2
  // Diferencia de gol
  if (pred.score1 - pred.score2 === actual.score1 - actual.score2) {
    breakdown.diff = 1
  }

  // PLAYOFFS: +10 si acierta quién pasa.
  // Señal de que es playoff: el resultado real trae 'advances' definido
  // (en fase de grupos nunca se setea). El "quién pasa" del jugador se deriva
  // de su MARCADOR si hay ganador, o de su elección manual si predijo empate.
  // Así, quien predijo "Brasil 1-0" acierta el pase aunque no lo eligiera a mano.
  if (actual.advances) {
    const effectiveAdvances = (s1, s2, manual) => {
      const a = Number(s1), b = Number(s2)
      if (a > b) return 'team1'
      if (b > a) return 'team2'
      return manual ?? null // empate: la elección manual del jugador
    }
    const predAdv = effectiveAdvances(pred.score1, pred.score2, pred.advances)
    if (predAdv && predAdv === actual.advances) {
      breakdown.advances = 10
    }
  }

  const total =
    breakdown.outcome +
    breakdown.exact +
    breakdown.home +
    breakdown.away +
    breakdown.diff +
    breakdown.advances

  return { total, breakdown }
}

/**
 * Calcula puntos por aciertos de posición de grupo.
 * @param {Array<{group_letter,team,position}>} userGuesses
 * @param {Array<{group_letter,team,position}>} actualResults
 */
export function scoreGroupPositions(userGuesses, actualResults) {
  const actualMap = new Map()
  for (const r of actualResults) {
    actualMap.set(`${r.group_letter}|${r.team}`, r.position)
  }
  let total = 0
  let hits = 0
  for (const g of userGuesses) {
    const k = `${g.group_letter}|${g.team}`
    if (actualMap.has(k) && actualMap.get(k) === g.position) {
      total += 5
      hits += 1
    }
  }
  return { total, hits }
}

/**
 * Calcula puntos por aciertos de mejores terceros.
 * @param {Array<string>} userTeams (hasta 8 equipos sin orden)
 * @param {Array<string>} actualTeams
 */
export function scoreThirds(userTeams, actualTeams) {
  const actualSet = new Set(actualTeams)
  let hits = 0
  for (const t of userTeams) if (actualSet.has(t)) hits += 1
  return { total: hits * 5, hits }
}

/**
 * Suma total de un usuario en un rango de partidos.
 * @param {Map<string, {score1,score2}>} preds  (match_id -> pred)
 * @param {Map<string, {score1,score2}>} results
 * @param {Array<string>} matchIds
 */
export function totalMatchPoints(preds, results, matchIds) {
  let total = 0
  for (const id of matchIds) {
    const p = preds.get(id)
    const r = results.get(id)
    if (p && r) total += scoreMatch(p, r).total
  }
  return total
}
