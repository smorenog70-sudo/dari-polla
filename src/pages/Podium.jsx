import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { teamWithFlag } from '../lib/flags'
import { scorePodium, PODIUM_POINTS } from '../lib/scoring'
import {
  octavosTeams, actualPodium, podiumLocked, podiumCloseAt,
  PODIUM_LABELS, PODIUM_KEYS,
} from '../lib/podium'
import { formatKickoff } from '../lib/matches'

const EMPTY = { champion: '', runner_up: '', third_place: '', fourth_place: '' }

export default function Podium() {
  const { user } = useAuth()
  const data = useLeagueData()
  const [picks, setPicks] = useState(EMPTY)
  const [original, setOriginal] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    supabase.from('podium_predictions').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data: row }) => {
        if (!alive || !row) return
        const clean = {
          champion: row.champion || '',
          runner_up: row.runner_up || '',
          third_place: row.third_place || '',
          fourth_place: row.fourth_place || '',
        }
        setPicks(clean)
        setOriginal(clean)
      })
    return () => { alive = false }
  }, [user.id])

  const teams = useMemo(() => octavosTeams(data), [data])
  const actual = useMemo(() => actualPodium(data), [data])
  const locked = podiumLocked()
  const closeAt = podiumCloseAt()

  const scored = useMemo(() => scorePodium(picks, actual), [picks, actual])
  const hasRealPodium = PODIUM_KEYS.some(k => actual[k])

  const dirty = PODIUM_KEYS.some(k => picks[k] !== original[k])

  const setPos = (key, val) => {
    if (locked) return
    setPicks(prev => {
      const next = { ...prev, [key]: val }
      // Un mismo equipo no puede ocupar dos puestos: si ya estaba en otro, lo libera.
      if (val) {
        for (const k of PODIUM_KEYS) {
          if (k !== key && next[k] === val) next[k] = ''
        }
      }
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    const row = {
      user_id: user.id,
      champion: picks.champion || null,
      runner_up: picks.runner_up || null,
      third_place: picks.third_place || null,
      fourth_place: picks.fourth_place || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('podium_predictions').upsert(row, { onConflict: 'user_id' })
    if (error) {
      setSaving(false)
      setMsg('❌ ' + error.message)
      return
    }
    setOriginal({ ...picks })
    setSaving(false)
    setMsg('✅ Podio guardado')
    setTimeout(() => setMsg(''), 2500)
  }

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏅 Podio final</h1>
        <p className="text-xs text-ink-300">
          Elige quién termina <strong>campeón, subcampeón, 3er y 4to puesto</strong> del Mundial.
          Solo cuenta la <strong>posición exacta</strong>.
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-300">
          <li className="flex justify-between"><span>🥇 Campeón</span><span className="font-mono text-brand-400">+{PODIUM_POINTS.champion}</span></li>
          <li className="flex justify-between"><span>🥈 Subcampeón</span><span className="font-mono text-brand-400">+{PODIUM_POINTS.runner_up}</span></li>
          <li className="flex justify-between"><span>🥉 3er puesto</span><span className="font-mono text-brand-400">+{PODIUM_POINTS.third_place}</span></li>
          <li className="flex justify-between"><span>🎖️ 4to puesto</span><span className="font-mono text-brand-400">+{PODIUM_POINTS.fourth_place}</span></li>
        </ul>
        {locked ? (
          <div className="mt-2 text-xs text-yellow-300">
            🔒 Cerrado: los octavos ya arrancaron. Tu podio quedó fijo.
          </div>
        ) : closeAt ? (
          <div className="mt-2 text-xs text-brand-300">
            ⏱️ Cierra al arrancar octavos: <strong>{formatKickoff(closeAt)}</strong>.
          </div>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <div className="card text-center text-sm text-ink-300">
          Los 16 equipos de octavos aún no están definidos. Vuelve cuando terminen los dieciseisavos
          para elegir tu podio.
        </div>
      ) : (
        <div className="card space-y-3">
          {PODIUM_KEYS.map(key => {
            const used = PODIUM_KEYS.filter(k => k !== key).map(k => picks[k]).filter(Boolean)
            const options = teams.filter(t => t === picks[key] || !used.includes(t))
            const real = actual[key]
            const mine = picks[key]
            const hit = real && mine && real === mine
            const miss = real && mine && real !== mine
            return (
              <div key={key}>
                <label className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{PODIUM_LABELS[key]}</span>
                  <span className="text-[11px] font-mono text-ink-400">+{PODIUM_POINTS[key]}</span>
                </label>
                <select
                  value={mine}
                  onChange={e => setPos(key, e.target.value)}
                  disabled={locked}
                  className={`input w-full ${
                    hit ? 'border-green-500' : miss ? 'border-red-600' : ''
                  } ${locked ? 'opacity-70' : ''}`}
                >
                  <option value="">— Elegir equipo —</option>
                  {options.map(t => (
                    <option key={t} value={t}>{teamWithFlag(t)}</option>
                  ))}
                </select>
                {real && (
                  <div className={`text-[11px] mt-1 ${hit ? 'text-green-400' : 'text-ink-400'}`}>
                    Real: {teamWithFlag(real)}{mine ? (hit ? ` ✅ +${PODIUM_POINTS[key]}` : ' ❌') : ''}
                  </div>
                )}
              </div>
            )
          })}

          {hasRealPodium && (
            <div className="text-sm text-center border-t border-ink-700 pt-2">
              Bono de podio: <span className="font-bold text-brand-400">+{scored.total} pts</span>{' '}
              <span className="text-ink-400">({scored.hits}/4 puestos)</span>
            </div>
          )}
        </div>
      )}

      {teams.length > 0 && (
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
              {saving ? 'Guardando…' : dirty ? '💾 Guardar podio' : 'Sin cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
