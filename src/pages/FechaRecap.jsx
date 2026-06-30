import { useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import {
  playedMatches,
  fechaSummary,
  lastCompletedFecha,
  FECHA_ORDER,
} from '../lib/playerStats'
import { fechaMatchIds, FECHA_LABELS } from '../lib/matches'
import { buildResolver } from '../lib/bracketTeams'
import { displayName, displayAvatar } from '../lib/playerDisplay'

export default function FechaRecap() {
  const { user } = useAuth()
  const data = useLeagueData()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const resultsById = useMemo(
    () => new Map(data.results.map(r => [r.match_id, r])),
    [data.results]
  )

  // Fechas que tienen al menos un resultado, para el selector
  const availableFechas = useMemo(() => {
    return FECHA_ORDER.filter(fid => {
      const ids = fechaMatchIds(fid)
      return ids.some(id => resultsById.has(id))
    })
  }, [resultsById])

  const defaultFecha = useMemo(() => lastCompletedFecha(resultsById), [resultsById])
  const [fechaId, setFechaId] = useState(null)
  const activeFecha = fechaId || defaultFecha

  const recap = useMemo(() => {
    if (!activeFecha || data.loading) return null
    const myPreds = data.predictions.filter(p => p.user_id === user.id)
    const summary = fechaSummary(myPreds, resultsById, activeFecha)

    // Posición del usuario en el ranking de ESA fecha
    const ids = new Set(fechaMatchIds(activeFecha))
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
      predsByUser.get(p.user_id).push(p)
    }
    const ranking = []
    for (const [uid, preds] of predsByUser) {
      const rows = playedMatches(preds, resultsById)
      const pts = rows.filter(r => ids.has(r.match.id)).reduce((s, r) => s + r.points, 0)
      ranking.push({ uid, pts })
    }
    ranking.sort((a, b) => b.pts - a.pts)
    const myRank = ranking.findIndex(r => r.uid === user.id) + 1

    // Resolver nombres de playoffs en el "mejor partido" antes de mostrarlo
    const { resolveMatch } = buildResolver(data)
    if (summary?.best?.match) {
      summary.best = { ...summary.best, match: resolveMatch(summary.best.match) }
    }
    if (summary?.worst?.match) {
      summary.worst = { ...summary.worst, match: resolveMatch(summary.worst.match) }
    }
    return { summary, myRank, totalPlayers: ranking.length }
  }, [activeFecha, data, user.id, resultsById])

  const me = data.profiles.find(p => p.id === user.id)

  const handleShare = async () => {
    if (!recap) return
    setBusy(true)
    setMsg('')
    try {
      const canvas = await renderRecapImage(recap, me)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      const file = new File([blob], `resumen-${activeFecha}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mi resumen de la fecha',
          text: `Mi resumen de ${recap.summary.label} en la Dari-polla`,
        })
        setMsg('✅ Compartido')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `resumen-${activeFecha}.png`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setMsg('📥 Descargado')
      }
    } catch (e) {
      if (e.name !== 'AbortError') setMsg('❌ Error al compartir')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 2000)
    }
  }

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  if (availableFechas.length === 0) {
    return (
      <div className="space-y-3">
        <div className="card">
          <h1 className="text-xl font-bold mb-1">📋 Resumen de fecha</h1>
        </div>
        <div className="card text-center py-8 text-ink-300">
          <div className="text-3xl mb-2">⏳</div>
          <div>Todavía no hay fechas con resultados.</div>
          <div className="text-xs mt-1">Cuando se jueguen partidos, aquí verás tu resumen para compartir.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">📋 Resumen de fecha</h1>
        <p className="text-xs text-ink-300">Mira cómo te fue en cada jornada y compártelo.</p>
      </div>

      {/* Selector de fecha */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {availableFechas.map(fid => (
          <button
            key={fid}
            onClick={() => setFechaId(fid)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
              activeFecha === fid ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-300'
            }`}
          >
            {FECHA_LABELS[fid] || fid}
          </button>
        ))}
      </div>

      {recap && (
        <>
          {/* Tarjeta de resumen (preview) */}
          <div className="card bg-gradient-to-br from-brand-700 to-ink-900 border-brand-600/40">
            <div className="text-center">
              <div className="text-4xl mb-1">{displayAvatar(me)}</div>
              <div className="font-bold">{displayName(me)}</div>
              <div className="text-xs text-ink-300">{recap.summary.label}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <RecapStat value={recap.summary.points} label="puntos" />
              <RecapStat value={recap.summary.exacts} label="exactos" />
              <RecapStat value={recap.myRank > 0 ? `#${recap.myRank}` : '—'} label={`de ${recap.totalPlayers}`} />
            </div>

            {recap.summary.best && (
              <div className="mt-4 bg-ink-900/50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-ink-400 uppercase tracking-wider">Tu mejor acierto</div>
                <div className="text-sm font-medium mt-0.5">
                  {recap.summary.best.match.team1} {recap.summary.best.result.score1}-{recap.summary.best.result.score2} {recap.summary.best.match.team2}
                </div>
                <div className="text-xs text-brand-400">+{recap.summary.best.points} pts</div>
              </div>
            )}

            <div className="mt-3 text-center text-sm">
              {recap.myRank === 1 ? (
                <span className="text-brand-400">👑 ¡Ganaste la fecha!</span>
              ) : recap.myRank <= 3 ? (
                <span className="text-brand-400">🎉 ¡Podio en esta fecha!</span>
              ) : (
                <span className="text-ink-300">{frase(recap.summary.points)}</span>
              )}
            </div>
          </div>

          {msg && <div className="text-sm text-center bg-ink-800 rounded-lg px-3 py-2">{msg}</div>}

          <button onClick={handleShare} disabled={busy} className="btn-primary w-full">
            {busy ? '…' : '📤 Compartir mi resumen'}
          </button>
        </>
      )}
    </div>
  )
}

