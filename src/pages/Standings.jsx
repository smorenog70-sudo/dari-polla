import { useMemo, useState } from 'react'
import { useLeagueData } from '../lib/useLeagueData'
import { fechaMatchIds, FECHA_LABELS, matchById } from '../lib/matches'
import {
  scoreMatch,
  scoreGroupPositions,
  scoreThirds,
} from '../lib/scoring'
import { useAuth } from '../lib/auth'

const FECHA_FILTERS = [
  { id: 'total', label: 'Total' },
  { id: 'group-F1', label: 'Fecha 1' },
  { id: 'group-F2', label: 'Fecha 2' },
  { id: 'group-F3', label: 'Fecha 3' },
  { id: 'r32', label: '16avos' },
  { id: 'r16', label: 'Octavos' },
  { id: 'qf', label: 'Cuartos' },
  { id: 'sf', label: 'Semis' },
  { id: 'third', label: '3er' },
  { id: 'final', label: 'Final' },
]

// Etiqueta de puesto estilo golf: medalla si es podio (compartida en empates),
// y "T" delante cuando hay empate (T2, T5...). En vistas de fecha no usamos medallas.
function golfLabel(rank, tied, filter) {
  if (filter === 'total' && rank <= 3) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
    // En empate del podio, mostramos medalla + "T" pequeña para que se entienda
    return tied ? `${medal}ᵀ` : medal
  }
  return `${tied ? 'T' : ''}${rank}`
}

