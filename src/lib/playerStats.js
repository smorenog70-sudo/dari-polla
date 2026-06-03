import { scoreMatch } from './scoring'
import { matchById, fechaMatchIds, FECHA_LABELS } from './matches'

/**
 * Funciones puras para calcular gamificación a partir de los datos que ya
 * existen (predicciones + resultados). No tocan la base de datos.
 */

// Orden cronológico de las "fechas"/rondas del torneo
export const FECHA_ORDER = [
  'group-F1', 'group-F2', 'group-F3',
  'r32', 'r16', 'qf', 'sf', 'third', 'final',
]

/**
 * Dado el conjunto de predicciones de UN usuario y los resultados,
 * devuelve una lista de partidos jugados (con resultado) en orden cronológico,
 * con los puntos que sacó en cada uno.
 */
export function playedMatches(userPreds, resultsById) {
  const rows = []
  for (const p of userPreds) {
    const r = resultsById.get(p.match_id)
    if (!r) continue
    const m = matchById(p.match_id)
    if (!m) continue
    const s = scoreMatch(p, r)
    rows.push({
      match: m,
      pred: p,
      result: r,
      points: s.total,
      breakdown: s.breakdown,
      exact: s.breakdown.exact > 0,
      hitOutcome: s.breakdown.outcome > 0,
      kickoff: m.kickoff_utc ? new Date(m.kickoff_utc).getTime() : 0,
    })
  }
  rows.sort((a, b) => a.kickoff - b.kickoff)
  return rows
}

/**
 * Racha actual de aciertos de resultado (ganador/empate), mirando los
 * partidos jugados en orden cronológico desde el más reciente hacia atrás.
 * También devuelve la mejor racha histórica.
 */
export function streaks(rows) {
  let current = 0
  let best = 0
  let run = 0
  for (const r of rows) {
    if (r.hitOutcome) {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  // racha actual = corriendo desde el final
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].hitOutcome) current++
    else break
  }
  return { current, best }
}

/**
 * Evolución del puntaje acumulado por fecha/ronda.
 * Devuelve [{ fecha, label, points, cumulative }]
 */
export function evolutionByFecha(userPreds, resultsById) {
  const predByMatch = new Map(userPreds.map(p => [p.match_id, p]))
  const out = []
  let cumulative = 0
  for (const fechaId of FECHA_ORDER) {
    const ids = fechaMatchIds(fechaId)
    let pts = 0
    let hasAnyResult = false
    for (const id of ids) {
      const r = resultsById.get(id)
      if (!r) continue
      hasAnyResult = true
      const p = predByMatch.get(id)
      if (p) pts += scoreMatch(p, r).total
    }
    if (!hasAnyResult) continue // no graficar fechas sin resultados aún
    cumulative += pts
    out.push({
      fecha: fechaId,
      label: FECHA_LABELS[fechaId] || fechaId,
      points: pts,
      cumulative,
    })
  }
  return out
}

/**
 * Resumen de una fecha específica para un usuario.
 */
export function fechaSummary(userPreds, resultsById, fechaId) {
  const ids = new Set(fechaMatchIds(fechaId))
  const predByMatch = new Map(userPreds.map(p => [p.match_id, p]))
  let points = 0
  let exacts = 0
  let outcomes = 0
  let played = 0
  let best = null
  for (const id of ids) {
    const r = resultsById.get(id)
    if (!r) continue
    played++
    const p = predByMatch.get(id)
    if (!p) continue
    const s = scoreMatch(p, r)
    points += s.total
    if (s.breakdown.exact > 0) exacts++
    if (s.breakdown.outcome > 0) outcomes++
    if (!best || s.total > best.points) {
      const m = matchById(id)
      best = { match: m, pred: p, result: r, points: s.total }
    }
  }
  return { fechaId, label: FECHA_LABELS[fechaId] || fechaId, points, exacts, outcomes, played, best }
}

/**
 * ¿Cuál es la última fecha que ya tiene todos (o casi todos) sus resultados?
 * Útil para mostrar el "resumen de la última fecha".
 */
export function lastCompletedFecha(resultsById) {
  let last = null
  for (const fechaId of FECHA_ORDER) {
    const ids = fechaMatchIds(fechaId)
    if (ids.length === 0) continue
    const withResult = ids.filter(id => resultsById.has(id)).length
    // consideramos "completada" si al menos la mitad tiene resultado
    if (withResult > 0 && withResult >= Math.ceil(ids.length / 2)) {
      last = fechaId
    }
  }
  return last
}

/**
 * Calcula los logros desbloqueados por un usuario.
 * Devuelve lista de { id, icon, name, desc, unlocked }.
 */
export function achievements(rows, evolution, allRowsByUser, userId) {
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const exactCount = rows.filter(r => r.exact).length
  const outcomeCount = rows.filter(r => r.hitOutcome).length
  const { best: bestStreak } = streaks(rows)
  const played = rows.length

  // ¿Ganó alguna fecha? (más puntos que todos en esa fecha)
  let wonAFecha = false
  if (allRowsByUser && userId) {
    for (const fechaId of FECHA_ORDER) {
      const ids = new Set(fechaMatchIds(fechaId))
      const scoreFor = (uid) => {
        const r = allRowsByUser.get(uid) || []
        return r.filter(x => ids.has(x.match.id)).reduce((s, x) => s + x.points, 0)
      }
      const mine = scoreFor(userId)
      if (mine <= 0) continue
      let isTop = true
      for (const uid of allRowsByUser.keys()) {
        if (uid === userId) continue
        if (scoreFor(uid) > mine) { isTop = false; break }
      }
      if (isTop) { wonAFecha = true; break }
    }
  }

  const defs = [
    { id: 'first_exact', icon: '🎯', name: 'Francotirador', desc: 'Acierta tu primer marcador exacto', unlocked: exactCount >= 1 },
    { id: 'five_exact', icon: '🎯', name: 'Tirador experto', desc: 'Acierta 5 marcadores exactos', unlocked: exactCount >= 5 },
    { id: 'streak_3', icon: '🔥', name: 'En racha', desc: 'Acierta el ganador en 3 partidos seguidos', unlocked: bestStreak >= 3 },
    { id: 'streak_5', icon: '🔥', name: 'Imparable', desc: 'Racha de 5 aciertos seguidos', unlocked: bestStreak >= 5 },
    { id: 'played_10', icon: '⚽', name: 'Constante', desc: 'Pronostica 10 partidos jugados', unlocked: played >= 10 },
    { id: 'points_50', icon: '⭐', name: 'Medio centenar', desc: 'Llega a 50 puntos', unlocked: totalPoints >= 50 },
    { id: 'points_100', icon: '💯', name: 'Centenario', desc: 'Llega a 100 puntos', unlocked: totalPoints >= 100 },
    { id: 'win_fecha', icon: '👑', name: 'Rey de la fecha', desc: 'Gana una jornada (más puntos que todos)', unlocked: wonAFecha },
    { id: 'sharpshooter', icon: '🦅', name: 'Ojo de águila', desc: 'Acierta el ganador 15 veces', unlocked: outcomeCount >= 15 },
  ]
  return defs
}
