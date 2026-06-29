import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TOURNAMENT, matchById } from '../lib/matches'
import { isGroupPlaceholder, isMatchPlaceholder, resolveTeam, autoResolveGroupPositions } from '../lib/bracketTeams'
import { computeGroupTables } from '../lib/groupTables'

export default function AdminBracket() {
  const [bracketTeams, setBracketTeams] = useState({})
  const [results, setResults] = useState({})
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
    Promise.all([
      supabase.from('config').select('*').eq('key', 'bracket_teams').maybeSingle(),
      supabase.from('results').select('*'),
    ]).then(([cfgRes, resRes]) => {
      if (cfgRes.data?.value && typeof cfgRes.data.value === 'object') setBracketTeams(cfgRes.data.value)
      const rmap = {}
      for (const r of resRes.data || []) rmap[r.match_id] = r
      setResults(rmap)
      setLoading(false)
    })
  }, [])

  // Mapa completo de resolución (grupos auto + lo que el admin ya guardó)
  const resolvedMap = useMemo(() => {
    const resultsById = new Map(Object.entries(results).map(([id, r]) => [id, r]))
    const gt = computeGroupTables(resultsById)
    return { ...autoResolveGroupPositions(gt), ...bracketTeams }
  }, [results, bracketTeams])

  // Para un placeholder de cruce (W73/L73), averiguar:
  //  - los 2 equipos posibles de ese partido (resueltos hasta donde se pueda)
  //  - quién ganó/perdió si el partido ya tiene resultado cargado
  const crossInfo = (ph) => {
    const isWinner = ph.startsWith('W')
    const num = ph.slice(1)
    const matchId = TOURNAMENT.matches.find(m => {
      const ids = m.id.match(/(\d+)/g)
      return ids && ids[ids.length - 1] === num && m.stage !== 'group'
    })?.id
    if (!matchId) return { options: [], auto: null }

    const m = matchById(matchId)
    // Resolver los dos equipos de ese partido (pueden venir de grupos o de otros cruces)
    const t1 = resolveTeam(m.team1_raw || m.team1, resolvedMap)
    const t2 = resolveTeam(m.team2_raw || m.team2, resolvedMap)
    const options = [t1, t2].filter(t => t && !t.match(/^[0-9WL]/))

    // ¿Ya hay resultado? Entonces sabemos ganador/perdedor
    const r = results[matchId]
    let auto = null
    if (r && options.length === 2) {
      let winnerSide = null
      if (r.score1 > r.score2) winnerSide = 'team1'
      else if (r.score2 > r.score1) winnerSide = 'team2'
      else winnerSide = r.advances // empate → quién pasó (penales)
      if (winnerSide === 'team1') auto = isWinner ? t1 : t2
      else if (winnerSide === 'team2') auto = isWinner ? t2 : t1
    }
    return { options, auto, matchId }
  }

  const setTeam = (ph, val) => setBracketTeams(prev => ({ ...prev, [ph]: val }))

  // Aplicar todas las auto-asignaciones disponibles de una vez
  const applyAllAuto = () => {
    setBracketTeams(prev => {
      const next = { ...prev }
      for (const ph of matchPlaceholders) {
        const { auto } = crossInfo(ph)
        if (auto && !next[ph]) next[ph] = auto
      }
      return next
    })
  }

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
          Los <strong>1ros y 2dos</strong> de cada grupo se resuelven solos cuando cierra el grupo (no hace falta tocarlos).
          Solo necesitas confirmar los <strong>"3A/B/..."</strong> (mejores terceros): escribe el equipo que clasificó por esa combinación.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {groupPlaceholders.map(ph => {
            // 1ros y 2dos de grupos cerrados se saben solos
            const auto = resolvedMap[ph]
            const current = bracketTeams[ph] || ''
            const isThird = ph.startsWith('3')
            return (
              <div key={ph} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-brand-400 w-16 shrink-0">{ph}</span>
                  <input
                    list="real-teams"
                    value={current}
                    onChange={e => setTeam(ph, e.target.value)}
                    placeholder={auto && !isThird ? auto : 'Equipo…'}
                    className="input text-sm py-1.5 flex-1"
                  />
                </div>
                {auto && !isThird && current !== auto && (
                  <button
                    onClick={() => setTeam(ph, auto)}
                    className="text-[10px] text-brand-300 hover:text-brand-200 text-left ml-[4.5rem]"
                  >
                    ⚡ Auto: {auto}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Ganadores/perdedores de partidos previos */}
      {matchPlaceholders.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold">⚔️ Ganadores de cruces</h2>
            <button
              onClick={applyAllAuto}
              className="text-xs bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-2.5 py-1"
            >
              ⚡ Auto-rellenar
            </button>
          </div>
          <p className="text-xs text-ink-500 mb-3">
            W73 = ganador del partido 73. Si el partido ya tiene marcador cargado, te sugiero
            el ganador automáticamente. Solo aparecen los equipos que juegan ese cruce.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {matchPlaceholders.map(ph => {
              const { options, auto } = crossInfo(ph)
              const current = bracketTeams[ph] || ''
              return (
                <div key={ph} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-brand-400 w-12 shrink-0">{ph}</span>
                    {options.length === 2 ? (
                      // Acotado: solo los 2 equipos del cruce
                      <select
                        value={current}
                        onChange={e => setTeam(ph, e.target.value)}
                        className="input text-sm py-1.5 flex-1"
                      >
                        <option value="">— elegir —</option>
                        {options.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      // Aún no se sabe el cruce: texto libre con todos los equipos
                      <input
                        list="real-teams"
                        value={current}
                        onChange={e => setTeam(ph, e.target.value)}
                        placeholder="Equipo…"
                        className="input text-sm py-1.5 flex-1"
                      />
                    )}
                  </div>
                  {auto && current !== auto && (
                    <button
                      onClick={() => setTeam(ph, auto)}
                      className="text-[10px] text-brand-300 hover:text-brand-200 text-left ml-14"
                    >
                      ⚡ Sugerido: {auto} (tocar para aplicar)
                    </button>
                  )}
                  {auto && current === auto && (
                    <span className="text-[10px] text-green-400 ml-14">✓ ganador del partido</span>
                  )}
                </div>
              )
            })}
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
