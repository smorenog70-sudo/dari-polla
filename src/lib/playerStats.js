import { scoreMatch } from './scoring'
import { matchById, fechaMatchIds, FECHA_LABELS } from './matches'
import { confederationOf } from './confederations'

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
 * Evolución del puntaje acumulado PARTIDO POR PARTIDO, en orden cronológico.
 * Devuelve [{ matchId, label, points, cumulative, kickoff }]
 * Solo incluye partidos que ya tienen resultado.
 */
export function evolutionByMatch(userPreds, resultsById) {
  const rows = playedMatches(userPreds, resultsById) // ya viene ordenado por kickoff
  const out = []
  let cumulative = 0
  let n = 0
  for (const r of rows) {
    cumulative += r.points
    n++
    out.push({
      matchId: r.match.id,
      label: shortMatchLabel(r.match, n),
      teams: `${r.match.team1} vs ${r.match.team2}`,
      points: r.points,
      cumulative,
      kickoff: r.kickoff,
    })
  }
  return out
}

function shortMatchLabel(match, index) {
  // Etiqueta corta para el eje X: iniciales de los equipos
  const ini = (name) => (name || '').slice(0, 3).toUpperCase()
  return `${ini(match.team1)}-${ini(match.team2)}`
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

  // --- Métricas para medallas nuevas ---
  // Perfeccionista: algún partido con los 15 puntos
  const perfectGame = rows.some(r => r.points >= 15)
  // Mago de los números: aciertos de goles de un equipo (home o away)
  const goalHits = rows.reduce((s, r) => s + (r.breakdown.home > 0 ? 1 : 0) + (r.breakdown.away > 0 ? 1 : 0), 0)
  // Apostador: acertó ganador en partido con 3+ goles de diferencia real
  const bigWinHit = rows.some(r => r.hitOutcome && Math.abs(r.result.score1 - r.result.score2) >= 3)
  // Muralla: aciertos de resultado en partidos de pocos goles (≤1 gol total real)
  const lowScoreHits = rows.filter(r => r.hitOutcome && (r.result.score1 + r.result.score2) <= 1).length
  // Diplomático: aciertos de empate
  const drawHits = rows.filter(r => r.hitOutcome && r.result.score1 === r.result.score2).length
  // El opuesto: predijo el marcador exactamente invertido (y no era empate)
  const reversed = rows.some(r =>
    r.pred.score1 === r.result.score2 &&
    r.pred.score2 === r.result.score1 &&
    r.result.score1 !== r.result.score2
  )

  // --- Métricas para las 13 medallas nuevas ---

  // Goleada anunciada: marcador EXACTO con 3+ goles de diferencia
  const bigExact = rows.some(r => r.exact && Math.abs(r.result.score1 - r.result.score2) >= 3)
  // Maestro del cero: aciertos exactos de partidos 0-0
  const zeroZeroHits = rows.filter(r => r.exact && r.result.score1 === 0 && r.result.score2 === 0).length
  // Number cruncher: acertó la diferencia de gol (breakdown.diff) en 10 partidos
  const diffHits = rows.filter(r => r.breakdown.diff > 0).length
  // Sangre fría: aciertos de ganador en partidos definidos por 1 gol
  const oneGoalHits = rows.filter(r => r.hitOutcome && Math.abs(r.result.score1 - r.result.score2) === 1).length
  // Imparable total: racha de 10
  // (bestStreak ya calculado)

  // Regionales: aciertos de ganador en partidos por confederación de los equipos
  const confHits = {} // conf -> set de partidos acertados
  const confsSeen = new Set()
  for (const r of rows) {
    if (!r.hitOutcome) continue
    const c1 = confederationOf(r.match.team1)
    const c2 = confederationOf(r.match.team2)
    for (const c of [c1, c2]) {
      if (!c) continue
      confHits[c] = (confHits[c] || 0) + 1
      confsSeen.add(c)
    }
  }
  const sudacaHits = confHits['CONMEBOL'] || 0
  const europeoHits = confHits['UEFA'] || 0
  const trotamundos = confsSeen.size >= 4

  // Madrugador: pronosticó con +1 día de anticipación (si hay timestamp de creación)
  let earlyBirdCount = 0
  for (const r of rows) {
    const created = r.pred?.created_at ? new Date(r.pred.created_at).getTime() : null
    const ko = r.match?.kickoff_utc ? new Date(r.match.kickoff_utc).getTime() : null
    if (created && ko && (ko - created) >= 24 * 3600 * 1000) earlyBirdCount++
  }

  // Francotirador de fecha: acertó TODOS los ganadores de una fecha completa
  let perfectFechaOutcomes = false
  for (const fechaId of FECHA_ORDER) {
    const ids = fechaMatchIds(fechaId)
    const playedInFecha = rows.filter(r => ids.includes(r.match.id))
    if (playedInFecha.length >= 4 && playedInFecha.length === ids.length &&
        playedInFecha.every(r => r.hitOutcome)) {
      perfectFechaOutcomes = true
      break
    }
  }

  // Rey del partido / Rey del día: ¿fue el máximo puntaje de algún partido / día?
  let matchKing = false, dayKing = false
  if (allRowsByUser && userId) {
    // Rey del partido: en algún partido, mi puntaje fue el más alto (y > 0)
    const allMatchIds = new Set()
    for (const urows of allRowsByUser.values()) for (const x of urows) allMatchIds.add(x.match.id)
    for (const mid of allMatchIds) {
      let myPts = -1, maxPts = -1
      for (const [uid, urows] of allRowsByUser) {
        const x = urows.find(y => y.match.id === mid)
        const pts = x ? x.points : 0
        if (uid === userId) myPts = pts
        if (pts > maxPts) maxPts = pts
      }
      if (myPts > 0 && myPts === maxPts) { matchKing = true; break }
    }
    // Rey del día: agrupar partidos por día y ver si gané alguno
    const dayMap = new Map() // dayKey -> Set(matchId)
    for (const mid of allMatchIds) {
      const m = matchById(mid)
      if (!m?.kickoff_utc) continue
      const dayKey = new Date(m.kickoff_utc).toLocaleDateString('en-CA')
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Set())
      dayMap.get(dayKey).add(mid)
    }
    for (const [, mids] of dayMap) {
      let myPts = 0
      const totalsByU = new Map()
      for (const [uid, urows] of allRowsByUser) {
        let s = 0
        for (const x of urows) if (mids.has(x.match.id)) s += x.points
        totalsByU.set(uid, s)
        if (uid === userId) myPts = s
      }
      const maxPts = Math.max(...totalsByU.values(), 0)
      if (myPts > 0 && myPts === maxPts) { dayKing = true; break }
    }
  }

  // Remontada: estuvo fuera del top 10 y llegó al top 5 (acumulado entre fechas)
  let comeback = false
  if (allRowsByUser && userId) {
    const ranksByFecha = []
    for (const fechaId of FECHA_ORDER) {
      const idx = FECHA_ORDER.indexOf(fechaId)
      const cumIds = new Set()
      for (let i = 0; i <= idx; i++) for (const id of fechaMatchIds(FECHA_ORDER[i])) cumIds.add(id)
      const scoreFor = (uid) => (allRowsByUser.get(uid) || [])
        .filter(x => cumIds.has(x.match.id)).reduce((s, x) => s + x.points, 0)
      const mine = scoreFor(userId)
      const scores = []
      let any = false
      for (const uid of allRowsByUser.keys()) { const sc = scoreFor(uid); scores.push(sc); if (sc > 0) any = true }
      if (!any) continue
      scores.sort((a, b) => b - a)
      ranksByFecha.push(scores.filter(s => s > mine).length + 1)
    }
    const wasOut = ranksByFecha.some(r => r > 10)
    const gotTop5 = ranksByFecha.length > 0 && ranksByFecha[ranksByFecha.length - 1] <= 5
    comeback = wasOut && gotTop5 && ranksByFecha.length >= 2
  }


  // ¿Ganó alguna fecha? + ¿podio en alguna fecha? (Top 3)
  let wonAFecha = false
  let podiumFecha = false
  let wonFechasCount = 0
  if (allRowsByUser && userId) {
    for (const fechaId of FECHA_ORDER) {
      const ids = new Set(fechaMatchIds(fechaId))
      const scoreFor = (uid) => {
        const r = allRowsByUser.get(uid) || []
        return r.filter(x => ids.has(x.match.id)).reduce((s, x) => s + x.points, 0)
      }
      const mine = scoreFor(userId)
      if (mine <= 0) continue
      // ranking de la fecha
      const scores = []
      for (const uid of allRowsByUser.keys()) scores.push(scoreFor(uid))
      scores.sort((a, b) => b - a)
      const myRank = scores.filter(s => s > mine).length + 1
      if (myRank === 1) { wonAFecha = true; wonFechasCount++ }
      if (myRank <= 3) podiumFecha = true
    }
  }
  const bicampeon = wonFechasCount >= 2

  // Profeta: acertó un resultado que <20% del grupo acertó
  let prophet = false
  if (allRowsByUser && userId) {
    const myRows = allRowsByUser.get(userId) || []
    for (const r of myRows) {
      if (!r.hitOutcome) continue
      const matchId = r.match.id
      const myOutcome = Math.sign(r.result.score1 - r.result.score2)
      let hits = 0, total = 0
      for (const uid of allRowsByUser.keys()) {
        const urows = allRowsByUser.get(uid) || []
        const ur = urows.find(x => x.match.id === matchId)
        if (!ur) continue
        total++
        if (ur.hitOutcome) hits++
      }
      if (total >= 5 && hits / total < 0.2) { prophet = true; break }
    }
  }

  // Knockout: sacó 0 puntos en un partido que >70% acertó el ganador
  let knockout = false
  if (allRowsByUser && userId) {
    const myRows = allRowsByUser.get(userId) || []
    for (const r of myRows) {
      if (r.points > 0) continue
      const matchId = r.match.id
      let hits = 0, total = 0
      for (const uid of allRowsByUser.keys()) {
        const urows = allRowsByUser.get(uid) || []
        const ur = urows.find(x => x.match.id === matchId)
        if (!ur) continue
        total++
        if (ur.hitOutcome) hits++
      }
      if (total >= 5 && hits / total > 0.7) { knockout = true; break }
    }
  }

  // Escalador: subió 5+ puestos entre dos fechas consecutivas
  let climber = false
  if (allRowsByUser && userId) {
    const ranksByFecha = []
    for (const fechaId of FECHA_ORDER) {
      const ids = new Set(fechaMatchIds(fechaId))
      const cumIds = new Set()
      // acumulado hasta esta fecha (inclusive)
      const idx = FECHA_ORDER.indexOf(fechaId)
      for (let i = 0; i <= idx; i++) {
        for (const id of fechaMatchIds(FECHA_ORDER[i])) cumIds.add(id)
      }
      const scoreFor = (uid) => {
        const r = allRowsByUser.get(uid) || []
        return r.filter(x => cumIds.has(x.match.id)).reduce((s, x) => s + x.points, 0)
      }
      const mine = scoreFor(userId)
      const scores = []
      let anyResult = false
      for (const uid of allRowsByUser.keys()) {
        const sc = scoreFor(uid)
        scores.push(sc)
        if (sc > 0) anyResult = true
      }
      if (!anyResult) continue
      scores.sort((a, b) => b - a)
      const myRank = scores.filter(s => s > mine).length + 1
      ranksByFecha.push(myRank)
    }
    for (let i = 1; i < ranksByFecha.length; i++) {
      if (ranksByFecha[i - 1] - ranksByFecha[i] >= 5) { climber = true; break }
    }
  }

  const defs = [
    // Precisión
    { id: 'first_exact', icon: '🎯', name: 'Francotirador', desc: 'Acierta tu primer marcador exacto', unlocked: exactCount >= 1 },
    { id: 'five_exact', icon: '🎯', name: 'Tirador experto', desc: 'Acierta 5 marcadores exactos', unlocked: exactCount >= 5 },
    { id: 'ten_exact', icon: '🎯', name: 'Tirador de élite', desc: 'Acierta 10 marcadores exactos', unlocked: exactCount >= 10 },
    { id: 'perfect', icon: '💎', name: 'Perfeccionista', desc: 'Saca los 15 puntos en un partido', unlocked: perfectGame },
    { id: 'goal_mage', icon: '🔢', name: 'Mago de los números', desc: 'Acierta 10 veces los goles de un equipo', unlocked: goalHits >= 10 },
    // Rachas y constancia
    { id: 'streak_3', icon: '🔥', name: 'En racha', desc: 'Acierta el ganador en 3 partidos seguidos', unlocked: bestStreak >= 3 },
    { id: 'streak_5', icon: '🔥', name: 'Imparable', desc: 'Racha de 5 aciertos seguidos', unlocked: bestStreak >= 5 },
    { id: 'streak_7', icon: '🌋', name: 'En llamas', desc: 'Racha de 7 aciertos seguidos', unlocked: bestStreak >= 7 },
    { id: 'played_10', icon: '⚽', name: 'Constante', desc: 'Pronostica 10 partidos jugados', unlocked: played >= 10 },
    // Puntos
    { id: 'points_50', icon: '⭐', name: 'Medio centenar', desc: 'Llega a 50 puntos', unlocked: totalPoints >= 50 },
    { id: 'points_100', icon: '💯', name: 'Centenario', desc: 'Llega a 100 puntos', unlocked: totalPoints >= 100 },
    { id: 'sharpshooter', icon: '🦅', name: 'Ojo de águila', desc: 'Acierta el ganador 15 veces', unlocked: outcomeCount >= 15 },
    // Competencia
    { id: 'win_fecha', icon: '👑', name: 'Rey de la fecha', desc: 'Gana una jornada (más puntos que todos)', unlocked: wonAFecha },
    { id: 'bicampeon', icon: '🏆', name: 'Bicampeón', desc: 'Gana 2 fechas distintas', unlocked: bicampeon },
    { id: 'podium', icon: '🎖️', name: 'Podio', desc: 'Termina una fecha en el top 3', unlocked: podiumFecha },
    { id: 'climber', icon: '🚀', name: 'Escalador', desc: 'Sube 5+ puestos de una fecha a otra', unlocked: climber },
    // Personalidad
    { id: 'gambler', icon: '🎲', name: 'Apostador', desc: 'Acierta un ganador en una goleada (3+ de diferencia)', unlocked: bigWinHit },
    { id: 'wall', icon: '🛡️', name: 'Muralla', desc: 'Acierta 5 partidos de pocos goles', unlocked: lowScoreHits >= 5 },
    { id: 'prophet', icon: '🔮', name: 'Profeta', desc: 'Acierta un resultado que casi nadie vio venir', unlocked: prophet },
    { id: 'diplomat', icon: '🤝', name: 'Diplomático', desc: 'Acierta 5 empates', unlocked: drawHits >= 5 },
    // Divertidas
    { id: 'knockout', icon: '🪦', name: 'Knock out', desc: '0 puntos en un partido que casi todos acertaron', unlocked: knockout },
    { id: 'opposite', icon: '🎭', name: 'El opuesto', desc: 'Predijiste el marcador exactamente al revés', unlocked: reversed },
    // Reyes rotativos
    { id: 'match_king', icon: '⚽👑', name: 'Rey del partido', desc: 'Fuiste quien más puntos sacó en un partido', unlocked: matchKing },
    { id: 'day_king', icon: '📅👑', name: 'Rey del día', desc: 'Fuiste quien más puntos sumó en un día', unlocked: dayKing },
    // Goles y diferencia
    { id: 'big_exact', icon: '💥', name: 'Goleada anunciada', desc: 'Acierta un marcador exacto con 3+ goles de diferencia', unlocked: bigExact },
    { id: 'zero_master', icon: '🥅', name: 'Maestro del cero', desc: 'Acierta 3 partidos que terminaron 0-0', unlocked: zeroZeroHits >= 3 },
    { id: 'number_cruncher', icon: '🎰', name: 'Number cruncher', desc: 'Acierta la diferencia de gol en 10 partidos', unlocked: diffHits >= 10 },
    { id: 'cold_blood', icon: '🧊', name: 'Sangre fría', desc: 'Acierta 3 partidos definidos por 1 solo gol', unlocked: oneGoalHits >= 3 },
    // Regionales
    { id: 'sudaca', icon: '🌎', name: 'Hincha sudaca', desc: 'Acierta 5 partidos de equipos sudamericanos', unlocked: sudacaHits >= 5 },
    { id: 'europeo', icon: '🌍', name: 'Conocedor europeo', desc: 'Acierta 5 partidos de equipos europeos', unlocked: europeoHits >= 5 },
    { id: 'trotamundos', icon: '⚜️', name: 'Trotamundos', desc: 'Acierta partidos de 4 confederaciones distintas', unlocked: trotamundos },
    // Comportamiento
    { id: 'early_bird', icon: '🦉', name: 'Madrugador', desc: 'Pronostica 10 partidos con +1 día de anticipación', unlocked: earlyBirdCount >= 10 },
    { id: 'fecha_sniper', icon: '🎯', name: 'Francotirador de fecha', desc: 'Acierta todos los ganadores de una fecha completa', unlocked: perfectFechaOutcomes },
    { id: 'comeback', icon: '📈', name: 'Remontada', desc: 'Llega al top 5 tras haber estado fuera del top 10', unlocked: comeback },
    { id: 'streak_10', icon: '🔥🔥', name: 'Imparable total', desc: 'Racha de 10 aciertos seguidos', unlocked: bestStreak >= 10 },

    { id: 'goat', icon: '🐐', name: 'La cabra (GOAT)', desc: 'Llega al puesto #1 de la tabla general', unlocked: false }, // se calcula fuera
  ]
  return defs
}