export default function Standings() {
  const data = useLeagueData()
  const [filter, setFilter] = useState('total')
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  const rows = useMemo(() => {
    if (data.loading) return []
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }
    const gpByUser = new Map()
    for (const g of data.groupPreds) {
      if (!gpByUser.has(g.user_id)) gpByUser.set(g.user_id, [])
      gpByUser.get(g.user_id).push(g)
    }
    const tpByUser = new Map()
    for (const t of data.thirdPreds) {
      if (!tpByUser.has(t.user_id)) tpByUser.set(t.user_id, [])
      tpByUser.get(t.user_id).push(t.team)
    }
    const finesByUser = new Map()
    for (const f of data.fines) {
      finesByUser.set(f.user_id, (finesByUser.get(f.user_id) || 0) + (f.amount || 5000))
    }
    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const actualThirds = data.thirdResults.map(r => r.team)

    const inScope = (matchId) => {
      if (filter === 'total') return true
      const ids = fechaMatchIds(filter)
      return ids.includes(matchId)
    }

    const sorted = data.profiles.map(prof => {
      const myPreds = predsByUser.get(prof.id) || []
      let matchPts = 0
      for (const p of myPreds) {
        if (!inScope(p.match_id)) continue
        const r = resultsById.get(p.match_id)
        if (r) matchPts += scoreMatch(p, r).total
      }
      // Group position bonus + best thirds bonus only count in "total"
      let bonusPts = 0
      if (filter === 'total') {
        bonusPts += scoreGroupPositions(gpByUser.get(prof.id) || [], data.groupResults).total
        bonusPts += scoreThirds(tpByUser.get(prof.id) || [], actualThirds).total
      }
      return {
        id: prof.id,
        name: (prof.nickname || '').trim() || prof.display_name,
        avatar: (prof.avatar || '').trim() || '⚽',
        is_admin: prof.is_admin,
        paid: prof.paid,
        match_points: matchPts,
        bonus_points: bonusPts,
        total: matchPts + bonusPts,
        fines: finesByUser.get(prof.id) || 0,
      }
    }).sort((a, b) => b.total - a.total)

    // Ranking estilo golf: los empatados comparten puesto (T2) y el siguiente salta.
    // rank = índice del primer jugador con ese mismo puntaje + 1.
    sorted.forEach((r, i) => {
      if (i > 0 && r.total === sorted[i - 1].total) {
        r.rank = sorted[i - 1].rank          // mismo puntaje => mismo puesto
        r.tied = true
        sorted[i - 1].tied = true            // marcar también al de arriba
      } else {
        r.rank = i + 1                       // salta al puesto correspondiente
        r.tied = false
      }
    })
    return sorted
  }, [data, filter])

  const { user } = useAuth()

  // Historial de posición EN VIVO: compara el ranking actual contra el ranking
  // justo ANTES del último partido con resultado. Cada partido nuevo mueve las flechas.
  // Devuelve un mapa userId -> cambio de puestos (positivo = subió).
  const positionDelta = useMemo(() => {
    if (data.loading || filter !== 'total') return {}

    const results = data.results || []
    if (results.length === 0) return {}

    const resultsById = new Map(results.map(r => [r.match_id, r]))

    // Identificar el último partido con resultado (por hora de pitazo).
    // Ese es el que "acaba de pasar"; lo excluimos para el ranking "antes".
    let lastMatchId = null
    let lastKo = -Infinity
    for (const r of results) {
      const m = matchById(r.match_id)
      const ko = m?.kickoff_utc ? new Date(m.kickoff_utc).getTime() : 0
      if (ko >= lastKo) { lastKo = ko; lastMatchId = r.match_id }
    }
    if (!lastMatchId) return {}

    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }

    const scoreWith = (excludeMatchId) => {
      const arr = data.profiles.map(prof => {
        let pts = 0
        for (const p of (predsByUser.get(prof.id) || [])) {
          if (excludeMatchId && p.match_id === excludeMatchId) continue
          const r = resultsById.get(p.match_id)
          if (r) pts += scoreMatch(p, r).total
        }
        return { id: prof.id, pts }
      }).sort((a, b) => b.pts - a.pts)
      const rank = {}
      arr.forEach((s, i) => { rank[s.id] = i + 1 })
      return rank
    }

    const beforeRank = scoreWith(lastMatchId)  // ranking sin el último partido
    const afterRank = scoreWith(null)          // ranking con todo

    const delta = {}
    for (const prof of data.profiles) {
      const before = beforeRank[prof.id]
      const after = afterRank[prof.id]
      delta[prof.id] = (before && after) ? before - after : 0 // positivo = subió
    }
    return delta
  }, [data, filter])

  // "Qué necesito para ganar": para el usuario actual, cuántos puntos lo separan
  // del puesto de arriba y del primer lugar.
  const myGap = useMemo(() => {
    if (data.loading || filter !== 'total' || rows.length === 0) return null
    const myIdx = rows.findIndex(r => r.id === user.id)
    if (myIdx < 0) return null
    const me = rows[myIdx]
    const leader = rows[0]
    const ahead = myIdx > 0 ? rows[myIdx - 1] : null
    return {
      myIdx,
      myRank: myIdx + 1,
      isLeader: myIdx === 0,
      toAhead: ahead ? ahead.total - me.total : 0,
      aheadName: ahead ? ahead.name : null,
      toLeader: leader.total - me.total,
      leaderName: leader.name,
      total: rows.length,
    }
  }, [rows, filter, data.loading, user.id])

  const shareTable = async () => {
    setSharing(true)
    setShareMsg('')
    try {
      const canvas = await renderTableImage(rows, filter)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = new File([blob], 'tabla-dari-polla.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tabla Dari-polla',
          text: `Así va la Dari-polla 🐔 · ${filter === 'total' ? 'Acumulado' : (FECHA_LABELS[filter] || filter)}`,
        })
        setShareMsg('✅ Compartido')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'tabla-dari-polla.png'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setShareMsg('📥 Descargada')
      }
    } catch (e) {
      if (e.name !== 'AbortError') setShareMsg('❌ Error al compartir')
    } finally {
      setSharing(false)
      setTimeout(() => setShareMsg(''), 2500)
    }
  }

  // IDs que pagan multa en una vista de fecha: los 2 PEORES PUESTOS por puntaje,
  // y si hay empates en esos puestos, pagan todos los empatados.
  const finedIds = useMemo(() => {
    const set = new Set()
    if (filter === 'total' || rows.length <= 2) return set
    // Puntajes únicos, de menor a mayor (los dos primeros son los dos peores puestos)
    const uniqueScores = [...new Set(rows.map(r => r.total))].sort((a, b) => a - b)
    const worstTwo = new Set(uniqueScores.slice(0, 2))
    for (const r of rows) {
      if (worstTwo.has(r.total)) set.add(r.id)
    }
    return set
  }, [rows, filter])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-3">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🏆 Tabla de posiciones</h1>
        <p className="text-xs text-ink-300">
          {filter === 'total'
            ? 'Acumulado total con todas las predicciones.'
            : `Solo los puntos de ${FECHA_LABELS[filter] || filter}. Los dos últimos puestos pagan 5.000 COP (si hay empate, pagan todos).`}
        </p>
      </div>

      {myGap && (
        <div className="card bg-brand-900/20 border-brand-600/40">
          {myGap.isLeader ? (
            <div className="text-sm">
              <span className="font-semibold text-brand-400">👑 ¡Vas de líder!</span>{' '}
              <span className="text-ink-200">
                Te llevan {myGap.total > 1 ? `${rows[1].total} pts el segundo` : ''}. Defiende la cima.
              </span>
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-brand-400">🎯 ¿Qué necesitas para subir?</div>
              <div className="text-ink-200">
                Vas <strong>#{myGap.myRank}</strong> de {myGap.total}.{' '}
                {myGap.toAhead > 0
                  ? <>Te faltan <strong className="text-brand-300">{myGap.toAhead} {myGap.toAhead === 1 ? 'punto' : 'puntos'}</strong> para alcanzar a {myGap.aheadName}.</>
                  : <>Estás empatado con {myGap.aheadName} arriba — ¡un acierto y lo pasas!</>}
              </div>
              {myGap.toLeader > 0 && (
                <div className="text-xs text-ink-400">
                  El primer lugar ({myGap.leaderName}) te lleva {myGap.toLeader} pts.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={shareTable}
          disabled={sharing}
          className="text-sm px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-ink-600 text-ink-100 transition disabled:opacity-50"
        >
          {sharing ? '...' : '📤 Compartir tabla'}
        </button>
      </div>
      {shareMsg && <div className="text-xs text-center text-ink-300">{shareMsg}</div>}

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 sticky top-14 bg-ink-900 z-20 py-1">
        {FECHA_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
              filter === f.id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-ink-700 text-ink-300 text-xs uppercase">
            <tr>
              <th className="py-2 px-3 text-left">#</th>
              <th className="py-2 px-2 text-left">Jugador</th>
              <th className="py-2 px-2 text-right">Pts</th>
              {filter === 'total' && (
                <th className="py-2 px-2 text-right">Multas</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isBottom2 = finedIds.has(r.id)
              return (
                <tr
                  key={r.id}
                  className={`border-t border-ink-700 ${
                    idx === 0 && filter === 'total' ? 'bg-yellow-900/20' :
                    idx === 1 && filter === 'total' ? 'bg-ink-700/40' :
                    isBottom2 ? 'bg-red-900/20' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-mono text-ink-300">
                    <div className="flex items-center gap-1">
                      <span>{golfLabel(r.rank, r.tied, filter)}</span>
                      {filter === 'total' && positionDelta[r.id] != null && positionDelta[r.id] !== 0 && (
                        <span className={`text-[10px] ${positionDelta[r.id] > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {positionDelta[r.id] > 0 ? `▲${positionDelta[r.id]}` : `▼${Math.abs(positionDelta[r.id])}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-medium">{r.avatar} {r.name}</div>
                    <div className="text-xs text-ink-500">
                      {!r.paid && <span className="text-yellow-500">⚠ sin pagar</span>}
                      {r.is_admin && <span className="ml-1 text-brand-500">admin</span>}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="font-bold">{r.total}</div>
                    {filter === 'total' && r.bonus_points > 0 && (
                      <div className="text-xs text-ink-500">+{r.bonus_points} bonus</div>
                    )}
                  </td>
                  {filter === 'total' && (
                    <td className="py-2 px-2 text-right text-red-300">
                      {r.fines > 0 ? `-${(r.fines/1000).toFixed(0)}k` : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filter !== 'total' && rows.length > 2 && (
        <p className="text-xs text-ink-500 text-center">
          🔴 Los dos últimos puestos de esta fecha pagan 5.000 COP cada uno. Si hay empate en esos puestos, pagan todos los empatados.
          {' '}El admin debe cerrar la fecha para registrar las multas.
        </p>
      )}
    </div>
  )
}

// ===================================================================
// Generar imagen de la tabla para compartir (estilo Dari-polla naranja)
// ===================================================================
async function renderTableImage(rows, filter) {
  const top = rows.slice(0, 15) // primeros 15 para que quepan bien
  const W = 1080
  const rowH = 56
  const headerH = 360
  const footerH = 70
  const H = headerH + top.length * rowH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#7c2d12')
  grad.addColorStop(0.4, '#0f172a')
  grad.addColorStop(1, '#0f172a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ea580c'
  ctx.fillRect(0, 0, W, 12)

  // Logo
  try {
    const logo = await loadImg('/logo.png')
    const s = 130
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, 110, s / 2 + 6, 0, Math.PI * 2)
    ctx.fillStyle = 'white'; ctx.fill()
    ctx.beginPath(); ctx.arc(W / 2, 110, s / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(logo, W / 2 - s / 2, 110 - s / 2, s, s)
    ctx.restore()
  } catch (e) { /* sin logo */ }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f97316'
  ctx.font = 'bold 46px -apple-system, system-ui, sans-serif'
  ctx.fillText('DARI-POLLA', W / 2, 215)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '26px -apple-system, system-ui, sans-serif'
  const sub = filter === 'total' ? 'Tabla acumulada' : `Tabla · ${FECHA_LABELS[filter] || filter}`
  ctx.fillText(sub, W / 2, 255)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '20px -apple-system, system-ui, sans-serif'
  ctx.fillText(new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 290)

  // Filas
  let y = headerH
  for (let i = 0; i < top.length; i++) {
    const r = top[i]
    const medal = r.tied ? `T${r.rank}` : (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}`)
    if (i < 3) {
      ctx.fillStyle = i === 0 ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.04)'
      ctx.fillRect(40, y - rowH + 12, W - 80, rowH - 6)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px -apple-system, system-ui, sans-serif'
    ctx.fillText(medal, 70, y)
    ctx.font = '30px -apple-system, system-ui, sans-serif'
    const name = `${r.avatar} ${r.name}`
    ctx.fillText(name.length > 26 ? name.slice(0, 25) + '…' : name, 150, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fb923c'
    ctx.font = 'bold 32px -apple-system, system-ui, sans-serif'
    ctx.fillText(`${r.total}`, W - 70, y)
    y += rowH
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '22px -apple-system, system-ui, sans-serif'
  ctx.fillText('🐔 Dari-polla · Mundial 2026', W / 2, H - 28)

  return canvas
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
