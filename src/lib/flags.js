/**
 * Banderas (emoji) por nombre de equipo, tal como aparecen en fixtures.json.
 * Si un equipo no está en el mapa, se devuelve cadena vacía (sin bandera).
 */
const FLAGS = {
  'Alemania': '🇩🇪',
  'Algeria': '🇩🇿',
  'Arabia': '🇸🇦',
  'Argentina': '🇦🇷',
  'Australia': '🇦🇺',
  'Austria': '🇦🇹',
  'Bosnia': '🇧🇦',
  'Brasil': '🇧🇷',
  'Bélgica': '🇧🇪',
  'Cabo Verde': '🇨🇻',
  'Canadá': '🇨🇦',
  'Catar': '🇶🇦',
  'Colombia': '🇨🇴',
  'Congo': '🇨🇩',
  'Corea del Sur': '🇰🇷',
  'Costa de Marfil': '🇨🇮',
  'Croacia': '🇭🇷',
  'Curazao': '🇨🇼',
  'Ecuador': '🇪🇨',
  'Egipto': '🇪🇬',
  'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'España': '🇪🇸',
  'Estados Unidos': '🇺🇸',
  'Francia': '🇫🇷',
  'Ghana': '🇬🇭',
  'Haití': '🇭🇹',
  'Holanda': '🇳🇱',
  'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Iraq': '🇮🇶',
  'Irán': '🇮🇷',
  'Japón': '🇯🇵',
  'Jordan': '🇯🇴',
  'Marruecos': '🇲🇦',
  'México': '🇲🇽',
  'Noruega': '🇳🇴',
  'Nueva Zelanda': '🇳🇿',
  'Panamá': '🇵🇦',
  'Paraguay': '🇵🇾',
  'Portugal': '🇵🇹',
  'República Checa': '🇨🇿',
  'Senegal': '🇸🇳',
  'Sudáfrica': '🇿🇦',
  'Suecia': '🇸🇪',
  'Suiza': '🇨🇭',
  'Turquía': '🇹🇷',
  'Túnez': '🇹🇳',
  'Uruguay': '🇺🇾',
  'Uzbekistán': '🇺🇿',
}

/**
 * Devuelve la bandera emoji de un equipo, o '' si no se conoce
 * (por ejemplo, las posiciones tipo "2A" o "1E" de eliminatorias).
 */
export function flagFor(teamName) {
  if (!teamName) return ''
  return FLAGS[teamName.trim()] || ''
}

/**
 * Devuelve "🇨🇴 Colombia" o, si no hay bandera, solo el nombre.
 */
export function teamWithFlag(teamName) {
  const f = flagFor(teamName)
  return f ? `${f} ${teamName}` : teamName
}
