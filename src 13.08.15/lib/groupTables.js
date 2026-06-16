import { TOURNAMENT } from './matches'

/**
 * Calcula la tabla REAL de cada grupo del Mundial a partir de los resultados
 * oficiales que el admin va metiendo. Nada de API externa.
 *
 * Reglas FIFA de puntos: victoria 3, empate 1, derrota 0.
 * Desempate (simplificado): puntos → diferencia de gol → goles a favor.
 *
 * @param resultsById - Map<match_id, {score1, score2}>
 * @returns { groups: { A: [team rows...], B: [...] }, order: ['A','B',...] }
 */
export function computeGroupTables(resultsById) {
  const groupsData = TOURNAMENT.groups || {}
  const order = Object.keys(groupsData).sort()

  // Inicializar estadísticas por equipo dentro de cada grupo
  const stats = {} // group -> team -> {...}
  for (const g of order) {
    stats[g] = {}
    for (const team of groupsData[g]) {
      stats[g][team] = {
        team, played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      }
    }
  }

  // Recorrer partidos de fase de grupos con resultado
  for (const m of TOURNAMENT.matches) {
    if (m.stage !== 'group' || !m.group) continue
    const r = resultsById.get(m.id)
    if (!r) continue
    const g = m.group
    const t1 = stats[g]?.[m.team1]
    const t2 = stats[g]?.[m.team2]
    if (!t1 || !t2) continue

    const s1 = r.score1, s2 = r.score2
    t1.played++; t2.played++
    t1.gf += s1; t1.ga += s2
    t2.gf += s2; t2.ga += s1

    if (s1 > s2) { t1.won++; t1.points += 3; t2.lost++ }
    else if (s1 < s2) { t2.won++; t2.points += 3; t1.lost++ }
    else { t1.drawn++; t2.drawn++; t1.points++; t2.points++ }
  }

  // Calcular diferencia de gol y ordenar
  const result = {}
  for (const g of order) {
    const rows = Object.values(stats[g])
    for (const r of rows) r.gd = r.gf - r.ga
    rows.sort((a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
    )
    rows.forEach((r, i) => { r.pos = i + 1 })
    result[g] = rows
  }

  return { groups: result, order }
}

/**
 * Para un grupo, calcula escenarios simples de clasificación.
 * En el Mundial 2026 clasifican los 2 primeros de cada grupo + mejores terceros.
 * Devuelve para cada equipo un estado: 'clasificado', 'eliminado', 'depende', 'lider'...
 *
 * Lógica honesta y simple (sin simular todos los cruces):
 * - Si el grupo terminó (todos jugaron sus 3): top 2 = clasificados directos,
 *   3º = posible mejor tercero (depende de otros grupos), 4º = eliminado.
 * - Si el grupo va a mitad: marcamos quién tiene ventaja pero todo "en juego".
 */
export function groupScenarios(groupRows) {
  const totalTeams = groupRows.length
  // ¿Cuántos partidos se han jugado del grupo? (cada equipo juega 3)
  const allPlayed = groupRows.every(r => r.played >= 3)
  const anyPlayed = groupRows.some(r => r.played > 0)
  const maxPlayed = Math.max(...groupRows.map(r => r.played), 0)

  return groupRows.map((r, idx) => {
    let status, note
    if (!anyPlayed) {
      status = 'pending'; note = 'Aún no empieza'
    } else if (allPlayed) {
      if (idx === 0) { status = 'qualified'; note = '1° · Clasificado 🟢' }
      else if (idx === 1) { status = 'qualified'; note = '2° · Clasificado 🟢' }
      else if (idx === 2) { status = 'maybe'; note = '3° · Posible mejor tercero 🟡' }
      else { status = 'eliminated'; note = 'Eliminado 🔴' }
    } else {
      // Grupo en curso: damos una lectura de tendencia, sin asegurar nada
      const matchesLeft = 3 - r.played
      if (idx <= 1) {
        status = 'leading'
        note = `Va ${r.pos}° · ${matchesLeft} ${matchesLeft === 1 ? 'partido' : 'partidos'} por jugar`
      } else if (idx === 2) {
        status = 'bubble'
        note = `Va 3° · peleando la clasificación`
      } else {
        status = 'trailing'
        note = `Va ${r.pos}° · necesita reaccionar`
      }
    }
    return { ...r, status, note }
  })
}
