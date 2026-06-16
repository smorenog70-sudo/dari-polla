/**
 * Confederación de cada selección, para las medallas por región.
 * CONMEBOL (Sudamérica), UEFA (Europa), CONCACAF (Norte/Centroamérica),
 * CAF (África), AFC (Asia), OFC (Oceanía).
 */
export const CONFEDERATION = {
  // CONMEBOL — Sudamérica
  'Argentina': 'CONMEBOL', 'Brasil': 'CONMEBOL', 'Uruguay': 'CONMEBOL',
  'Colombia': 'CONMEBOL', 'Ecuador': 'CONMEBOL', 'Paraguay': 'CONMEBOL',

  // UEFA — Europa
  'Alemania': 'UEFA', 'Austria': 'UEFA', 'Bélgica': 'UEFA', 'Bosnia': 'UEFA',
  'Croacia': 'UEFA', 'Escocia': 'UEFA', 'España': 'UEFA', 'Francia': 'UEFA',
  'Holanda': 'UEFA', 'Inglaterra': 'UEFA', 'Noruega': 'UEFA', 'Portugal': 'UEFA',
  'República Checa': 'UEFA', 'Suecia': 'UEFA', 'Suiza': 'UEFA', 'Turquía': 'UEFA',

  // CONCACAF — Norte/Centroamérica y Caribe
  'Estados Unidos': 'CONCACAF', 'México': 'CONCACAF', 'Canadá': 'CONCACAF',
  'Panamá': 'CONCACAF', 'Haití': 'CONCACAF', 'Curazao': 'CONCACAF',

  // CAF — África
  'Algeria': 'CAF', 'Cabo Verde': 'CAF', 'Congo': 'CAF', 'Costa de Marfil': 'CAF',
  'Egipto': 'CAF', 'Ghana': 'CAF', 'Marruecos': 'CAF', 'Senegal': 'CAF',
  'Sudáfrica': 'CAF', 'Túnez': 'CAF',

  // AFC — Asia
  'Arabia': 'AFC', 'Australia': 'AFC', 'Catar': 'AFC', 'Corea del Sur': 'AFC',
  'Iraq': 'AFC', 'Irán': 'AFC', 'Japón': 'AFC', 'Jordan': 'AFC', 'Uzbekistán': 'AFC',

  // OFC — Oceanía
  'Nueva Zelanda': 'OFC',
}

export function confederationOf(team) {
  return CONFEDERATION[team] || null
}
