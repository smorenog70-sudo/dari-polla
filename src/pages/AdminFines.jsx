import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { fechaMatchIds, FECHA_LABELS } from '../lib/matches'
import { scoreMatch } from '../lib/scoring'

const FECHAS = [
  'group-F1', 'group-F2', 'group-F3',
  'r32', 'r16', 'qf', 'sf', 'third', 'final',
]

export default function AdminFines() {
  const { user } = useAuth()
  const data = useLeagueData()
  const [selected, setSelected] = useState('group-F1')
  const [msg, setMsg] = useState('')
  const [working, setWorking] = useState(false)

  // Compute standings for the selected fecha
  const ranking = useMemo(() => {
    if (data.loading) return []
    const matchIds = fechaMatchIds(selected)
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }
    return data.profiles
      .filter(p => p.paid) // only paid players are in the bolsa game
      .map(prof => {
        let pts = 0
        for (const p of predsByUser.get(prof.id) || []) {
          if (!matchIds.includes(p.match_id)) continue
          const r = resultsById.get(p.match_id)
          if (r) pts += scoreMatch(p, r).total
        }
        return { id: prof.id, name: prof.display_name, points: pts }
      })
      .sort((a, b) => b.points - a.points)
  }, [data, selected])

  // IDs que pagan multa: los 2 peores puestos por puntaje; con empates, pagan todos.
  const finedSet = useMemo(() => {
    const set = new Set()
    if (ranking.length <= 2) {
      ranking.forEach(r => set.add(r.id))
      return set
    }
    const uniqueScores = [...new Set(ranking.map(r => r.points))].sort((a, b) => a - b)
    const worstTwo = new Set(uniqueScores.slice(0, 2))
    for (const r of ranking) if (worstTwo.has(r.points)) set.add(r.id)
    return set
  }, [ranking])

  const allDone = useMemo(() => {
    const ids = fechaMatchIds(selected)
    const resIds = new Set(data.results.map(r => r.match_id))
    return ids.every(id => resIds.has(id))
  }, [data, selected])

  const existing = useMemo(() => {
    return data.fines.filter(f => f.fecha_id === selected)
  }, [data, selected])

  const applyFines = async () => {
    if (ranking.length < 2) return
    setWorking(true)
    setMsg('')
    const fineAmount = Number(data.config.fine_amount || 5000)
    // Los 2 peores puestos por puntaje; si hay empates, pagan todos.
    const toFine = ranking.filter(r => finedSet.has(r.id))
    const rows = toFine.map(r => ({
      user_id: r.id,
      fecha_id: selected,
      amount: fineAmount,
    }))
    // Delete existing fines for this fecha first
    const { error: delErr } = await supabase.from('fines').delete().eq('fecha_id', selected)
    if (delErr) {
      setWorking(false)
      setMsg('❌ ' + delErr.message)
      return
    }
    const { error } = await supabase.from('fines').insert(rows)
    setWorking(false)
    if (error) {
      setMsg('❌ ' + error.message)
    } else {
      // mark fecha closed
      await supabase.from('closed_fechas').upsert(
        { fecha_id: selected, closed_at: new Date().toISOString(), closed_by: user.id },
        { onConflict: 'fecha_id' }
      )
      setMsg(`✅ Multas aplicadas a ${toFine.map(r => r.name).join(', ')}`)
      data.refresh()
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const clearFines = async () => {
    setWorking(true)
    setMsg('')
    await supabase.from('fines').delete().eq('fecha_id', selected)
    await supabase.from('closed_fechas').delete().eq('fecha_id', selected)
    setWorking(false)
    setMsg('✅ Multas eliminadas')
    data.refresh()
    setTimeout(() => setMsg(''), 2000)
  }

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🔧 Multas por fecha</h1>
        <p className="text-xs text-ink-300">
          Cuando termines de meter los marcadores de una fecha, aplica la multa de
          5.000 COP a los 2 últimos puestos. Si hay empate en esos puestos, pagan todos los empatados.
        </p>
      </div>

      <div>
        <label className="label">Fecha</label>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="input">
          {FECHAS.map(f => (
            <option key={f} value={f}>{FECHA_LABELS[f]}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Ranking de esta fecha</h3>
        {!allDone && (
          <div className="text-xs text-yellow-300 mb-2">
            ⚠️ Aún faltan resultados de partidos en esta fecha. La tabla podría cambiar.
          </div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {ranking.map((r, idx) => {
              const isBottom2 = finedSet.has(r.id)
              return (
                <tr key={r.id} className={`border-t border-ink-700 ${isBottom2 ? 'bg-red-900/20' : ''}`}>
                  <td className="py-2 px-2 text-ink-300">{idx + 1}</td>
                  <td className="py-2 px-2">{r.name}</td>
                  <td className="py-2 px-2 text-right font-bold">{r.points} pts</td>
                </tr>
              )
            })}
            {ranking.length === 0 && (
              <tr><td className="py-4 text-center text-ink-500" colSpan="3">Sin jugadores pagados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {existing.length > 0 && (
        <div className="card bg-yellow-900/20 border-yellow-700/40">
          <h3 className="font-semibold mb-2">Multas ya aplicadas</h3>
          <ul className="text-sm space-y-1">
            {existing.map(f => {
              const u = data.profiles.find(p => p.id === f.user_id)
              return (
                <li key={f.id}>
                  • {u?.display_name || f.user_id} — {f.amount.toLocaleString('es-CO')} COP
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={applyFines}
          disabled={working || ranking.length < 2}
          className="btn-primary"
        >
          {existing.length > 0 ? '🔄 Reasignar multas' : '💸 Aplicar multas'}
        </button>
        <button
          onClick={clearFines}
          disabled={working || existing.length === 0}
          className="btn-danger"
        >
          🗑️ Limpiar multas
        </button>
      </div>
    </div>
  )
}
