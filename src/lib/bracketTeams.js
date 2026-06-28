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