function RecapStat({ value, label }) {
  return (
    <div className="text-center bg-ink-900/40 rounded-lg py-2">
      <div className="text-2xl font-bold text-brand-400">{value}</div>
      <div className="text-[10px] text-ink-300">{label}</div>
    </div>
  )
}

function frase(points) {
  if (points >= 30) return '¡Tremenda fecha! 🔥'
  if (points >= 15) return 'Buena fecha 👏'
  if (points > 0) return 'A seguir sumando 💪'
  return 'Fecha para olvidar 😅'
}

/**
 * Dibuja la imagen del resumen para compartir (estilo Dari-polla naranja).
 */
async function renderRecapImage(recap, me) {
  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#7c2d12')
  grad.addColorStop(0.5, '#0f172a')
  grad.addColorStop(1, '#0f172a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ea580c'
  ctx.fillRect(0, 0, W, 12)

  // Logo
  try {
    const logo = await loadImage('/logo.png')
    const s = 150
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, 170, s / 2 + 8, 0, Math.PI * 2)
    ctx.fillStyle = 'white'; ctx.fill()
    ctx.beginPath(); ctx.arc(W / 2, 170, s / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(logo, W / 2 - s / 2, 170 - s / 2, s, s)
    ctx.restore()
  } catch (e) { /* sin logo */ }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f97316'
  ctx.font = 'bold 40px -apple-system, system-ui, sans-serif'
  ctx.fillText('DARI-POLLA', W / 2, 300)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '26px -apple-system, system-ui, sans-serif'
  ctx.fillText(`Resumen · ${recap.summary.label}`, W / 2, 345)

  // Nombre
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px -apple-system, system-ui, sans-serif'
  const name = (me?.nickname || '').trim() || me?.display_name || 'Jugador'
  const avatar = (me?.avatar || '').trim() || '⚽'
  ctx.fillText(`${avatar} ${name}`, W / 2, 430)

  // 3 stats grandes
  const stats = [
    { v: String(recap.summary.points), l: 'PUNTOS' },
    { v: String(recap.summary.exacts), l: 'EXACTOS' },
    { v: recap.myRank > 0 ? `#${recap.myRank}` : '—', l: `DE ${recap.totalPlayers}` },
  ]
  const boxW = 280, gap = 30
  const totalW = boxW * 3 + gap * 2
  let sx = (W - totalW) / 2
  const sy = 500
  for (const s of stats) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, sx, sy, boxW, 200, 20); ctx.fill()
    ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#fb923c'
    ctx.font = 'bold 80px -apple-system, system-ui, sans-serif'
    ctx.fillText(s.v, sx + boxW / 2, sy + 110)
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '24px -apple-system, system-ui, sans-serif'
    ctx.fillText(s.l, sx + boxW / 2, sy + 160)
    sx += boxW + gap
  }

  // Mejor acierto
  if (recap.summary.best) {
    const b = recap.summary.best
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '24px -apple-system, system-ui, sans-serif'
    ctx.fillText('Mejor acierto', W / 2, 790)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px -apple-system, system-ui, sans-serif'
    ctx.fillText(
      `${b.match.team1} ${b.result.score1}-${b.result.score2} ${b.match.team2}`,
      W / 2, 840
    )
    ctx.fillStyle = '#fb923c'
    ctx.font = 'bold 30px -apple-system, system-ui, sans-serif'
    ctx.fillText(`+${b.points} pts`, W / 2, 885)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '22px -apple-system, system-ui, sans-serif'
  ctx.fillText('🐔 Dari-polla · Mundial 2026', W / 2, 1020)

  return canvas
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
