import { TOURNAMENT } from './matches'

/**
 * Estado en vivo de un partido según la hora de pitazo y "ahora".
 * Devuelve null si aún no empieza; o { phase, label, live }.
 * Replica la lógica usada en el Home (un solo lugar de verdad).
 */
export function liveStatus(kickoffUtc, now) {
  const ko = new Date(kickoffUtc).getTime()
  const KICKOFF_DELAY = 2 // los partidos arrancan ~2 min tarde
  const elapsedMin = (now - ko) / 60000 - KICKOFF_DELAY
  if (elapsedMin < 0) {
    if ((now - ko) / 60000 >= 0) return { phase: 'PRE', label: 'Por comenzar', live: true }
    return null
  }
  const FIRST_END = 45 + 7
  const HALFTIME_END = FIRST_END + 15
  const SECOND_END = HALFTIME_END + 45 + 7
  if (elapsedMin <= FIRST_END) {
    const m = Math.floor(elapsedMin)
    return { phase: '1T', label: m > 45 ? `45+${m - 45}'` : `${m}'`, live: true }
  }
  if (elapsedMin <= HALFTIME_END) {
    return { phase: 'HT', label: 'Descanso', live: true }
  }
  if (elapsedMin <= SECOND_END) {
    const since = elapsedMin - HALFTIME_END
    const m = Math.floor(45 + since)
    return { phase: '2T', label: m > 90 ? `90+${m - 90}'` : `${m}'`, live: true }
  }
  return { phase: 'FT', label: 'Finalizando', live: false }
}

/**
 * ¿Hay al menos un partido en vivo ahora? Devuelve la cantidad.
 * Solo cuenta partidos con equipos definidos (no placeholders).
 */
export function liveMatchCount(now, resultsById = new Map()) {
  let count = 0
  for (const m of TOURNAMENT.matches) {
    if (!m.kickoff_utc) continue
    if (m.team1?.match(/^[0-9WL]/) || m.team2?.match(/^[0-9WL]/)) continue
    const st = liveStatus(m.kickoff_utc, now)
    // En vivo = arrancó y no tiene resultado oficial cargado
    if (st && st.live && !resultsById.has(m.id)) count++
  }
  return count
}
