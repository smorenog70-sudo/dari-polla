import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  TOURNAMENT,
  groupedMatches,
  formatKickoff,
} from '../lib/matches'
import { resolveTeam, autoResolveGroupPositions } from '../lib/bracketTeams'
import { computeGroupTables } from '../lib/groupTables'
import { liveStatus } from '../lib/liveStatus'
import { useNowTick } from '../lib/useNowTick'

const TABS = [
  { id: 'today', label: '⚡ Hoy' },
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
  const [tab, setTab] = useState('today')
  const nowMs = useNowTick(30000) // refresca el estado "en vivo" cada 30s
  const [results, setResults] = useState({}) // match_id -> {score1, score2}
  const [original, setOriginal] = useState({})
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('results').select('*')
    const map = {}
    for (const r of data || []) map[r.match_id] = { score1: r.score1, score2: r.score2, advances: r.advances ?? null }
    setResults(map)
    setOriginal(JSON.parse(JSON.stringify(map)))
    // Cargar config para resolver nombres de playoffs (bracket_teams)
    const { data: cfg } = await supabase.from('config').select('*')
    const cfgMap = {}
    for (const c of cfg || []) cfgMap[c.key] = c.value
    setConfig(cfgMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Resolver nombres de playoffs: auto de grupos cerrados + manual del admin
  const bracketTeams = useMemo(() => {
    const resultsById = new Map(Object.entries(results).map(([id, r]) => [id, r]))
    const gt = computeGroupTables(resultsById)
    const auto = autoResolveGroupPositions(gt)
    return { ...auto, ...(config.bracket_teams || {}) }
  }, [results, config.bracket_teams])

  const teamName = (m, side) => {
    if (m.stage === 'group') return m[side]
    const raw = side === 'team1' ? (m.team1_raw || m.team1) : (m.team2_raw || m.team2)
    return resolveTeam(raw, bracketTeams)
  }

  const matches = useMemo(() => {
    const all = groupedMatches()
    if (tab === 'today') {
      // Partidos cuyo kickoff es HOY (hora local), ordenados por hora
      const todayKey = new Date().toLocaleDateString('en-CA')
      return TOURNAMENT.matches
        .filter(m => m.kickoff_utc && new Date(m.kickoff_utc).toLocaleDateString('en-CA') === todayKey)
        .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))
    }
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

  const setAdvances = (id, who) => {
    setResults(prev => ({
      ...prev,
      [id]: { ...prev[id], advances: prev[id]?.advances === who ? null : who },
    }))
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
        const m = TOURNAMENT.matches.find(x => x.id === id)
        // Quién pasó efectivo: lo fuerza el marcador salvo empate a 90 (tiempo extra o penales)
        let effectiveAdvances = null
        if (m && m.stage !== 'group') {
          const a = Number(r.score1), b = Number(r.score2)
          if (a > b) effectiveAdvances = 'team1'
          else if (b > a) effectiveAdvances = 'team2'
          else effectiveAdvances = r.advances ?? null
        }
        if (!o || o.score1 !== r.score1 || o.score2 !== r.score2 || (o.advances ?? null) !== effectiveAdvances) {
          rows.push({
            match_id: id,
            score1: Number(r.score1),
            score2: Number(r.score2),
            advances: effectiveAdvances,
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
            <span className="flex items-center gap-1.5">
              {m.group ? `Grupo ${m.group} · ` : ''}{formatKickoff(m.kickoff_utc)}
              {(() => {
                const st = liveStatus(m.kickoff_utc, nowMs)
                if (st && st.live && !results[m.id]) {
                  return (
                    <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                      {st.label}
                    </span>
                  )
                }
                return null
              })()}
            </span>
            {results[m.id] && (
              <button onClick={() => clear(m.id)} className="text-red-400 text-xs hover:underline">
                Limpiar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-right text-sm font-medium">{teamName(m, 'team1')}</div>
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
            <div className="flex-1 text-left text-sm font-medium">{teamName(m, 'team2')}</div>
          </div>

          {/* PLAYOFFS: quién pasó (cubre tiempo extra o penales). Solo en eliminación. */}
          {m.stage !== 'group' && (() => {
            const r = results[m.id]
            const s1 = r?.score1, s2 = r?.score2
            const bothFilled = s1 !== '' && s2 !== '' && s1 != null && s2 != null
            const isDraw = bothFilled && Number(s1) === Number(s2)
            const forced = bothFilled && !isDraw
              ? (Number(s1) > Number(s2) ? 'team1' : 'team2')
              : null
            const effective = forced || (isDraw ? r?.advances : null)
            const enabled = isDraw
            const btnClass = (who) => `flex-1 text-xs py-1.5 rounded-lg border transition ${
              effective === who
                ? 'bg-green-700 border-green-500 text-white font-semibold'
                : 'bg-ink-800 border-ink-600 text-ink-300'
            } ${!enabled ? 'cursor-default opacity-90' : ''}`
            return (
              <div className="mt-2 bg-ink-900/40 rounded-lg p-2">
                <div className="text-[10px] text-ink-400 text-center mb-1.5">
                  ¿Quién pasó? <span className="text-ink-500">(+10 pts; elige solo si empataron a los 90)</span>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" disabled={!enabled} onClick={() => enabled && setAdvances(m.id, 'team1')} className={btnClass('team1')}>
                    {teamName(m, 'team1')}
                  </button>
                  <button type="button" disabled={!enabled} onClick={() => enabled && setAdvances(m.id, 'team2')} className={btnClass('team2')}>
                    {teamName(m, 'team2')}
                  </button>
                </div>
                {!bothFilled ? (
                  <div className="text-[10px] text-ink-500 text-center mt-1.5">Pon el marcador de 90 min primero.</div>
                ) : forced ? (
                  <div className="text-[10px] text-ink-500 text-center mt-1.5">Lo define el marcador.</div>
                ) : (
                  <div className="text-[10px] text-yellow-300 text-center mt-1.5">⚖️ Empate a los 90: marca quién pasó (en tiempo extra o penales).</div>
                )}
              </div>
            )
          })()}
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
