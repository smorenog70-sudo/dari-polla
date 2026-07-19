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
  // Overrides locales de "pagada" para no recargar toda la data en cada toggle.
  const [paidOverrides, setPaidOverrides] = useState(new Map())

  const isPaid = (f) => (paidOverrides.has(f.id) ? paidOverrides.get(f.id) : !!f.paid)

  const togglePaid = async (fine) => {
    const next = !isPaid(fine)
    setPaidOverrides(prev => new Map(prev).set(fine.id, next))
    const { error } = await supabase
      .from('fines')
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq('id', fine.id)
    if (error) {
      setPaidOverrides(prev => new Map(prev).set(fine.id, !next))
      setMsg('❌ ' + error.message)
      setTimeout(() => setMsg(''), 3000)
    }
  }

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

  // Todos los que deben multas (en cualquier fecha), con su estado de pago.
  const debtors = useMemo(() => {
    const byUser = new Map()
    for (const f of data.fines) {
      if (!byUser.has(f.user_id)) byUser.set(f.user_id, [])
      byUser.get(f.user_id).push(f)
    }
    return [...byUser.entries()]
      .map(([uid, fines]) => {
        const prof = data.profiles.find(p => p.id === uid)
        fines.sort((a, b) => FECHAS.indexOf(a.fecha_id) - FECHAS.indexOf(b.fecha_id))
        let pending = 0
        let paidTotal = 0
        for (const f of fines) {
          if (isPaid(f)) paidTotal += f.amount || 0
          else pending += f.amount || 0
        }
        return { id: uid, name: prof?.display_name || 'Jugador', fines, pending, paidTotal }
      })
      .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name))
  }, [data.fines, data.profiles, paidOverrides])

  const totals = useMemo(() => ({
    pending: debtors.reduce((s, d) => s + d.pending, 0),
    paid: debtors.reduce((s, d) => s + d.paidTotal, 0),
  }), [debtors])

  const applyFines = async () => {
    if (ranking.length < 2) return
    setWorking(true)
    setMsg('')
    const fineAmount = Number(data.config.fine_amount || 5000)
    // Los 2 peores puestos por puntaje; si hay empates, pagan todos.
    const toFine = ranking.filter(r => finedSet.has(r.id))
    // Si se reasignan las multas, conserva el estado de pago de quien ya había pagado.
    const prevByUser = new Map(existing.map(f => [f.user_id, f]))
    const rows = toFine.map(r => {
      const prev = prevByUser.get(r.id)
      const wasPaid = prev ? isPaid(prev) : false
      return {
        user_id: r.id,
        fecha_id: selected,
        amount: fineAmount,
        paid: wasPaid,
        paid_at: wasPaid ? (prev.paid_at || new Date().toISOString()) : null,
      }
    })
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

      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">💰 Deudores</h3>
          <div className="text-xs text-ink-300 text-right">
            <span className="text-red-300">Pendiente: {totals.pending.toLocaleString('es-CO')}</span>
            {' · '}
            <span className="text-green-300">Pagado: {totals.paid.toLocaleString('es-CO')}</span>
          </div>
        </div>
        <p className="text-xs text-ink-300 mb-2">
          Toca una multa para marcarla como pagada o pendiente.
        </p>
        {debtors.length === 0 && (
          <p className="text-sm text-ink-500 text-center py-2">Nadie debe multas todavía.</p>
        )}
        {debtors.map(d => (
          <div key={d.id} className="border-t border-ink-700 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{d.name}</span>
              {d.pending > 0 ? (
                <span className="text-red-300 font-medium">
                  Debe {d.pending.toLocaleString('es-CO')} COP
                </span>
              ) : (
                <span className="text-green-300 font-medium">Al día ✅</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {d.fines.map(f => {
                const paid = isPaid(f)
                return (
                  <button
                    key={f.id}
                    onClick={() => togglePaid(f)}
                    className={`pill border transition active:scale-[0.97] ${
                      paid
                        ? 'bg-green-900/30 border-green-700/50 text-green-300'
                        : 'bg-red-900/30 border-red-700/50 text-red-300'
                    }`}
                  >
                    {FECHA_LABELS[f.fecha_id] || f.fecha_id} · {(f.amount || 0).toLocaleString('es-CO')} {paid ? '✅' : '⏳'}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
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
          <ul className="text-sm space-y-1.5">
            {existing.map(f => {
              const u = data.profiles.find(p => p.id === f.user_id)
              const paid = isPaid(f)
              return (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span>• {u?.display_name || f.user_id} — {f.amount.toLocaleString('es-CO')} COP</span>
                  <button
                    onClick={() => togglePaid(f)}
                    className={`pill border shrink-0 transition active:scale-[0.97] ${
                      paid
                        ? 'bg-green-900/30 border-green-700/50 text-green-300'
                        : 'bg-red-900/30 border-red-700/50 text-red-300'
                    }`}
                  >
                    {paid ? 'Pagada ✅' : 'Pendiente ⏳'}
                  </button>
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
