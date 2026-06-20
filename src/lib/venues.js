import venuesResearch from '../data/external/venues-research.json'
import venuesBasic from '../data/external/venues.json'

/**
 * Datos de las 16 sedes del Mundial 2026, usando el dataset oficial
 * (venues-research.json: capacidades FIFA, coordenadas, techo reales).
 * La altitud se mantiene curada (dato público estable por ciudad).
 *
 * IMPORTANTE: altitud y clima son contexto informativo. Con pocos partidos,
 * NO sirven para correlaciones serias — se muestran como dato curioso.
 */

const VR = venuesResearch.venues || {}
const VB = venuesBasic.venues || {}

// Mapeo ground (fixtures) -> id de venue en el dataset
const GROUND_TO_VENUE = {
  'Mexico City': '400222084',
  'Guadalajara (Zapopan)': '400252150',
  'Monterrey (Guadalupe)': '400238450',
  'Atlanta': '400098290',
  'Boston (Foxborough)': '400248623',
  'Dallas (Arlington)': '400257526',
  'Houston': '400249385',
  'Kansas City': '400254717',
  'Los Angeles (Inglewood)': '400017978',
  'Miami (Miami Gardens)': '400257525',
  'New York/New Jersey (East Rutherford)': '400257536',
  'Philadelphia': '400248622',
  'San Francisco Bay Area (Santa Clara)': '400257521',
  'Seattle': '400216606',
  'Toronto': '400242032',
  'Vancouver': '400248370',
}

// Altitud (m sobre nivel del mar) y clima — datos públicos estables por ciudad
const EXTRA = {
  'Mexico City': { altitude: 2240, climate: 'Templado, lluvias frecuentes', country: '🇲🇽 México' },
  'Guadalajara (Zapopan)': { altitude: 1566, climate: 'Cálido con lluvias', country: '🇲🇽 México' },
  'Monterrey (Guadalupe)': { altitude: 500, climate: 'Muy caluroso y seco', country: '🇲🇽 México' },
  'Atlanta': { altitude: 320, climate: 'Caluroso y húmedo', country: '🇺🇸 USA' },
  'Boston (Foxborough)': { altitude: 89, climate: 'Templado', country: '🇺🇸 USA' },
  'Dallas (Arlington)': { altitude: 160, climate: 'Muy caluroso', country: '🇺🇸 USA' },
  'Houston': { altitude: 15, climate: 'Caluroso y muy húmedo', country: '🇺🇸 USA' },
  'Kansas City': { altitude: 270, climate: 'Caluroso', country: '🇺🇸 USA' },
  'Los Angeles (Inglewood)': { altitude: 30, climate: 'Templado y seco', country: '🇺🇸 USA' },
  'Miami (Miami Gardens)': { altitude: 2, climate: 'Caluroso y muy húmedo', country: '🇺🇸 USA' },
  'New York/New Jersey (East Rutherford)': { altitude: 5, climate: 'Templado', country: '🇺🇸 USA' },
  'Philadelphia': { altitude: 12, climate: 'Caluroso y húmedo', country: '🇺🇸 USA' },
  'San Francisco Bay Area (Santa Clara)': { altitude: 8, climate: 'Templado y seco', country: '🇺🇸 USA' },
  'Seattle': { altitude: 38, climate: 'Templado, algo de lluvia', country: '🇺🇸 USA' },
  'Toronto': { altitude: 76, climate: 'Templado', country: '🇨🇦 Canadá' },
  'Vancouver': { altitude: 0, climate: 'Templado y húmedo', country: '🇨🇦 Canadá' },
}

const ROOF_ES = {
  open: 'Abierto', retractable: 'Retráctil', canopy: 'Parcial', fixed: 'Fijo (cubierto)',
}

export function venueInfo(ground) {
  const vid = GROUND_TO_VENUE[ground]
  const v = vid ? VR[vid] : null
  const vb = vid ? VB[vid] : null
  const extra = EXTRA[ground]
  if (!v && !extra) return null
  let stadium = v?.realName || ground
  stadium = stadium.replace(/\s*\(.*?\)/g, '').trim()
  return {
    stadium,
    city: v?.city || ground,
    country: extra?.country || '',
    capacity: v?.wcCapacity || vb?.capacity || null,
    roof: ROOF_ES[vb?.roof] || 'Abierto',
    altitude: extra?.altitude ?? null,
    climate: extra?.climate || '',
    lat: v?.lat || null,
    lon: v?.lon || null,
  }
}

export function altitudeCategory(meters) {
  if (meters == null) return { label: '—', emoji: '🏟️', note: '' }
  if (meters >= 2000) return { label: 'Altura extrema', emoji: '🏔️', note: 'Afecta el rendimiento físico' }
  if (meters >= 1000) return { label: 'Altura moderada', emoji: '⛰️', note: 'Puede influir un poco' }
  return { label: 'Nivel del mar', emoji: '🏖️', note: 'Sin efecto de altitud' }
}
