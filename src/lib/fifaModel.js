import fifaRanking from '../data/external/fifa-ranking.json'
import teamsStatic from '../data/external/teams-static.json'
import { fifaCode } from './teamCodes'

/**
 * Modelo de probabilidad basado en el RANKING FIFA OFICIAL del 11 de junio 2026.
 * Los puntos vienen del dataset oficial (fifa-ranking.json), no de aproximaciones.
 */

const RANKING = fifaRanking.ranking || {}
const TEAMS = teamsStatic.teams || {}

export function fifaPoints(team) {
  const code = fifaCode(team)
  if (code && RANKING[code]) return RANKING[code].pts
  return 1450
}

export function fifaRank(team) {
  const code = fifaCode(team)
  if (code && RANKING[code]) return RANKING[code].rank
  return null
}

export function teamColors(team) {
  const code = fifaCode(team)
  if (code && TEAMS[code]?.colors) return TEAMS[code].colors
  return null
}

export function teamNickname(team) {
  const code = fifaCode(team)
  if (code && TEAMS[code]?.nickname) return TEAMS[code].nickname
  return null
}

export function matchProbabilities(team1, team2) {
  const r1 = fifaPoints(team1)
  const r2 = fifaPoints(team2)
  const diff = r1 - r2
  const pRaw1 = 1 / (1 + Math.pow(10, -diff / 400))
  const closeness = 1 - Math.abs(pRaw1 - 0.5) * 2
  const pDraw = 0.20 + 0.12 * closeness
  const pWin1 = pRaw1 * (1 - pDraw)
  const pWin2 = (1 - pRaw1) * (1 - pDraw)
  return {
    pTeam1: Math.round(pWin1 * 100),
    pDraw: Math.round(pDraw * 100),
    pTeam2: Math.round(pWin2 * 100),
    favorite: pWin1 > pWin2 ? team1 : team2,
    rank1: fifaRank(team1),
    rank2: fifaRank(team2),
  }
}

export function modelPick(team1, team2) {
  const p = matchProbabilities(team1, team2)
  const max = Math.max(p.pTeam1, p.pDraw, p.pTeam2)
  if (max === p.pTeam1) return 'team1'
  if (max === p.pTeam2) return 'team2'
  return 'draw'
}
