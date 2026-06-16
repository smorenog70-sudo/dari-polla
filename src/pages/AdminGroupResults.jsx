import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TOURNAMENT } from '../lib/matches'

const LETTERS = 'ABCDEFGHIJKL'.split('')

export default function AdminGroupResults() {
  const [picks, setPicks] = useState({})
  const [original, setOriginal] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('group_results').select('*')
    const p = {}
    for (const r of data || []) {
      p[r.group_letter] ||= {}
      p[r.group_letter][r.team] = r.position
    }
    setPicks(p)
    setOriginal(JSON.parse(JSON.stringify(p)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const dirty = useMemo(() => JSON.stringify(picks) !== JSON.stringify(original), [picks, original])

  const set = (letter, team, pos) => {
    setPicks(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[letter] ||= {}
      if (pos != null) {
        for (const k of Object.keys(next[letter])) {
          if (next[letter][k] === pos && k !== team) delete next[letter][k]
        }
        next[letter][team] = pos
      } else {
        delete next[letter][team]
      }
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    const { error: delErr } = await supabase.from('group_results').delete().neq('group_letter', '')
    if (delErr) {
      setSaving(false)
      setMsg('❌ ' + delErr.message)
      return
    }
    const rows = []
    for (const [letter, teams] of Object.entries(picks)) {
      for (const [team, pos] of Object.entries(teams)) {
        if (pos) rows.push({ group_letter: letter, team, position: pos })
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('group_results').insert(rows)
      if (error) {
        setSaving(false)
        setMsg('❌ ' + error.message)
        return
      }
    }
    setOriginal(JSON.parse(JSON.stringify(picks)))
    setSaving(false)
    setMsg(`✅ Guardado (${rows.length})`)
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Posiciones finales de grupo</h1>
        <p className="text-xs text-ink-300">
          Mete el orden real (1º a 4º) de cada grupo cuando termine la fase de grupos.
        </p>
      </div>

      {LETTERS.map(letter => {
        const teams = TOURNAMENT.groups[letter] || []
        const used = new Map()
        for (const [t, p] of Object.entries(picks[letter] || {})) used.set(p, t)
        return (
          <div key={letter} className="card mb-3">
            <h3 className="font-semibold mb-2">Grupo {letter}</h3>
            <div className="space-y-2">
              {teams.map(t => (
                <div key={t} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{t}</span>
                  <select
                    value={picks[letter]?.[t] || ''}
                    onChange={e => set(letter, t, e.target.value ? Number(e.target.value) : null)}
                    className="input w-20 text-center py-1"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4].map(p => {
                      const taken = used.get(p)
                      const isMine = picks[letter]?.[t] === p
                      return (
                        <option key={p} value={p} disabled={taken && !isMine}>
                          {p}º
                        </option>
                      )
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )
      })}

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
