import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

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
    const [profiles, preds, results, gp, gr, tp, tr, fines, cfg] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('predictions').select('*'),
      supabase.from('results').select('*'),
      supabase.from('group_predictions').select('*'),
      supabase.from('group_results').select('*'),
      supabase.from('third_predictions').select('*'),
      supabase.from('third_results').select('*'),
      supabase.from('fines').select('*'),
      supabase.from('config').select('*'),
    ])

    const config = {}
    for (const r of cfg.data || []) config[r.key] = r.value

    setState({
      profiles: profiles.data || [],
      predictions: preds.data || [],
      results: results.data || [],
      groupPreds: gp.data || [],
      groupResults: gr.data || [],
      thirdPreds: tp.data || [],
      thirdResults: tr.data || [],
      fines: fines.data || [],
      config,
      loading: false,
    })
  }, [])

  useEffect(() => { load() }, [load])

  return { ...state, refresh: load }
}
