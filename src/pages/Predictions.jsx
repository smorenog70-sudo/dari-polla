import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  TOURNAMENT,
  groupedMatches,
  formatKickoff,
  isMatchLocked,
  matchById,
} from '../lib/matches'
import { scoreMatch } from '../lib/scoring'
import { resolveTeam, autoResolveGroupPositions } from '../lib/bracketTeams'
import { computeGroupTables } from '../lib/groupTables'
import { useNowTick } from '../lib/useNowTick'
import SharePredictionButton from '../components/SharePredictionButton'
import MatchSocial from '../components/MatchSocial'
import { teamWithFlag } from '../lib/flags'

const TABS = [
  { id: 'closing', label: '⏰ Cierre pronto' },
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

function ScoreBreakdown({ match, pred, actual, breakdown, total }) {
  const rows = [
    {
      label: 'Ganador / empate',
      detail: 'Acertar quién gana (o empate)',
      pts: breakdown.outcome,
      max: 5,
    },
    {
      label: 'Marcador exacto',
      detail: 'Acertar el marcador idéntico',
      pts: breakdown.exact,
      max: 5,
    },
    {
      label: `Goles de ${match.team1}`,
      detail: `Pusiste ${pred?.score1}, fue ${actual?.score1}`,
      pts: breakdown.home,
      max: 2,
    },
    {
      label: `Goles de ${match.team2}`,
      detail: `Pusiste ${pred?.score2}, fue ${actual?.score2}`,
      pts: breakdown.away,
      max: 2,
    },
    {
      label: 'Diferencia de gol',
      detail: `Tu dif: ${signed(pred?.score1 - pred?.score2)}, real: ${signed(actual?.score1 - actual?.score2)}`,
      pts: breakdown.diff,
      max: 1,
    },
  ]

  // Solo en playoffs: fila de "quién pasa"
  if (match.stage !== 'group' && (actual?.advances || pred?.advances)) {
    const whoTeam = (w) => w === 'team1' ? match.team1 : w === 'team2' ? match.team2 : '—'
    rows.push({
      label: '¿Quién pasa?',
      detail: `Elegiste ${whoTeam(pred?.advances)}, pasó ${whoTeam(actual?.advances)}`,
      pts: breakdown.advances || 0,
      max: 10,
    })
  }

  return (
    <div className="mb-3 bg-ink-900/60 rounded-lg p-3 text-sm">
      <div className="text-xs text-ink-300 uppercase tracking-wider mb-2">Cómo se calcularon tus puntos</div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={r.pts > 0 ? 'text-green-400' : 'text-ink-500'}>
                {r.pts > 0 ? '✓' : '✗'}
              </span>
              <div className="min-w-0">
                <div className={`truncate ${r.pts > 0 ? 'text-ink-100' : 'text-ink-400'}`}>{r.label}</div>
                <div className="text-[10px] text-ink-500 truncate">{r.detail}</div>
              </div>
            </div>
            <span className={`font-mono text-xs whitespace-nowrap ${r.pts > 0 ? 'text-green-400 font-bold' : 'text-ink-500'}`}>
              +{r.pts}{r.pts === 0 ? ` / ${r.max}` : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-ink-700 mt-2 pt-2 font-semibold">
        <span>Total</span>
        <span className="text-brand-400 font-mono">+{total}</span>
      </div>
    </div>
  )
}

function signed(n) {
  if (n == null || isNaN(n)) return '—'
  return n > 0 ? `+${n}` : `${n}`
}

function MatchRow({ match, pred, actual, onChange, locked, knockoutsEnabled, userName, user, profile, profilesById, isAdmin }) {
  const disabled = locked || (match.stage !== 'group' && !knockoutsEnabled)
  const scored = pred && actual ? scoreMatch(pred, actual) : null
  const points = scored ? scored.total : null
  const [showBreakdown, setShowBreakdown] = useState(false)

  const set = (field, val) => {
    const v = val === '' ? '' : Math.max(0, Math.min(30, parseInt(val) || 0))
    onChange({ ...pred, [field]: v })
  }

  const hasPrediction =
    pred && pred.score1 !== '' && pred.score2 !== '' && pred.score1 != null && pred.score2 != null

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
            <button
              type="button"
              onClick={() => setShowBreakdown(v => !v)}
              className="pill bg-brand-600 text-white hover:bg-brand-500 transition cursor-pointer"
              title="Ver desglose de puntos"
            >
              +{points} {showBreakdown ? '▲' : '▼'}
            </button>
          )}
        </span>
      </div>

      {showBreakdown && scored && (
        <ScoreBreakdown match={match} pred={pred} actual={actual} breakdown={scored.breakdown} total={scored.total} />
      )}

      {match.stage !== 'group' && (
        <div className="text-[10px] text-ink-500 text-center mb-1">
          Marcador a los 90 minutos (sin contar tiempo extra)
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 text-right font-medium text-sm">{teamWithFlag(match.team1)}</div>
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
        <div className="flex-1 text-left font-medium text-sm">{teamWithFlag(match.team2)}</div>
      </div>

      {/* PLAYOFFS: quién pasa (+10 pts). Bloqueado por el marcador; libre solo si hay empate. */}
      {match.stage !== 'group' && (() => {
        const s1 = pred?.score1, s2 = pred?.score2
        const bothFilled = s1 !== '' && s2 !== '' && s1 != null && s2 != null
        const isDraw = bothFilled && Number(s1) === Number(s2)
        // Si hay ganador claro, "quién pasa" lo determina el marcador (bloqueado).
        const forcedAdvances = bothFilled && !isDraw
          ? (Number(s1) > Number(s2) ? 'team1' : 'team2')
          : null
        // El valor mostrado: forzado por marcador, o el elegido por el usuario (solo en empate)
        const effectiveAdvances = forcedAdvances || (isDraw ? pred?.advances : null)
        // Solo se puede tocar manualmente si es empate y no está bloqueado
        const togglesEnabled = isDraw && !disabled

        const pickTeam = (who) => {
          if (!togglesEnabled) return
          onChange({ ...pred, advances: pred?.advances === who ? null : who })
        }

        const btnClass = (who) => {
          const active = effectiveAdvances === who
          return `flex-1 text-xs py-1.5 rounded-lg border transition ${
            active
              ? 'bg-brand-600 border-brand-500 text-white font-semibold'
              : 'bg-ink-800 border-ink-600 text-ink-300'
          } ${!togglesEnabled ? 'cursor-default opacity-90' : ''}`
        }

        return (
          <div className="mt-2 bg-ink-900/40 rounded-lg p-2">
            <div className="text-[10px] text-ink-400 text-center mb-1.5">
              ¿Quién pasa? <span className="text-brand-400">(+10 pts extra)</span>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => pickTeam('team1')} disabled={!togglesEnabled} className={btnClass('team1')}>
                {teamWithFlag(match.team1)}
              </button>
              <button type="button" onClick={() => pickTeam('team2')} disabled={!togglesEnabled} className={btnClass('team2')}>
                {teamWithFlag(match.team2)}
              </button>
            </div>
            {/* Mensaje contextual */}
            {!bothFilled ? (
              <div className="text-[10px] text-ink-500 text-center mt-1.5">
                Pon el marcador de 90 min primero.
              </div>
            ) : forcedAdvances ? (
              <div className="text-[10px] text-ink-500 text-center mt-1.5">
                Lo define el marcador. Si crees que termina empatado a los 90 (y se define en tiempo extra o penales), pon empate.
              </div>
            ) : (
              <div className="text-[10px] text-brand-300 text-center mt-1.5">
                ⚖️ Empate a los 90: elige quién pasa (en tiempo extra o penales).
              </div>
            )}
            {actual?.advances && (
              <div className="text-[10px] text-center mt-1.5 text-green-400">
                Pasó: {actual.advances === 'team1' ? teamWithFlag(match.team1) : teamWithFlag(match.team2)}
                {effectiveAdvances && (effectiveAdvances === actual.advances ? ' ✅ +10' : ' ❌')}
              </div>
            )}
          </div>
        )
      })()}
      {match.stage !== 'group' && (
        <div className="text-[10px] text-ink-500 mt-1 text-center">
          {match.team1_raw !== match.team1 && `(${match.team1_raw} vs ${match.team2_raw})`}
        </div>
      )}
      {hasPrediction && !locked && (
        <SharePredictionButton match={match} prediction={pred} userName={userName} />
      )}
      <MatchSocial
        match={match}
        user={user}
        profile={profile}
        profilesById={profilesById}
        isAdmin={isAdmin}
      />
    </div>
  )
}

