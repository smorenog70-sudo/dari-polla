import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TOURNAMENT } from '../lib/matches'

const LETTERS = 'ABCDEFGHIJKL'.split('')
const TARGET = 8

export default function AdminThirds() {
  const [picks, setPicks] = useState(new Set())
  const [original, setOriginal] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('third_results').select('team')
    const s = new Set((data || []).map(r => r.team))
    setPicks(s)
    setOriginal(new Set(s))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const allTeams = useMemo(() => {
    const arr = []
    for (const l of LETTERS) for (const t of TOURNAMENT.groups[l] || []) arr.push({ team: t, group: l })
    arr.sort((a, b) => a.team.localeCompare(b.team, 'es'))
    return arr
  }, [])

  const dirty = useMemo(() => {
    if (picks.size !== original.size) return true
    for (const t of picks) if (!original.has(t)) return true
    return false
  }, [picks, original])

  const toggle = (t) => {
    setPicks(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    const { error: delErr } = await supabase.from('third_results').delete().neq('team', '')
    if (delErr) {
      setSaving(false)
      setMsg('❌ ' + delErr.message)
      return
    }
    const rows = Array.from(picks).map(team => ({ team }))
    if (rows.length > 0) {
      const { error } = await supabase.from('third_results').insert(rows)
      if (error) {
        setSaving(false)
        setMsg('❌ ' + error.message)
        return
      }
    }
    setOriginal(new Set(picks))
    setSaving(false)
    setMsg(`✅ Guardado (${rows.length})`)
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Mejores terceros reales</h1>
        <p className="text-xs text-ink-300">
          Marca los 8 equipos que clasificaron como mejor tercero. {picks.size} / {TARGET}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {allTeams.map(({ team, group }) => {
          const selected = picks.has(team)
          return (
            <button
              key={team}
              onClick={() => toggle(team)}
              className={`p-3 rounded-lg text-sm text-left border ${
                selected ? 'bg-brand-600 border-brand-500 text-white' : 'bg-ink-800 border-ink-700'
              }`}
            >
              <div className="font-medium">{team}</div>
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
          <button onClick={save} disabled={!dirty || saving} className="btn-primary flex-1 shadow-lg">
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
