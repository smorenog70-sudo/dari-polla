import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TOURNAMENT } from '../lib/matches'
import { isGroupPlaceholder, isMatchPlaceholder } from '../lib/bracketTeams'

export default function AdminBracket() {
  const [bracketTeams, setBracketTeams] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Equipos reales disponibles (de la fase de grupos) para el datalist
  const realTeams = useMemo(() => {
    const set = new Set()
    for (const m of TOURNAMENT.matches) {
      if (m.stage === 'group') { set.add(m.team1); set.add(m.team2) }
    }
    return [...set].sort()
  }, [])

  // Placeholders de posición de grupo y terceros (los que tiene sentido llenar primero)
  const groupPlaceholders = useMemo(() => {
    const set = new Set()
    for (const m of TOURNAMENT.matches) {
      for (const t of [m.team1_raw, m.team2_raw]) {
        if (t && isGroupPlaceholder(t)) set.add(t)
      }
    }
    return [...set].sort()
  }, [])

  // Placeholders de ganador/perdedor de partidos (W73, L101...)
  const matchPlaceholders = useMemo(() => {
    const set = new Set()
    for (const m of TOURNAMENT.matches) {
      for (const t of [m.team1_raw, m.team2_raw]) {
        if (t && isMatchPlaceholder(t)) set.add(t)
      }
    }
    return [...set].sort((a, b) => {
      const na = parseInt(a.slice(1)), nb = parseInt(b.slice(1))
      return na - nb
    })
  }, [])

  useEffect(() => {
    supabase.from('config').select('*').eq('key', 'bracket_teams').maybeSingle().then(({ data }) => {
      if (data?.value && typeof data.value === 'object') setBracketTeams(data.value)
      setLoading(false)
    })
  }, [])

  const setTeam = (ph, val) => setBracketTeams(prev => ({ ...prev, [ph]: val }))

  const save = async () => {
    setSaving(true)
    setMsg('')
    // limpiar vacíos
    const clean = {}
    for (const [k, v] of Object.entries(bracketTeams)) {
      if (v && v.trim()) clean[k] = v.trim()
    }
    const { error } = await supabase
      .from('config')
      .upsert({ key: 'bracket_teams', value: clean }, { onConflict: 'key' })
    setSaving(false)
    if (error) setMsg('❌ ' + error.message)
    else { setMsg('✅ Guardado'); setTimeout(() => setMsg(''), 2000) }
  }

  if (loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const filledCount = Object.values(bracketTeams).filter(v => v && v.trim()).length

  return (
    <div className="space-y-3 pb-24">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏆 Llaves de eliminatorias</h1>
        <p className="text-xs text-ink-300">
          Cuando terminen los grupos, asigna qué equipo quedó en cada posición. Esos nombres
          aparecerán en el bracket y en los partidos de eliminatorias para todos.
        </p>
      </div>

      {/* Datalist compartido con los equipos reales */}
      <datalist id="real-teams">
        {realTeams.map(t => <option key={t} value={t} />)}
      </datalist>

      {/* Posiciones de grupo y mejores terceros */}
      <div className="card">
        <h2 className="font-semibold mb-1">🅰️ Posiciones de grupo y terceros</h2>
        <p className="text-xs text-ink-500 mb-3">
          1A = primero del grupo A, 2A = segundo del grupo A. Los "3A/B/..." son los mejores terceros (escribe el equipo que clasificó por esa combinación).
        </p>
        <div className="grid grid-cols-2 gap-2">
          {groupPlaceholders.map(ph => (
            <div key={ph} className="flex items-center gap-2">
              <span className="text-xs font-mono text-brand-400 w-16 shrink-0">{ph}</span>
              <input
                list="real-teams"
                value={bracketTeams[ph] || ''}
                onChange={e => setTeam(ph, e.target.value)}
                placeholder="Equipo…"
                className="input text-sm py-1.5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Ganadores/perdedores de partidos previos */}
      {matchPlaceholders.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">⚔️ Ganadores de cruces</h2>
          <p className="text-xs text-ink-500 mb-3">
            W73 = ganador del partido 73, L101 = perdedor del 101. Llénalos a medida que avanzan las rondas (octavos, cuartos, etc.).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {matchPlaceholders.map(ph => (
              <div key={ph} className="flex items-center gap-2">
                <span className="text-xs font-mono text-brand-400 w-12 shrink-0">{ph}</span>
                <input
                  list="real-teams"
                  value={bracketTeams[ph] || ''}
                  onChange={e => setTeam(ph, e.target.value)}
                  placeholder="Equipo…"
                  className="input text-sm py-1.5"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

      <div className="fixed bottom-16 inset-x-0 px-4 z-30">
        <div className="max-w-2xl mx-auto">
          <button onClick={save} disabled={saving} className="btn-primary w-full shadow-lg">
            {saving ? 'Guardando…' : `💾 Guardar (${filledCount} asignados)`}
          </button>
        </div>
      </div>
    </div>
  )
}
