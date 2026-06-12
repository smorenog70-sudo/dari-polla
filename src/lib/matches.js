import fixtures from '../data/fixtures.json'

export const TOURNAMENT = fixtures

/** Returns true if the match has been locked (within 10 min of kickoff or after) */
export function isMatchLocked(match, now = new Date()) {
  if (!match?.kickoff_utc) return false
  const ko = new Date(match.kickoff_utc).getTime()
  return now.getTime() >= ko - 10 * 60 * 1000
}

/** Returns true if the match has actually kicked off (exact start time or after).
 * Used to reveal community stats and per-player scores without giving an edge. */
export function hasMatchStarted(match, now = new Date()) {
  if (!match?.kickoff_utc) return false
  const ko = new Date(match.kickoff_utc).getTime()
  return now.getTime() >= ko
}

/** All matches grouped by stage and fecha */
export function groupedMatches() {
  const out = {
    group: { 1: [], 2: [], 3: [] },
    r32: [],
    r16: [],
    qf: [],
    sf: [],
    third: [],
    final: [],
  }
  for (const m of fixtures.matches) {
    if (m.stage === 'group') {
      out.group[m.fecha].push(m)
    } else if (out[m.stage] !== undefined) {
      out[m.stage].push(m)
    }
  }
  // sort by kickoff
  const byKO = (a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc)
  out.group[1].sort(byKO)
  out.group[2].sort(byKO)
  out.group[3].sort(byKO)
  out.r32.sort(byKO)
  out.r16.sort(byKO)
  out.qf.sort(byKO)
  out.sf.sort(byKO)
  return out
}

/** Match IDs that belong to a "fecha" (used for round-fines) */
export function fechaMatchIds(fechaId) {
  const map = {
    'group-F1': fixtures.matches.filter(m => m.stage === 'group' && m.fecha === 1).map(m => m.id),
    'group-F2': fixtures.matches.filter(m => m.stage === 'group' && m.fecha === 2).map(m => m.id),
    'group-F3': fixtures.matches.filter(m => m.stage === 'group' && m.fecha === 3).map(m => m.id),
    'r32': fixtures.matches.filter(m => m.stage === 'r32').map(m => m.id),
    'r16': fixtures.matches.filter(m => m.stage === 'r16').map(m => m.id),
    'qf':  fixtures.matches.filter(m => m.stage === 'qf').map(m => m.id),
    'sf':  fixtures.matches.filter(m => m.stage === 'sf').map(m => m.id),
    'third': fixtures.matches.filter(m => m.stage === 'third').map(m => m.id),
    'final': fixtures.matches.filter(m => m.stage === 'final').map(m => m.id),
  }
  return map[fechaId] || []
}

export const FECHA_LABELS = {
  'group-F1': 'Fecha 1',
  'group-F2': 'Fecha 2',
  'group-F3': 'Fecha 3',
  'r32': 'Dieciseisavos',
  'r16': 'Octavos',
  'qf': 'Cuartos',
  'sf': 'Semifinales',
  'third': '3er puesto',
  'final': 'Final',
}

export function formatKickoff(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  // Render in Bogotá time (COT, UTC-5) for the users
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function matchById(id) {
  return fixtures.matches.find(m => m.id === id)
}
