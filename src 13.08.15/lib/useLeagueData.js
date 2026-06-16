import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

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

/**
 * Loads all the data needed for the standings / overview screens.
 */
export function useLeagueData() {
  const [state, setState] = useState({
    profiles: [],
    predictions: [],
    results: [],
    groupPreds: [],
    groupResults: [],
    thirdPreds: [],
    thirdResults: [],
    fines: [],
    config: {},
    loading: true,
  })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }))
    const [profiles, preds, results, gp, gr, tp, tr, fines, cfgRows] = await Promise.all([
      fetchAll('profiles'),
      fetchAll('predictions'),
      fetchAll('results'),
      fetchAll('group_predictions'),
      fetchAll('group_results'),
      fetchAll('third_predictions'),
      fetchAll('third_results'),
      fetchAll('fines'),
      fetchAll('config'),
    ])

    const config = {}
    for (const r of cfgRows || []) config[r.key] = r.value

    setState({
      profiles: profiles || [],
      predictions: preds || [],
      results: results || [],
      groupPreds: gp || [],
      groupResults: gr || [],
      thirdPreds: tp || [],
      thirdResults: tr || [],
      fines: fines || [],
      config,
      loading: false,
    })
  }, [])

  useEffect(() => { load() }, [load])

  return { ...state, refresh: load }
}
