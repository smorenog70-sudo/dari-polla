import { TOURNAMENT } from './matches'

/**
 * Calcula el avance del Mundial y de los puntos "en juego" de la polla.
 *
 * Puntos POSIBLES por jugador (el máximo que alguien podría sacar):
 *  - Marcadores: 104 partidos × 15 pts (5 ganador + 5 exacto + 2 local + 2 visita + 1 dif) = 1560
 *  - Playoffs "quién pasa": 32 partidos de eliminación × 10 = 320
 *  - Posiciones de grupo: 12 grupos × 4 posiciones × 5 = 240
 *  - Mejores terceros: 8 × 5 = 40
 * Total teórico por jugador: 2160 pts
 *
 * "Jugado" = lo que ya se resolvió (partidos con resultado, grupos cerrados, terceros definidos).
 * "Por jugar" = lo que falta.
 */

const PTS_MATCH = 15          // máximo del marcador por partido
const PTS_ADVANCES = 10       // "quién pasa" en playoffs
const PTS_GROUP_POS = 5       // cada posición de grupo acertada
const PTS_THIRD = 5           // cada tercero acertado
const N_GROUP_POSITIONS = 12 * 4  // 48 posiciones (12 grupos × 4)
const N_THIRDS = 8

export function worldCupProgress(data) {
  const matches = TOURNAMENT.matches
  const resultsById = new Map((data.results || []).map(r => [r.match_id, r]))

  // ---- Partidos ----
  const totalMatches = matches.length
  const playedMatches = matches.filter(m => resultsById.has(m.id)).length
  const remainingMatches = totalMatches - playedMatches

  // ---- Días ----
  const dayKeys = [...new Set(
    matches.filter(m => m.kickoff_utc).map(m => new Date(m.kickoff_utc).toLocaleDateString('en-CA'))
  )].sort()
  const todayKey = new Date().toLocaleDateString('en-CA')
  const daysPassed = dayKeys.filter(d => d < todayKey).length
  const daysWithMatchesTotal = dayKeys.length
  const daysRemaining = dayKeys.filter(d => d >= todayKey).length

  // ---- Puntos en juego (máximo por jugador) ----
  // Marcadores
  const matchPtsPlayed = playedMatches * PTS_MATCH
  const matchPtsTotal = totalMatches * PTS_MATCH

  // "Quién pasa" en playoffs (solo partidos de eliminación)
  const koMatches = matches.filter(m => m.stage !== 'group')
  const koPlayed = koMatches.filter(m => {
    const r = resultsById.get(m.id)
    return r && r.advances // cuenta como resuelto si ya tiene quién pasó
  }).length
  const advancesPtsPlayed = koPlayed * PTS_ADVANCES
  const advancesPtsTotal = koMatches.length * PTS_ADVANCES

  // Posiciones de grupo: "jugado" = grupos cerrados (con resultados de posición)
  const groupResults = data.groupResults || []
  const closedGroupLetters = new Set(groupResults.map(r => r.group_letter))
  const groupPosPlayed = Math.min(groupResults.length, N_GROUP_POSITIONS) * PTS_GROUP_POS
  const groupPosTotal = N_GROUP_POSITIONS * PTS_GROUP_POS

  // Terceros: "jugado" = terceros ya definidos
  const thirdResults = data.thirdResults || []
  const thirdPlayed = Math.min(thirdResults.length, N_THIRDS) * PTS_THIRD
  const thirdTotal = N_THIRDS * PTS_THIRD

  const ptsPlayed = matchPtsPlayed + advancesPtsPlayed + groupPosPlayed + thirdPlayed
  const ptsTotal = matchPtsTotal + advancesPtsTotal + groupPosTotal + thirdTotal
  const ptsRemaining = ptsTotal - ptsPlayed

  return {
    matches: { played: playedMatches, remaining: remainingMatches, total: totalMatches },
    days: { passed: daysPassed, remaining: daysRemaining, total: daysWithMatchesTotal },
    points: {
      played: ptsPlayed,
      remaining: ptsRemaining,
      total: ptsTotal,
      breakdown: {
        match: { played: matchPtsPlayed, total: matchPtsTotal },
        advances: { played: advancesPtsPlayed, total: advancesPtsTotal },
        groupPos: { played: groupPosPlayed, total: groupPosTotal },
        thirds: { played: thirdPlayed, total: thirdTotal },
      },
    },
    pct: {
      matches: totalMatches ? Math.round((playedMatches / totalMatches) * 100) : 0,
      points: ptsTotal ? Math.round((ptsPlayed / ptsTotal) * 100) : 0,
    },
  }
}
