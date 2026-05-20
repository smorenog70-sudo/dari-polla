import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  TOURNAMENT,
  groupedMatches,
  formatKickoff,
  isMatchLocked,
} from '../lib/matches'
import { scoreMatch } from '../lib/scoring'

const TABS = [
  { id: 'F1', label: 'Fecha 1', stage: 'group', fecha: 1 },
  { id: 'F2', label: 'Fecha 2', stage: 'group', fecha: 2 },
  { id: 'F3', label: 'Fecha 3', stage: 'group', fecha: 3 },
  { id: 'r32', label: '16avos', stage: 'r32' },
  { id: 'r16', label: 'Octavos', stage: 'r16' },
  { id: 'qf', label: 'Cuartos', stage: 'qf' },
  { id: 'sf', label: 'Semis', stage: 'sf' },
  { id: 'third', label: '3er', stage: 'third' },
  { id: 'final', label: 'Final', stage: 'final' },
]

function MatchRow({ match, pred, actual, onChange, locked, knockoutsEnabled }) {
  const disabled = locked || (match.stage !== 'group' && !knockoutsEnabled)
  const points = pred && actual ? scoreMatch(pred, actual).total : null

  const set = (field, val) => {
    const v = val === '' ? '' : Math.max(0, Math.min(30, parseInt(val) || 0))
    onChange({ ...pred, [field]: v })
  }

  return (
    <div className="card mb-2">
      <div className="flex items-center justify-between text-xs text-ink-300 mb-2">
        <span>
          {match.group ? `Grupo ${match.group} · ` : ''}
          {formatKickoff(match.kickoff_utc)}
        </span>
        <span className="flex items-center gap-2">
          {locked && <span className="text-red-400">🔒</span>}
          {actual && (
            <span className="pill bg-green-700 text-white">
              FT {actual.score1}-{actual.score2}
            </span>
          )}
          {points != null && (
            <span className="pill bg-brand-600 text-white">+{points}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-right font-medium text-sm">{match.team1}</div>
        <input
          type="number"
          min="0"
          max="30"
          inputMode="numeric"
          value={pred?.score1 ?? ''}
          onChange={e => set('score1', e.target.value)}
          disabled={disabled}
          className="input w-14 text-center px-1 py-2"
          placeholder="-"
        />
        <span className="text-ink-500">:</span>
        <input
          type="number"
          min="0"
          max="30"
          inputMode="numeric"
          value={pred?.score2 ?? ''}
          onChange={e => set('score2', e.target.value)}
          disabled={disabled}
          className="input w-14 text-center px-1 py-2"
          placeholder="-"
        />
        <div className="flex-1 text-left font-medium text-sm">{match.team2}</div>
      </div>
      {match.stage !== 'group' && (
        <div className="text-[10px] text-ink-500 mt-1 text-center">
          {match.team1_raw !== match.team1 && `(${match.team1_raw} vs ${match.team2_raw})`}
        </div>
      )}
    </div>
  )
}

export default function Predictions() {
  const { user } = useAuth()
  const [tab, setTab] = useState('F1')
  const [preds, setPreds] = useState({})       // match_id -> {score1, score2}
  const [original, setOriginal] = useState({}) // last saved state
  const [results, setResults] = useState({})   // match_id -> {score1, score2}
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const [pRes, rRes, cRes] = await Promise.all([
      supabase.from('predictions').select('*').eq('user_id', user.id),
      supabase.from('results').select('*'),
      supabase.from('config').select('*'),
    ])
    const map = {}
    for (const p of pRes.data || []) map[p.match_id] = { score1: p.score1, score2: p.score2 }
    setPreds(map)
    setOriginal(JSON.parse(JSON.stringify(map)))

    const rmap = {}
    for (const r of rRes.data || []) rmap[r.match_id] = { score1: r.score1, score2: r.score2 }
    setResults(rmap)

    const cfg = {}
    for (const c of cRes.data || []) cfg[c.key] = c.value
    setConfig(cfg)
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

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

  const knockoutsEnabled = config.knockouts_enabled === true

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(preds), ...Object.keys(original)])
    for (const k of keys) {
      const a = preds[k]
      const b = original[k]
      if (!a && !b) continue
      if (!a || !b) return true
      if (a.score1 !== b.score1 || a.score2 !== b.score2) return true
    }
    return false
  }, [preds, original])

  const save = async () => {
    setSaving(true)
    setSavedMsg('')
    const rows = []
    for (const m of TOURNAMENT.matches) {
      const p = preds[m.id]
      if (!p || p.score1 === '' || p.score2 === '' || p.score1 == null || p.score2 == null) continue
      // skip if locked or knockouts disabled (don't write)
      if (isMatchLocked(m)) continue
      if (m.stage !== 'group' && !knockoutsEnabled) continue
      // only push if changed vs original
      const o = original[m.id]
      if (o && o.score1 === p.score1 && o.score2 === p.score2) continue
      rows.push({
        user_id: user.id,
        match_id: m.id,
        score1: Number(p.score1),
        score2: Number(p.score2),
        updated_at: new Date().toISOString(),
      })
    }
    if (rows.length === 0) {
      setSaving(false)
      setSavedMsg('Sin cambios')
      setTimeout(() => setSavedMsg(''), 2000)
      return
    }
    const { error } = await supabase
      .from('predictions')
      .upsert(rows, { onConflict: 'user_id,match_id' })
    setSaving(false)
    if (error) {
      setSavedMsg('❌ Error: ' + error.message)
    } else {
      setSavedMsg(`✅ Guardado (${rows.length})`)
      setOriginal(JSON.parse(JSON.stringify(preds)))
      setTimeout(() => setSavedMsg(''), 2500)
    }
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const knockoutTabs = ['r32', 'r16', 'qf', 'sf', 'third', 'final']
  const isKnockoutTab = knockoutTabs.includes(tab)

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">⚽ Pronósticos de partidos</h1>
        <p className="text-xs text-ink-300">
          Cada partido cierra 10 min antes del pitazo inicial.
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

      {isKnockoutTab && !knockoutsEnabled && (
        <div className="card bg-yellow-900/30 border-yellow-700/50 text-yellow-100 text-sm">
          🔒 Las predicciones de eliminatorias se habilitarán cuando terminen los grupos.
        </div>
      )}

      {matches.map(m => (
        <MatchRow
          key={m.id}
          match={m}
          pred={preds[m.id]}
          actual={results[m.id]}
          locked={isMatchLocked(m)}
          knockoutsEnabled={knockoutsEnabled}
          onChange={p => setPreds(prev => ({ ...prev, [m.id]: p }))}
        />
      ))}

      <div className="fixed bottom-16 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-2 pointer-events-auto">
          {savedMsg && (
            <div className="flex-1 text-sm text-center bg-ink-800 rounded-lg px-3 py-2">
              {savedMsg}
            </div>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary flex-1 shadow-lg"
          >
            {saving ? 'Guardando…' : dirty ? '💾 Guardar cambios' : 'Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
