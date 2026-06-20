/**
 * Mapeo de los nombres en español (como están en fixtures.json) a los
 * códigos FIFA de 3 letras (como están en los datasets oficiales).
 */
export const TEAM_TO_FIFA = {
  'Alemania': 'GER', 'Algeria': 'ALG', 'Arabia': 'KSA', 'Argentina': 'ARG',
  'Australia': 'AUS', 'Austria': 'AUT', 'Bosnia': 'BIH', 'Brasil': 'BRA',
  'Bélgica': 'BEL', 'Cabo Verde': 'CPV', 'Canadá': 'CAN', 'Catar': 'QAT',
  'Colombia': 'COL', 'Congo': 'COD', 'Corea del Sur': 'KOR', 'Costa de Marfil': 'CIV',
  'Croacia': 'CRO', 'Curazao': 'CUW', 'Ecuador': 'ECU', 'Egipto': 'EGY',
  'Escocia': 'SCO', 'España': 'ESP', 'Estados Unidos': 'USA', 'Francia': 'FRA',
  'Ghana': 'GHA', 'Haití': 'HAI', 'Holanda': 'NED', 'Inglaterra': 'ENG',
  'Iraq': 'IRQ', 'Irán': 'IRN', 'Japón': 'JPN', 'Jordan': 'JOR',
  'Marruecos': 'MAR', 'México': 'MEX', 'Noruega': 'NOR', 'Nueva Zelanda': 'NZL',
  'Panamá': 'PAN', 'Paraguay': 'PAR', 'Portugal': 'POR', 'República Checa': 'CZE',
  'Senegal': 'SEN', 'Sudáfrica': 'RSA', 'Suecia': 'SWE', 'Suiza': 'SUI',
  'Turquía': 'TUR', 'Túnez': 'TUN', 'Uruguay': 'URU', 'Uzbekistán': 'UZB',
}

export function fifaCode(team) {
  return TEAM_TO_FIFA[team] || null
}
