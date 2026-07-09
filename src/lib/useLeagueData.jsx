import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { applyKickoffOverrides } from './matches'

/**
 * Trae TODAS las filas de una tabla, paginando de a 1000.
 * Supabase limita cada select a 1000 filas por defecto; sin esto,
 * con muchos usuarios las predicciones se cargaban incompletas y
 * algunos jugadores no recibían sus puntos (bug de "a unos sí, a otros no").
 */
async function fetchAll(table, selectCols = '*') {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error(`Error cargando ${table}:`, error.message)
      break
    }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break  // última página
    from += PAGE
  }
  return all
}

const EMPTY_STATE = {
  profiles: [],
  predictions: [],
  results: [],
  groupPreds: [],
  groupResults: [],
  thirdPreds: [],
  thirdResults: [],
  podiumPreds: [],
  fines: [],
  config: {},
  loading: true,
}

const LeagueDataContext = createContext(null)

/**
 * Carga TODA la data de la liga (9 tablas) una sola vez y la comparte
 * entre todos los componentes que la consumen (vía contexto).
 *
 * Antes cada componente que llamaba a useLeagueData() disparaba su propia
 * carga completa e independiente: como Layout (LiveSimulatorButton), Home,
 * y varias páginas más se montan juntos, una sola vista podía disparar
 * 2-3 cargas completas simultáneas de las 9 tablas. Con el Provider
 * centralizado se hace UNA sola carga que todos comparten.
 */
export function LeagueDataProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE)

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }))
    const [profiles, preds, results, gp, gr, tp, tr, pp, fines, cfgRows] = await Promise.all([
      fetchAll('profiles'),
      fetchAll('predictions'),
      fetchAll('results'),
      fetchAll('group_predictions'),
      fetchAll('group_results'),
      fetchAll('third_predictions'),
      fetchAll('third_results'),
      fetchAll('podium_predictions'),
      fetchAll('fines'),
      fetchAll('config'),
    ])

    const config = {}
    for (const r of cfgRows || []) config[r.key] = r.value

    // Aplica los horarios que el admin haya sobreescrito (antes de que los
    // componentes vuelvan a renderizar con la data ya cargada).
    applyKickoffOverrides(config.match_times || {})

    setState({
      profiles: profiles || [],
      predictions: preds || [],
      results: results || [],
      groupPreds: gp || [],
      groupResults: gr || [],
      thirdPreds: tp || [],
      thirdResults: tr || [],
      podiumPreds: pp || [],
      fines: fines || [],
      config,
      loading: false,
    })
  }, [])

  useEffect(() => { load() }, [load])

  const value = { ...state, refresh: load }
  return <LeagueDataContext.Provider value={value}>{children}</LeagueDataContext.Provider>
}

/**
 * Lee la data de la liga cargada por <LeagueDataProvider>. Debe usarse
 * dentro del Provider (montado una vez en App.jsx, alrededor del Layout).
 */
export function useLeagueData() {
  const ctx = useContext(LeagueDataContext)
  if (!ctx) {
    throw new Error('useLeagueData debe usarse dentro de <LeagueDataProvider>')
  }
  return ctx
}