export default function Predictions() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const urlDay = searchParams.get('dia') // YYYY-MM-DD opcional
  const [viewMode, setViewMode] = useState(urlDay ? 'calendario' : 'fase') // 'fase' | 'calendario'
  const [tab, setTab] = useState('closing')
  const [selectedDay, setSelectedDay] = useState(urlDay || null) // YYYY-MM-DD
  const [preds, setPreds] = useState({})       // match_id -> {score1, score2}
  const [original, setOriginal] = useState({}) // last saved state
  const [results, setResults] = useState({})   // match_id -> {score1, score2}
  const [config, setConfig] = useState({})
  const [profilesById, setProfilesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // re-render every 30s so countdowns and the "closing soon" filter stay fresh
  const nowMs = useNowTick(30000)

  const load = async () => {
    setLoading(true)
    const [pRes, rRes, cRes, profRes] = await Promise.all([
      supabase.from('predictions').select('*').eq('user_id', user.id),
      supabase.from('results').select('*'),
      supabase.from('config').select('*'),
      supabase.from('profiles').select('id, display_name, nickname, avatar'),
    ])
    const map = {}
    for (const p of pRes.data || []) map[p.match_id] = { score1: p.score1, score2: p.score2, advances: p.advances ?? null }
    setPreds(map)
    setOriginal(JSON.parse(JSON.stringify(map)))

    const rmap = {}
    for (const r of rRes.data || []) rmap[r.match_id] = { score1: r.score1, score2: r.score2 }
    setResults(rmap)

    const pbid = {}
    for (const p of profRes.data || []) pbid[p.id] = p
    setProfilesById(pbid)

    const cfg = {}
    for (const c of cRes.data || []) cfg[c.key] = c.value
    setConfig(cfg)
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  const matches = useMemo(() => {
    const all = groupedMatches()

    if (tab === 'closing') {
      // Partidos que cierran en las próximas 24h y aún no están cerrados
      const cutoffMs = nowMs + 24 * 60 * 60 * 1000
      const knockoutsEnabledNow = config.knockouts_enabled === true
      return TOURNAMENT.matches
        .filter(m => {
          if (!m.kickoff_utc) return false
          const ko = new Date(m.kickoff_utc).getTime()
          const lockMs = ko - 10 * 60 * 1000
          if (lockMs <= nowMs) return false   // ya cerró
          if (lockMs > cutoffMs) return false  // demasiado lejos
          // eliminatorias bloqueadas si knockouts no está habilitado
          if (m.stage !== 'group' && !knockoutsEnabledNow) return false
          return true
        })
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
  }, [tab, nowMs, config.knockouts_enabled])

  const knockoutsEnabled = config.knockouts_enabled === true

  // Mapeo de placeholders de eliminatoria -> equipos reales.
  // Combina: (1) auto-resuelto de grupos cerrados (1A, 2B...) y
  //          (2) lo que el admin confirmó manualmente (terceros, ganadores).
  // El manual del admin tiene prioridad por si hay que corregir algo.
  const bracketTeams = useMemo(() => {
    const resultsById = new Map(Object.entries(results).map(([id, r]) => [id, r]))
    const gt = computeGroupTables(resultsById)
    const auto = autoResolveGroupPositions(gt)
    const manual = config.bracket_teams || {}
    return { ...auto, ...manual }
  }, [results, config.bracket_teams])

  // Devuelve un partido con sus nombres resueltos (para playoffs)
  const resolveMatch = (m) => {
    if (m.stage === 'group') return m
    return {
      ...m,
      team1: resolveTeam(m.team1_raw || m.team1, bracketTeams),
      team2: resolveTeam(m.team2_raw || m.team2, bracketTeams),
    }
  }


  // === Modo calendario: agrupar partidos por día ===
  const daysWithMatches = useMemo(() => {
    const map = new Map() // 'YYYY-MM-DD' -> { dateKey, label, matches[] }
    const knockoutsEnabledNow = config.knockouts_enabled === true
    for (const m of TOURNAMENT.matches) {
      if (!m.kickoff_utc) continue
      // Ocultar eliminatorias con placeholders si aún no se habilitan
      if (m.stage !== 'group' && !knockoutsEnabledNow) continue
      const d = new Date(m.kickoff_utc)
      const dateKey = d.toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
      if (!map.has(dateKey)) map.set(dateKey, { dateKey, date: d, matches: [] })
      map.get(dateKey).matches.push(m)
    }
    const arr = [...map.values()].sort((a, b) => a.date - b.date)
    for (const day of arr) {
      day.matches.sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))
    }
    return arr
  }, [config.knockouts_enabled])

  // Etiqueta amigable para un día (Hoy / Mañana / Sáb 14 jun)
  const dayLabel = (date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(date); d.setHours(0, 0, 0, 0)
    const diff = Math.round((d - today) / 86400000)
    if (diff === 0) return { top: 'Hoy', bottom: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }
    if (diff === 1) return { top: 'Mañana', bottom: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }
    if (diff === -1) return { top: 'Ayer', bottom: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }
    // weekday corto (lun, mar...) arriba; día + mes abreviado abajo
    const wd = d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')
    const dm = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
    return { top: wd, bottom: dm }
  }

  // Día seleccionado por defecto: hoy si tiene partidos, si no el próximo con partidos
  const effectiveDay = useMemo(() => {
    if (selectedDay) return selectedDay
    const todayKey = new Date().toLocaleDateString('en-CA')
    if (daysWithMatches.some(d => d.dateKey === todayKey)) return todayKey
    const now = Date.now()
    const upcoming = daysWithMatches.find(d => d.date.getTime() >= now - 86400000)
    return upcoming ? upcoming.dateKey : (daysWithMatches[0]?.dateKey || null)
  }, [selectedDay, daysWithMatches])

  const calendarMatches = useMemo(() => {
    const day = daysWithMatches.find(d => d.dateKey === effectiveDay)
    return day ? day.matches : []
  }, [daysWithMatches, effectiveDay])

  // Partidos a mostrar según el modo
  const displayMatches = viewMode === 'calendario' ? calendarMatches : matches

  const dirty = useMemo(() => {
    // Calcula el "quién pasa" efectivo igual que al guardar: en playoffs lo fuerza
    // el marcador, salvo empate (ahí vale la elección del usuario).
    const effAdv = (matchId, p) => {
      const m = matchById(matchId)
      if (!m || m.stage === 'group') return null
      const s1 = p?.score1, s2 = p?.score2
      if (s1 === '' || s2 === '' || s1 == null || s2 == null) return null
      const a = Number(s1), b = Number(s2)
      if (a > b) return 'team1'
      if (b > a) return 'team2'
      return p?.advances ?? null // empate
    }
    const keys = new Set([...Object.keys(preds), ...Object.keys(original)])
    for (const k of keys) {
      const a = preds[k]
      const b = original[k]
      if (!a && !b) continue
      if (!a || !b) return true
      if (Number(a.score1) !== Number(b.score1) || Number(a.score2) !== Number(b.score2)) return true
      // Cambio solo del ganador (marcador igual): también cuenta como cambio.
      if (effAdv(k, a) !== effAdv(k, b)) return true
    }
    return false
  }, [preds, original])

  const save = async () => {
    // Bloqueo de emergencia del admin
    if (config.predictions_locked === true) {
      setSavedMsg('🔒 Las predicciones están bloqueadas por el administrador.')
      setTimeout(() => setSavedMsg(''), 4000)
      return
    }
    setSaving(true)
    setSavedMsg('')
    const rows = []
    for (const m of TOURNAMENT.matches) {
      const p = preds[m.id]
      if (!p || p.score1 === '' || p.score2 === '' || p.score1 == null || p.score2 == null) continue
      // skip if locked or knockouts disabled (don't write)
      if (isMatchLocked(m)) continue
      if (m.stage !== 'group' && !knockoutsEnabled) continue
      // only push if changed vs original (marcador O quién pasa)
      // Calcular el "quién pasa" efectivo: en playoffs, lo fuerza el marcador
      // salvo empate a 90 (ahí el usuario elige quién pasa: tiempo extra o penales).
      let effectiveAdvances = null
      if (m.stage !== 'group') {
        const a = Number(p.score1), b = Number(p.score2)
        if (a > b) effectiveAdvances = 'team1'
        else if (b > a) effectiveAdvances = 'team2'
        else effectiveAdvances = p.advances ?? null // empate: elección del usuario
      }
      const o = original[m.id]
      // Comparar normalizando a número (los scores pueden venir como string del input)
      const sameScore = o &&
        Number(o.score1) === Number(p.score1) &&
        Number(o.score2) === Number(p.score2)
      const sameAdvances = o && (o.advances ?? null) === effectiveAdvances
      if (sameScore && sameAdvances) continue
      rows.push({
        user_id: user.id,
        match_id: m.id,
        score1: Number(p.score1),
        score2: Number(p.score2),
        advances: effectiveAdvances,
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
      // Reconstruir 'original' con lo que REALMENTE se guardó (advances efectivo),
      // no con los preds crudos. Así la próxima comparación de cambios es correcta
      // y se puede volver a cambiar el ganador sin que diga "sin cambios".
      const newOriginal = JSON.parse(JSON.stringify(preds))
      for (const r of rows) {
        newOriginal[r.match_id] = {
          score1: r.score1,
          score2: r.score2,
          advances: r.advances ?? null,
        }
      }
      // También actualizar preds para que la UI muestre el advances efectivo
      setPreds(prev => {
        const next = { ...prev }
        for (const r of rows) {
          next[r.match_id] = { ...next[r.match_id], advances: r.advances ?? null }
        }
        return next
      })
      setOriginal(newOriginal)
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
        <Link
          to="/grupos-mundial"
          className="mt-3 flex items-center justify-center gap-2 text-sm bg-ink-700 hover:bg-ink-600 text-brand-300 rounded-lg py-2 transition"
        >
          🌍 Ver cómo van los grupos antes de apostar →
        </Link>
      </div>

      {config.predictions_locked === true && (
        <div className="card bg-red-900/30 border border-red-600 text-red-100">
          <div className="font-bold">🔒 Predicciones bloqueadas</div>
          <div className="text-xs mt-1">
            El administrador bloqueó temporalmente las predicciones. No podrás guardar cambios por ahora.
          </div>
        </div>
      )}

      {/* Toggle de modo de vista */}
      <div className="flex gap-2 -mx-1 px-1">
        <button
          onClick={() => setViewMode('fase')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            viewMode === 'fase' ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
          }`}
        >
          🗂️ Por fase
        </button>
        <button
          onClick={() => setViewMode('calendario')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            viewMode === 'calendario' ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
          }`}
        >
          📅 Calendario
        </button>
      </div>

      {/* Tabs de fase (solo en modo fase) */}
      {viewMode === 'fase' && (
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
      )}

      {/* Selector de día (solo en modo calendario) */}
      {viewMode === 'calendario' && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 sticky top-14 bg-ink-900 z-20 py-1">
          {daysWithMatches.map(day => {
            const isToday = day.dateKey === new Date().toLocaleDateString('en-CA')
            const active = day.dateKey === effectiveDay
            const lab = dayLabel(day.date)
            return (
              <button
                key={day.dateKey}
                onClick={() => setSelectedDay(day.dateKey)}
                className={`px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center shrink-0 min-w-[64px] ${
                  active ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
                }`}
              >
                <span className="font-semibold text-xs capitalize leading-tight">{lab.top}</span>
                <span className={`text-[10px] capitalize leading-tight ${active ? 'text-brand-100' : 'text-ink-400'}`}>
                  {lab.bottom}
                </span>
                <span className={`text-[9px] leading-tight mt-0.5 ${active ? 'text-brand-100' : 'text-ink-500'}`}>
                  {day.matches.length} {day.matches.length === 1 ? 'part.' : 'part.'}
                  {isToday && !active ? ' •' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {viewMode === 'fase' && isKnockoutTab && !knockoutsEnabled && (
        <div className="card bg-yellow-900/30 border-yellow-700/50 text-yellow-100 text-sm">
          🔒 Las predicciones de eliminatorias se habilitarán cuando terminen los grupos.
        </div>
      )}

      {viewMode === 'fase' && tab === 'closing' && matches.length === 0 && (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">🌴</div>
          <div className="font-medium">Sin partidos próximos a cerrar</div>
          <div className="text-xs mt-1">
            No hay partidos en las próximas 24 horas. Vuelve cerca del próximo partido o usa las pestañas para pronosticar por fecha.
          </div>
        </div>
      )}

      {viewMode === 'fase' && tab === 'closing' && matches.length > 0 && (
        <div className="text-xs text-ink-300 px-1">
          Mostrando partidos que cierran en las próximas 24 horas, ordenados por urgencia.
        </div>
      )}

      {viewMode === 'calendario' && calendarMatches.length === 0 && (
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">📅</div>
          <div className="font-medium">No hay partidos este día</div>
        </div>
      )}

      {displayMatches.map(m => (
        <MatchRow
          key={m.id}
          match={resolveMatch(m)}
          pred={preds[m.id]}
          actual={results[m.id]}
          locked={isMatchLocked(m)}
          knockoutsEnabled={knockoutsEnabled}
          userName={profile?.display_name}
          user={user}
          profile={profile}
          profilesById={profilesById}
          isAdmin={!!profile?.is_admin}
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
