// Sistema de puntos (del Excel "Polla Mundialista 2026"):
//   - Ganador o empate ............. 5 pts
//   - Marcador exacto .............. 5 pts (aditivo al de ganador/empate)
//   - Goles del local .............. 2 pts
//   - Goles del visitante .......... 2 pts
//   - Diferencia de gol ............ 1 pt
//   - Posición final en grupo ...... 5 pts (por cada posición exacta acertada)
//   - Mejor tercero ................ 5 pts (por cada equipo que efectivamente clasifique como mejor tercero)
//   - ¿Quién clasifica? ............ bono escalonado por ronda (ver ADVANCE_BONUS)
//   - Podio final .................. bono aparte por acertar puestos (ver PODIUM_POINTS)

import { matchById } from './matches'

// Bono por acertar "quién gana / clasifica" en cada cruce de eliminación,
// escalonado por ronda. Los dieciseisavos (r32) se quedan en 10 porque ya se
// están jugando (cambiarlo a mitad del torneo sería injusto); el escalonado
// nuevo aplica de octavos en adelante. En el partido por el 3er puesto acertar
// al ganador vale 30.
export const ADVANCE_BONUS = { r32: 10, r16: 15, qf: 20, sf: 30, third: 30, final: 50 }

// Bono de podio: puntos por acertar cada puesto EXACTO del podio final.
export const PODIUM_POINTS = { champion: 30, runner_up: 20, third_place: 15, fourth_place: 10 }
export const PODIUM_KEYS = ['champion', 'runner_up', 'third_place', 'fourth_place']

/**
 * Calcula puntos de un partido individual.
 * @param {{score1:number,score2:number}} pred
 * @param {{score1:number,score2:number}} actual
 * @param {string} [stage] ronda del partido ('r16','qf'...). Si no se pasa, se
 *   resuelve con matchById(match_id). Sirve para calibrar el bono de "clasifica".
 * @returns {{total:number, breakdown:object}}
 */
export function scoreMatch(pred, actual, stage) {
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

  // PLAYOFFS: bono escalonado por ronda si acierta quién clasifica.
  // El "quién pasa" del jugador es SIEMPRE su elección manual en el selector
  // (independiente del marcador que haya predicho). Así, alguien puede predecir
  // "Brasil 2-0" pero elegir a Japón como quien pasa, por si el partido real
  // termina distinto a como lo imaginó en el marcador.
  // Señal de que es playoff: el resultado real trae 'advances' definido
  // (en fase de grupos nunca se setea). El bono depende de la ronda: r32=10,
  // r16=15, qf=20, sf=30, 3er puesto=30, final=50.
  if (actual.advances && pred.advances && pred.advances === actual.advances) {
    const st = stage || matchById(actual.match_id ?? pred.match_id)?.stage
    breakdown.advances = ADVANCE_BONUS[st] ?? 10
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
 * Calcula el bono de podio: puntos por acertar cada puesto EXACTO.
 * Solo cuenta la posición exacta: si pusiste a X de campeón y quedó subcampeón,
 * NO se da el bono de subcampeón.
 * @param {{champion,runner_up,third_place,fourth_place}} pred  equipos elegidos
 * @param {{champion,runner_up,third_place,fourth_place}} actual equipos reales
 * @returns {{total:number, breakdown:object, hits:number}}
 */
export function scorePodium(pred, actual) {
  const breakdown = { champion: 0, runner_up: 0, third_place: 0, fourth_place: 0 }
  if (!pred || !actual) return { total: 0, breakdown, hits: 0 }
  let hits = 0
  for (const key of PODIUM_KEYS) {
    if (pred[key] && actual[key] && pred[key] === actual[key]) {
      breakdown[key] = PODIUM_POINTS[key]
      hits += 1
    }
  }
  const total = breakdown.champion + breakdown.runner_up + breakdown.third_place + breakdown.fourth_place
  return { total, breakdown, hits }
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
    if (p && r) total += scoreMatch(p, r, matchById(id)?.stage).total
  }
  return total
}
