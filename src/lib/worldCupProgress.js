import { TOURNAMENT } from './matches'
import { ADVANCE_BONUS, PODIUM_POINTS, PODIUM_KEYS } from './scoring'
import { actualPodium } from './podium'

/**
 * Calcula el avance del Mundial y de los puntos "en juego" de la polla.
 *
 * Puntos POSIBLES por jugador (el máximo que alguien podría sacar):
 *  - Marcadores: 104 partidos × 15 pts (5 ganador + 5 exacto + 2 local + 2 visita + 1 dif)
 *  - Playoffs "quién pasa": bono escalonado por ronda (r32=10 … final=50)
 *  - Posiciones de grupo: 12 grupos × 4 posiciones × 5 = 240
 *  - Mejores terceros: 8 × 5 = 40
 *  - Podio final: 30 + 20 + 15 + 10 = 75
 *
 * "Jugado" = lo que ya se resolvió (partidos con resultado, grupos cerrados, terceros definidos).
 * "Por jugar" = lo que falta.
 */

const PTS_MATCH = 15          // máximo del marcador por partido
const PTS_GROUP_POS = 5       // cada posición de grupo acertada
const PTS_THIRD = 5           // cada tercero acertado
const N_GROUP_POSITIONS = 12 * 4  // 48 posiciones (12 grupos × 4)
const N_THIRDS = 8
const PTS_PODIUM_TOTAL = PODIUM_KEYS.reduce((s, k) => s + PODIUM_POINTS[k], 0)  // 75

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

  // "Quién pasa/gana" en playoffs: bono escalonado por ronda (incluye 3er puesto = 30).
  const koMatches = matches.filter(m => m.stage !== 'group')
  const advBonusOf = (m) => ADVANCE_BONUS[m.stage] ?? 0
  const advancesPtsTotal = koMatches.reduce((s, m) => s + advBonusOf(m), 0)
  const advancesPtsPlayed = koMatches.reduce((s, m) => {
    const r = resultsById.get(m.id)
    return s + (r && r.advances ? advBonusOf(m) : 0)
  }, 0)

  // Podio final (75 pts posibles). "Jugado" = puestos ya definidos por resultados.
  const realPodium = actualPodium(data)
  const podiumPtsPlayed = PODIUM_KEYS.reduce((s, k) => s + (realPodium[k] ? PODIUM_POINTS[k] : 0), 0)
  const podiumPtsTotal = PTS_PODIUM_TOTAL

  // Posiciones de grupo: "jugado" = grupos cerrados (con resultados de posición)
  const groupResults = data.groupResults || []
  const closedGroupLetters = new Set(groupResults.map(r => r.group_letter))
  const groupPosPlayed = Math.min(groupResults.length, N_GROUP_POSITIONS) * PTS_GROUP_POS
  const groupPosTotal = N_GROUP_POSITIONS * PTS_GROUP_POS

  // Terceros: "jugado" = terceros ya definidos
  const thirdResults = data.thirdResults || []
  const thirdPlayed = Math.min(thirdResults.length, N_THIRDS) * PTS_THIRD
  const thirdTotal = N_THIRDS * PTS_THIRD

  const ptsPlayed = matchPtsPlayed + advancesPtsPlayed + groupPosPlayed + thirdPlayed + podiumPtsPlayed
  const ptsTotal = matchPtsTotal + advancesPtsTotal + groupPosTotal + thirdTotal + podiumPtsTotal
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
        podium: { played: podiumPtsPlayed, total: podiumPtsTotal },
      },
    },
    pct: {
      matches: totalMatches ? Math.round((playedMatches / totalMatches) * 100) : 0,
      points: ptsTotal ? Math.round((ptsPlayed / ptsTotal) * 100) : 0,
    },
  }
}
