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
