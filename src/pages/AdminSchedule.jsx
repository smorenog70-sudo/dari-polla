import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, originalKickoff, applyKickoffOverrides, formatKickoff } from '../lib/matches'
import { buildResolver } from '../lib/bracketTeams'
import { teamWithFlag } from '../lib/flags'

// Bogotá es UTC-5 fijo (sin horario de verano). Editamos en hora de Bogotá,
// que es la que ven los usuarios, y guardamos en UTC ISO.
const BOGOTA_OFFSET_MIN = -5 * 60
const pad = n => String(n).padStart(2, '0')

function isoToBogotaInput(iso) {
  if (!iso) return ''
  const shifted = new Date(new Date(iso).getTime() + BOGOTA_OFFSET_MIN * 60000)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

function bogotaInputToIso(v) {
  if (!v) return null
  const [datePart, timePart] = v.split('T')
  const [y, mo, da] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const utcMs = Date.UTC(y, mo - 1, da, h, mi) - BOGOTA_OFFSET_MIN * 60000
  return new Date(utcMs).toISOString()
}

const sameInstant = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime()

function prettyTeam(raw, resolved) {
  if (resolved && !/^[0-9WL]/.test(resolved)) return teamWithFlag(resolved)
  if (/^W\d+/.test(raw || '')) return `Ganador ${raw.slice(1)}`
  if (/^L\d+/.test(raw || '')) return `Perdedor ${raw.slice(1)}`
  return raw || '?'
}

const TABS = [
  { id: 'ko', label: 'Eliminación' },
  { id: 'group', label: 'Fase de grupos' },
]

export default function AdminSchedule() {
  const data = useLeagueData()
  const { resolveMatch } = useMemo(() => buildResolver(data), [data.results, data.config])
  const [tab, setTab] = useState('ko')
  const [times, setTimes] = useState(() => ({ ...(data.config?.match_times || {}) }))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Si se entra directo a esta URL con la data aún cargando, sincroniza los
  // overrides guardados una vez que la config esté disponible.
  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current && !data.loading) {
      initialized.current = true
      setTimes({ ...(data.config?.match_times || {}) })
    }
  }, [data.loading, data.config])

  const matches = useMemo(() => {
    return TOURNAMENT.matches
      .filter(m => (tab === 'group' ? m.stage === 'group' : m.stage !== 'group'))
      .map(m => ({ ...m, resolved: resolveMatch(m) }))
      .sort((a, b) => new Date(originalKickoff(a.id)) - new Date(originalKickoff(b.id)))
  }, [tab, resolveMatch])

  const setTime = (id, val) => {
    setTimes(prev => ({ ...prev, [id]: bogotaInputToIso(val) }))
  }
  const resetTime = (id) => {
    setTimes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const dirty = useMemo(() => {
    const orig = data.config?.match_times || {}
    const keys = new Set([...Object.keys(times), ...Object.keys(orig)])
    for (const k of keys) {
      if (!sameInstant(times[k], orig[k]) && !(times[k] == null && orig[k] == null)) return true
    }
    return false
  }, [times, data.config])

  const save = async () => {
    setSaving(true)
    setMsg('')
    // Solo guardamos overrides que realmente difieren del horario original.
    const pruned = {}
    for (const [id, iso] of Object.entries(times)) {
      if (iso && !sameInstant(iso, originalKickoff(id))) pruned[id] = iso
    }
    const { error } = await supabase
      .from('config').upsert([{ key: 'match_times', value: pruned }], { onConflict: 'key' })
    if (error) {
      setSaving(false)
      setMsg('❌ ' + error.message)
      return
    }
    applyKickoffOverrides(pruned)
    await data.refresh()
    setTimes({ ...pruned })
    setSaving(false)
    setMsg('✅ Horarios guardados')
    setTimeout(() => setMsg(''), 2500)
  }

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🕐 Horarios de los partidos</h1>
        <p className="text-xs text-ink-300">
          Los horarios vienen predeterminados. Si alguno está mal, cámbialo aquí (en hora de Colombia)
          y afectará el cierre de predicciones y todo lo que dependa de la hora del partido.
        </p>
      </div>

      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {matches.map(m => {
          const effective = times[m.id] ?? originalKickoff(m.id)
          const overridden = times[m.id] != null && !sameInstant(times[m.id], originalKickoff(m.id))
          return (
            <div key={m.id} className={`card ${overridden ? 'border-brand-600/60' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-sm font-medium truncate">
                  {prettyTeam(m.team1_raw || m.team1, m.resolved.team1)}
                  <span className="text-ink-500 text-xs"> vs </span>
                  {prettyTeam(m.team2_raw || m.team2, m.resolved.team2)}
                </div>
                {overridden && <span className="pill bg-brand-600 text-white text-[10px] shrink-0">editado</span>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={isoToBogotaInput(effective)}
                  onChange={e => setTime(m.id, e.target.value)}
                  className="input flex-1 text-sm"
                />
                {overridden && (
                  <button
                    onClick={() => resetTime(m.id)}
                    className="px-2 py-2 rounded-lg bg-ink-700 text-ink-200 text-sm shrink-0"
                    title="Restablecer al horario predeterminado"
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className="text-[10px] text-ink-500 mt-1">
                {formatKickoff(effective)}
                {overridden && <span className="text-brand-400"> · predeterminado: {formatKickoff(originalKickoff(m.id))}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="fixed bottom-16 inset-x-0 px-4 z-30 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-2 pointer-events-auto">
          {msg && <div className="flex-1 text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}
          <button onClick={save} disabled={!dirty || saving} className="btn-primary flex-1 shadow-lg">
            {saving ? 'Guardando…' : dirty ? '💾 Guardar horarios' : 'Sin cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
