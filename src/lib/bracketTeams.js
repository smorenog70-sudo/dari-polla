import { flagFor } from './flags'

/**
 * Mapa de posiciones de eliminatoria -> equipo real.
 * Lo llena el admin desde Admin → Llaves, y se guarda en config['bracket_teams'].
 *
 * Ejemplos de clave: "1A", "2B", "3A/B/C/D/F", "W73", "L101".
 *
 * resolveTeam("2A", map) -> "Colombia"  (si el admin lo asignó)
 *                        -> "2A"        (si todavía no)
 */
export function resolveTeam(placeholder, bracketTeams) {
  if (!placeholder) return placeholder
  if (!bracketTeams) return placeholder
  const real = bracketTeams[placeholder]
  return (real && real.trim()) ? real : placeholder
}

/**
 * Devuelve el equipo resuelto con su bandera si la tiene.
 */
export function resolveTeamWithFlag(placeholder, bracketTeams) {
  const name = resolveTeam(placeholder, bracketTeams)
  const f = flagFor(name)
  return f ? `${f} ${name}` : name
}

/**
 * ¿Es un placeholder de posición de grupo (1A, 2B...) o de tercero (3A/...)?
 * Útil para el formulario admin.
 */
export function isGroupPlaceholder(ph) {
  return /^[12][A-L]$/.test(ph) || /^3[A-Z/]+$/.test(ph)
}

/**
 * ¿Es un placeholder de ganador/perdedor de un partido previo? (W73, L101)
 */
export function isMatchPlaceholder(ph) {
  return /^[WL]\d+$/.test(ph)
}

/**
 * Genera automáticamente el mapeo de posiciones de grupo (1A, 2A, 1B, 2B...)
 * a equipos reales, basándose en las tablas de grupo ya calculadas.
 *
 * SOLO resuelve 1ros y 2dos de grupos que YA TERMINARON (los 4 equipos jugaron
 * sus 3 partidos). No toca terceros (3A/...) ni ganadores de partido (W73),
 * que el admin confirma manualmente.
 *
 * @param groupTables - resultado de computeGroupTables(resultsById)
 * @returns objeto { "1A": "México", "2A": "Croacia", ... } solo de grupos cerrados
 */
export function autoResolveGroupPositions(groupTables) {
  const out = {}
  if (!groupTables || !groupTables.groups) return out
  for (const [g, rows] of Object.entries(groupTables.groups)) {
    // El grupo está cerrado solo si todos jugaron sus 3 partidos
    const allPlayed = rows.length === 4 && rows.every(r => r.played === 3)
    if (!allPlayed) continue
    // rows ya viene ordenado por posición
    const first = rows[0]
    const second = rows[1]
    if (first) out[`1${g}`] = first.team
    if (second) out[`2${g}`] = second.team
  }
  return out
}

/**
 * Ordena los partidos de cada ronda de eliminación en el ORDEN VISUAL correcto
 * del bracket, de modo que los partidos que alimentan al mismo partido siguiente
 * queden adyacentes (como en un cuadro de eliminatorias real).
 *
 * El orden por ID (R16-89, R16-90, R16-91...) NO coincide con el orden visual,
 * porque los cruces de FIFA no son secuenciales. Esta función recorre el árbol
 * desde la final hacia atrás para obtener el orden top→bottom correcto.
 *
 * @param matches - todos los partidos (TOURNAMENT.matches)
 * @param stage - la ronda a ordenar ('r16', 'qf', 'sf')
 * @returns array de partidos de esa ronda en orden visual
 */
export function bracketVisualOrder(matches, stage) {
  const byId = {}
  const numToId = {}
  for (const m of matches) {
    byId[m.id] = m
    if (m.stage !== 'group') {
      const nums = m.id.match(/(\d+)/g)
      if (nums) numToId[nums[nums.length - 1]] = m.id
    }
  }

  // Recorre desde un partido hacia sus "feeders" (W##) hasta llegar al stage pedido
  const collect = (matchId, targetStage, acc) => {
    const m = byId[matchId]
    if (!m) return
    for (const raw of [m.team1_raw, m.team2_raw]) {
      if (raw && raw.startsWith('W')) {
        const childId = numToId[raw.slice(1)]
        if (!childId) continue
        if (byId[childId].stage === targetStage) {
          acc.push(byId[childId])
        } else {
          collect(childId, targetStage, acc)
        }
      }
    }
  }

  // Encontrar el partido final (no alimenta a ningún otro)
  const finalMatch = matches.find(m => m.stage === 'final') || matches.find(m => m.id === 'FINAL')
  if (!finalMatch) {
    // Fallback: orden por ID
    return matches.filter(m => m.stage === stage)
  }
  if (stage === 'final') return [finalMatch]

  const ordered = []
  collect(finalMatch.id, stage, ordered)
  // Si algo quedó fuera (por seguridad), agregarlo al final en orden de ID
  const seen = new Set(ordered.map(m => m.id))
  for (const m of matches.filter(x => x.stage === stage)) {
    if (!seen.has(m.id)) ordered.push(m)
  }
  return ordered
}

/**
 * Helper centralizado: dado el estado de la liga (data), construye el mapa de
 * resolución (grupos auto + lo confirmado por el admin) y devuelve funciones
 * listas para resolver partidos. Evita repetir esta lógica en cada página.
 *
 * Uso:
 *   const { resolveMatch, teams } = buildResolver(data)
 *   const m = resolveMatch(rawMatch)  // m.team1 / m.team2 ya resueltos
 */
import { computeGroupTables } from './groupTables'

export function buildResolver(data) {
  const resultsById = new Map((data?.results || []).map(r => [r.match_id, r]))
  const gt = computeGroupTables(resultsById)
  const auto = autoResolveGroupPositions(gt)
  const manual = data?.config?.bracket_teams || {}
  const teams = { ...auto, ...manual }

  const resolveMatch = (m) => {
    if (!m || m.stage === 'group') return m
    return {
      ...m,
      team1: resolveTeam(m.team1_raw || m.team1, teams),
      team2: resolveTeam(m.team2_raw || m.team2, teams),
    }
  }

  return { resolveMatch, teams, resolveOne: (ph) => resolveTeam(ph, teams) }
}
