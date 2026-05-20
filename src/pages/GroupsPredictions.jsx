import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TOURNAMENT } from '../lib/matches'

const LETTERS = 'ABCDEFGHIJKL'.split('')

function GroupCard({ letter, teams, picks, actuals, onChange, locked }) {
  // picks: { team -> position 1..4 }
  const used = new Map() // position -> team
  for (const [team, pos] of Object.entries(picks)) used.set(pos, team)

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Grupo {letter}</h3>
        {locked && <span className="text-xs text-red-400">🔒 Bloqueado</span>}
      </div>
      <div className="space-y-2">
        {teams.map(t => {
          const actualPos = actuals[t]
          const hit = actualPos && picks[t] === actualPos
          const wrong = actualPos && picks[t] && picks[t] !== actualPos
          return (
            <div key={t} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{t}</span>
              {actualPos && (
                <span className="text-xs text-ink-500">Real: {actualPos}º</span>
              )}
              <select
                value={picks[t] || ''}
                onChange={e => onChange(t, e.target.value ? Number(e.target.value) : null)}
                disabled={locked}
                className={`input w-20 text-center py-1 ${
                  hit ? 'border-green-500 ring-1 ring-green-500' :
                  wrong ? 'border-red-500' : ''
                }`}
              >
                <option value="">—</option>
                {[1, 2, 3, 4].map(p => {
                  const taken = used.get(p)
                  const isMine = picks[t] === p
                  return (
                    <option key={p} value={p} disabled={taken && !isMine}>
                      {p}º
                    </option>
                  )
                })}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GroupsPredictions() {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})    // letter -> { team -> position }
  const [original, setOriginal] = useState({})
  const [actuals, setActuals] = useState({}) // letter -> { team -> position }
  const [knockoutsEnabled, setKnockoutsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const [gp, gr, cfg] = await Promise.all([
      supabase.from('group_predictions').select('*').eq('user_id', user.id),
      supabase.from('group_results').select('*'),
      supabase.from('config').select('*').eq('key', 'knockouts_enabled').maybeSingle(),
    ])
    const p = {}
    for (const r of gp.data || []) {
      p[r.group_letter] ||= {}
      p[r.group_letter][r.team] = r.position
    }
    setPicks(p)
    setOriginal(JSON.parse(JSON.stringify(p)))

    const a = {}
    for (const r of gr.data || []) {
      a[r.group_letter] ||= {}
      a[r.group_letter][r.team] = r.position
    }
    setActuals(a)

    setKnockoutsEnabled(cfg.data?.value === true)
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  // Lock once knockouts enabled OR first group match is locked (within 10 min).
  // For simplicity: when knockouts_enabled is true, group predictions are frozen.
  const locked = knockoutsEnabled

  const dirty = useMemo(() => JSON.stringify(picks) !== JSON.stringify(original), [picks, original])

  const setPick = (letter, team, pos) => {
    setPicks(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[letter] ||= {}
      // unset whatever team was at that position
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
    if (locked) return
    setSaving(true)
    setMsg('')
    // Strategy: delete all rows for user, then insert current
    const { error: delErr } = await supabase
      .from('group_predictions')
      .delete()
      .eq('user_id', user.id)
    if (delErr) {
      setSaving(false)
      setMsg('❌ ' + delErr.message)
      return
    }
    const rows = []
    for (const [letter, teams] of Object.entries(picks)) {
      for (const [team, pos] of Object.entries(teams)) {
        if (pos) rows.push({ user_id: user.id, group_letter: letter, team, position: pos })
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('group_predictions').insert(rows)
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
        <h1 className="text-xl font-bold mb-1">🅰️ Posición final de los grupos</h1>
        <p className="text-xs text-ink-300">
          Predice el orden 1º a 4º de cada grupo. <strong>5 puntos</strong> por cada posición exacta.
        </p>
        {locked && (
          <div className="mt-2 text-xs text-yellow-300">
            🔒 Bloqueado: la fase de grupos ya terminó.
          </div>
        )}
      </div>

      {LETTERS.map(letter => (
        <GroupCard
          key={letter}
          letter={letter}
          teams={TOURNAMENT.groups[letter] || []}
          picks={picks[letter] || {}}
          actuals={actuals[letter] || {}}
          locked={locked}
          onChange={(team, pos) => setPick(letter, team, pos)}
        />
      ))}

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
