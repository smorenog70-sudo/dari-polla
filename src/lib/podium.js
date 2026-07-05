import { TOURNAMENT, matchById, hasMatchStarted } from './matches'
import { buildResolver } from './bracketTeams'
import { scorePodium, PODIUM_KEYS } from './scoring'

export { PODIUM_KEYS }

// Etiquetas humanas de cada puesto del podio.
export const PODIUM_LABELS = {
  champion: 'Campeón',
  runner_up: 'Subcampeón',
  third_place: '3er puesto',
  fourth_place: '4to puesto',
}

// ¿El texto sigue siendo un placeholder de bracket (1A, W73, L101...) y no un
// equipo real? Sirve para no ofrecer placeholders como opciones del podio.
function isPlaceholder(name) {
  return !name || /^[0-9WL]/.test(name)
}

/**
 * Los 16 equipos que llegaron a octavos (r16), resueltos a nombres reales.
 * Solo incluye los que el bracket ya resolvió (una vez terminan los dieciseisavos).
 */
export function octavosTeams(data) {
  const { resolveOne } = buildResolver(data)
  const seen = new Set()
  const teams = []
  for (const m of TOURNAMENT.matches) {
    if (m.stage !== 'r16') continue
    for (const raw of [m.team1_raw || m.team1, m.team2_raw || m.team2]) {
      const t = resolveOne(raw)
      if (isPlaceholder(t) || seen.has(t)) continue
      seen.add(t)
      teams.push(t)
    }
  }
  return teams.sort((a, b) => a.localeCompare(b, 'es'))
}

// Ganador/perdedor real de un cruce, resuelto a equipos reales. Usa 'advances'
// si está (el partido pudo decidirse por penales); si no, el marcador a 90'.
function winnerLoser(match, res, resolveMatch) {
  if (!match || !res) return null
  const rm = resolveMatch(match)
  if (isPlaceholder(rm.team1) || isPlaceholder(rm.team2)) return null
  let side
  if (res.advances === 'team1' || res.advances === 'team2') side = res.advances
  else if (res.score1 > res.score2) side = 'team1'
  else if (res.score2 > res.score1) side = 'team2'
  else return null // empate sin 'advances' → indefinido
  return side === 'team1'
    ? { win: rm.team1, lose: rm.team2 }
    : { win: rm.team2, lose: rm.team1 }
}

/**
 * El podio real derivado de los resultados: campeón/subcampeón salen de la final,
 * 3ro/4to del partido por el tercer puesto. Cada puesto es null si aún no se sabe.
 */
export function actualPodium(data) {
  const { resolveMatch } = buildResolver(data)
  const resultsById = new Map((data?.results || []).map(r => [r.match_id, r]))
  const out = { champion: null, runner_up: null, third_place: null, fourth_place: null }

  const finalM = TOURNAMENT.matches.find(m => m.stage === 'final')
  const thirdM = TOURNAMENT.matches.find(m => m.stage === 'third')

  if (finalM) {
    const wl = winnerLoser(finalM, resultsById.get(finalM.id), resolveMatch)
    if (wl) { out.champion = wl.win; out.runner_up = wl.lose }
  }
  if (thirdM) {
    const wl = winnerLoser(thirdM, resultsById.get(thirdM.id), resolveMatch)
    if (wl) { out.third_place = wl.win; out.fourth_place = wl.lose }
  }
  return out
}

/**
 * ¿Ya cerró la predicción del podio? Por defecto cierra al arrancar el primer
 * partido de octavos. El admin puede reabrirla con config.podium_open = true
 * (p. ej. para quien no alcanzó a ponerla).
 */
export function podiumLocked(config = {}, now = new Date()) {
  if (config?.podium_open === true) return false  // reabierto manualmente por el admin
  const r16 = TOURNAMENT.matches.filter(m => m.stage === 'r16')
  if (r16.length === 0) return false
  return r16.some(m => hasMatchStarted(m, now))
}

/** Fecha/hora en que cierra la predicción del podio (primer pitazo de octavos). */
export function podiumCloseAt() {
  const r16 = TOURNAMENT.matches
    .filter(m => m.stage === 'r16' && m.kickoff_utc)
    .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))
  return r16[0]?.kickoff_utc || null
}

/**
 * Bono de podio de un usuario. `pred` es su fila de podium_predictions.
 * Si ya calculaste el podio real, pásalo para no recomputarlo por usuario.
 */
export function podiumBonusFor(pred, data, actual = null) {
  if (!pred) return 0
  return scorePodium(pred, actual || actualPodium(data)).total
}
