import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TOURNAMENT } from '../lib/matches'
import { teamWithFlag } from '../lib/flags'

const LETTERS = 'ABCDEFGHIJKL'.split('')
const MAX_THIRDS = 8

export default function ThirdsPredictions() {
  const { user } = useAuth()
  const [picks, setPicks] = useState(new Set())
  const [original, setOriginal] = useState(new Set())
  const [actuals, setActuals] = useState(new Set())
  const [locked, setLocked] = useState(false)
  const [predictionsLocked, setPredictionsLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const [tp, tr, cfg] = await Promise.all([
      supabase.from('third_predictions').select('team').eq('user_id', user.id),
      supabase.from('third_results').select('team'),
      supabase.from('config').select('*'),
    ])
    const p = new Set((tp.data || []).map(r => r.team))
    setPicks(p)
    setOriginal(new Set(p))
    setActuals(new Set((tr.data || []).map(r => r.team)))
    const cfgMap = {}
    for (const r of cfg.data || []) cfgMap[r.key] = r.value
    const lockedByAdmin = cfgMap.predictions_locked === true
    setPredictionsLocked(lockedByAdmin)
    setLocked(cfgMap.knockouts_enabled === true || lockedByAdmin)
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  const allTeams = useMemo(() => {
    const arr = []
    for (const l of LETTERS) for (const t of TOURNAMENT.groups[l] || []) arr.push({ team: t, group: l })
    arr.sort((a, b) => a.team.localeCompare(b.team, 'es'))
    return arr
  }, [])

  const toggle = (t) => {
    if (locked) return
    setPicks(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else {
        if (next.size >= MAX_THIRDS) return prev
        next.add(t)
      }
      return next
    })
  }

  const dirty = useMemo(() => {
    if (picks.size !== original.size) return true
    for (const t of picks) if (!original.has(t)) return true
    return false
  }, [picks, original])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const { error: delErr } = await supabase
      .from('third_predictions').delete().eq('user_id', user.id)
    if (delErr) {
      setSaving(false)
      setMsg('❌ ' + delErr.message)
      return
    }
    const rows = Array.from(picks).map(team => ({ user_id: user.id, team }))
    if (rows.length > 0) {
      const { error } = await supabase.from('third_predictions').insert(rows)
      if (error) {
        setSaving(false)
        setMsg('❌ ' + error.message)
        return
      }
    }
    setOriginal(new Set(picks))
    setSaving(false)
    setMsg(`✅ Guardado (${rows.length}/8)`)
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🥉 Mejores terceros</h1>
        <p className="text-xs text-ink-300">
          Elige los <strong>8 equipos</strong> que crees clasificarán como mejor tercero.
          <strong> 5 pts</strong> por cada acierto.
        </p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>Seleccionados:</span>
          <span className="font-bold text-brand-500">{picks.size} / {MAX_THIRDS}</span>
        </div>
        {locked && (
          <div className="mt-2 text-xs text-yellow-300">
            {predictionsLocked
              ? '🔒 Bloqueado temporalmente por el administrador.'
              : '🔒 Bloqueado: la fase de grupos ya terminó.'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {allTeams.map(({ team, group }) => {
          const selected = picks.has(team)
          const isActual = actuals.has(team)
          const correct = selected && isActual
          const missed = isActual && !selected
          return (
            <button
              key={team}
              onClick={() => toggle(team)}
              disabled={locked || (!selected && picks.size >= MAX_THIRDS)}
              className={`p-3 rounded-lg text-sm text-left border transition ${
                correct ? 'bg-green-700/40 border-green-500' :
                selected ? 'bg-brand-600 border-brand-500 text-white' :
                missed ? 'bg-red-900/30 border-red-700' :
                'bg-ink-800 border-ink-700'
              } ${locked || (!selected && picks.size >= MAX_THIRDS) ? 'opacity-60' : ''}`}
            >
              <div className="font-medium">{teamWithFlag(team)}</div>
              <div className="text-xs opacity-70">Grupo {group}</div>
            </button>
          )
        })}
      </div>

      <div className="fixed bottom-16 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-2 pointer-events-auto">
          {msg && (
            <div className="flex-1 text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving || locked}
            className="btn-primary flex-1 shadow-lg"
          >
            {saving ? 'Guardando…' : dirty ? '💾 Guardar' : 'Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
