import teamHistory from '../data/external/team-history.json'
import headToHead from '../data/external/head-to-head.json'

/**
 * Histórico de selecciones (forma reciente, estadísticas, head-to-head)
 * basado en partidos internacionales reales previos al Mundial 2026.
 * Fuente: dataset open source martj42/international_results (dominio público).
 *
 * - team-history.json: por selección, stats de los últimos ~3 años + últimos 10 partidos
 * - head-to-head.json: enfrentamientos directos entre selecciones (últimos ~15 años)
 */

/** Devuelve el histórico de una selección (en español), o null. */
export function teamHistoryOf(teamEs) {
  return teamHistory[teamEs] || null
}

/** Forma reciente como string de resultados, ej: ['G','G','E','P','G'] */
export function recentForm(teamEs, n = 5) {
  const h = teamHistory[teamEs]
  if (!h) return []
  return h.recent.slice(0, n).map(g => g.result)
}

/** Estadísticas agregadas de una selección. */
export function teamStats(teamEs) {
  const h = teamHistory[teamEs]
  return h ? h.stats : null
}

/**
 * Head-to-head entre dos selecciones (en español).
 * Devuelve el resumen desde la perspectiva de team1, o null si no hay historial.
 */
export function h2h(team1Es, team2Es) {
  // La clave está ordenada alfabéticamente; normalizamos
  const [a, b] = [team1Es, team2Es].sort()
  const rec = headToHead[`${a}|${b}`]
  if (!rec) return null
  // Reorientar a la perspectiva de team1
  if (rec.t1 === team1Es) {
    return { wins: rec.t1_wins, draws: rec.draws, losses: rec.t2_wins, total: rec.total, last5: rec.last5 }
  }
  return { wins: rec.t2_wins, draws: rec.draws, losses: rec.t1_wins, total: rec.total, last5: rec.last5 }
}

/** Etiqueta de color para un resultado (para los puntitos de forma). */
export function formColor(result) {
  if (result === 'G') return 'bg-green-500'
  if (result === 'E') return 'bg-yellow-500'
  return 'bg-red-500'
}
