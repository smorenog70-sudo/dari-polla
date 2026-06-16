import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  TOURNAMENT,
  groupedMatches,
  formatKickoff,
} from '../lib/matches'

const TABS = [
  { id: 'F1', label: 'Fecha 1' },
  { id: 'F2', label: 'Fecha 2' },
  { id: 'F3', label: 'Fecha 3' },
  { id: 'r32', label: '16avos' },
  { id: 'r16', label: 'Octavos' },
  { id: 'qf', label: 'Cuartos' },
  { id: 'sf', label: 'Semis' },
  { id: 'third', label: '3er' },
  { id: 'final', label: 'Final' },
]

export default function AdminResults() {
  const { user } = useAuth()
  const [tab, setTab] = useState('F1')
  const [results, setResults] = useState({}) // match_id -> {score1, score2}
  const [original, setOriginal] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('results').select('*')
    const map = {}
    for (const r of data || []) map[r.match_id] = { score1: r.score1, score2: r.score2 }
    setResults(map)
    setOriginal(JSON.parse(JSON.stringify(map)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const matches = useMemo(() => {
    const all = groupedMatches()
    if (tab === 'F1') return all.group[1]
    if (tab === 'F2') return all.group[2]
    if (tab === 'F3') return all.group[3]
    if (tab === 'r32') return all.r32
    if (tab === 'r16') return all.r16
    if (tab === 'qf') return all.qf
    if (tab === 'sf') return all.sf
    if (tab === 'third') return all.third
    if (tab === 'final') return all.final
    return []
  }, [tab])

  const set = (id, field, val) => {
    const v = val === '' ? '' : Math.max(0, Math.min(30, parseInt(val) || 0))
    setResults(prev => ({ ...prev, [id]: { ...prev[id], [field]: v } }))
  }

  const clear = (id) => {
    setResults(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const dirty = useMemo(() => JSON.stringify(results) !== JSON.stringify(original), [results, original])

  const save = async () => {
    setSaving(true)
    setMsg('')
    const rows = []
    const deletions = []
    const matchIds = TOURNAMENT.matches.map(m => m.id)
    for (const id of matchIds) {
      const r = results[id]
      const o = original[id]
      if (r && r.score1 !== '' && r.score2 !== '' && r.score1 != null && r.score2 != null) {
        if (!o || o.score1 !== r.score1 || o.score2 !== r.score2) {
          rows.push({
            match_id: id,
            score1: Number(r.score1),
            score2: Number(r.score2),
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
        }
      } else if (o) {
        // deleted (cleared)
        deletions.push(id)
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('results').upsert(rows, { onConflict: 'match_id' })
      if (error) {
        setSaving(false)
        setMsg('❌ ' + error.message)
        return
      }
    }
    if (deletions.length > 0) {
      const { error } = await supabase.from('results').delete().in('match_id', deletions)
      if (error) {
        setSaving(false)
        setMsg('❌ ' + error.message)
        return
      }
    }
    setOriginal(JSON.parse(JSON.stringify(results)))
    setSaving(false)
    setMsg(`✅ Guardado (${rows.length} ↑ / ${deletions.length} ↓)`)
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Marcadores oficiales</h1>
        <p className="text-xs text-ink-300">
          Solo admins. Mete los resultados reales. Los puntos de la tabla se recalculan automáticamente.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 sticky top-14 bg-ink-900 z-20 py-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {matches.map(m => (
        <div key={m.id} className="card mb-2">
          <div className="flex items-center justify-between text-xs text-ink-300 mb-2">
            <span>{m.group ? `Grupo ${m.group} · ` : ''}{formatKickoff(m.kickoff_utc)}</span>
            {results[m.id] && (
              <button onClick={() => clear(m.id)} className="text-red-400 text-xs hover:underline">
                Limpiar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-right text-sm font-medium">{m.team1}</div>
            <input
              type="number" min="0" max="30" inputMode="numeric"
              value={results[m.id]?.score1 ?? ''}
              onChange={e => set(m.id, 'score1', e.target.value)}
              className="input w-14 text-center px-1 py-2"
              placeholder="-"
            />
            <span className="text-ink-500">:</span>
            <input
              type="number" min="0" max="30" inputMode="numeric"
              value={results[m.id]?.score2 ?? ''}
              onChange={e => set(m.id, 'score2', e.target.value)}
              className="input w-14 text-center px-1 py-2"
              placeholder="-"
            />
            <div className="flex-1 text-left text-sm font-medium">{m.team2}</div>
          </div>
        </div>
      ))}

      <div className="fixed bottom-16 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-2 pointer-events-auto">
          {msg && (
            <div className="flex-1 text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>
          )}
          <button onClick={save} disabled={!dirty || saving} className="btn-primary flex-1 shadow-lg">
            {saving ? 'Guardando…' : '💾 Guardar resultados'}
          </button>
        </div>
      </div>
    </div>
  )
}
