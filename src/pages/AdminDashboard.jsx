import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, matchById, fechaMatchIds, FECHA_LABELS, isMatchLocked, hasMatchStarted } from '../lib/matches'
import { FECHA_ORDER } from '../lib/playerStats'
import { scoreMatch } from '../lib/scoring'

export default function AdminDashboard() {
  const data = useLeagueData()
  const [copied, setCopied] = useState('')

  const stats = useMemo(() => {
    if (data.loading) return null

    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    const predsByUser = new Map()
    for (const p of data.predictions) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, new Map())
      predsByUser.get(p.user_id).set(p.match_id, p)
    }

    // Próximos partidos abiertos (aún se pueden predecir)
    const openMatches = TOURNAMENT.matches.filter(
      m => m.kickoff_utc && !isMatchLocked(m) &&
        !m.team1?.match(/^[0-9WL]/) && !m.team2?.match(/^[0-9WL]/)
    ).sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))

    const nextMatch = openMatches[0] || null

    // ¿Quién NO ha puesto el próximo partido?
    const missingNext = []
    if (nextMatch) {
      for (const prof of data.profiles) {
        const has = predsByUser.get(prof.id)?.has(nextMatch.id)
        if (!has) missingNext.push(prof)
      }
    }

    // ¿Quién no ha puesto NINGÚN partido de los próximos abiertos? (completamente ausente)
    const next5 = openMatches.slice(0, 5)
    const missingAllUpcoming = []
    for (const prof of data.profiles) {
      const userPreds = predsByUser.get(prof.id)
      const anyUpcoming = next5.some(m => userPreds?.has(m.id))
      if (!anyUpcoming && next5.length > 0) missingAllUpcoming.push(prof)
    }

    // ¿Quién lleva 2+ fechas sin predecir? (fechas ya jugadas donde no metió nada)
    const playedFechas = FECHA_ORDER.filter(fid => {
      const ids = fechaMatchIds(fid)
      return ids.some(id => resultsById.has(id))
    })
    const inactiveStreak = []
    for (const prof of data.profiles) {
      const userPreds = predsByUser.get(prof.id)
      let consecutiveMissed = 0, maxConsecutive = 0
      for (const fid of playedFechas) {
        const ids = fechaMatchIds(fid)
        const predictedAny = ids.some(id => userPreds?.has(id))
        if (!predictedAny) { consecutiveMissed++; maxConsecutive = Math.max(maxConsecutive, consecutiveMissed) }
        else consecutiveMissed = 0
      }
      // racha de fechas sin predecir corriendo desde la última
      let current = 0
      for (let i = playedFechas.length - 1; i >= 0; i--) {
        const ids = fechaMatchIds(playedFechas[i])
        const predictedAny = ids.some(id => userPreds?.has(id))
        if (!predictedAny) current++
        else break
      }
      if (current >= 2) inactiveStreak.push({ prof, missed: current })
    }

    // Pagos pendientes
    const unpaid = data.profiles.filter(p => !p.paid)

    // Partidos jugados sin resultado cargado (para que el admin no olvide)
    const playedNoResult = TOURNAMENT.matches.filter(
      m => m.kickoff_utc && hasMatchStarted(m) && !resultsById.has(m.id) &&
        !m.team1?.match(/^[0-9WL]/) && !m.team2?.match(/^[0-9WL]/) &&
        // que ya haya terminado (estimado): pitazo hace +2.5h
        (Date.now() - new Date(m.kickoff_utc).getTime()) > 2.5 * 3600 * 1000
    )

    // Tasa de participación general
    const totalPossiblePreds = data.profiles.length * playedFechas.reduce((s, fid) => s + fechaMatchIds(fid).filter(id => resultsById.has(id)).length, 0)
    const actualPreds = data.predictions.filter(p => resultsById.has(p.match_id)).length
    const participationRate = totalPossiblePreds ? Math.round((actualPreds / totalPossiblePreds) * 100) : 0

    // Tendencia de participación por fecha (cómo evoluciona el enganche)
    const participationByFecha = playedFechas.map(fid => {
      const ids = fechaMatchIds(fid).filter(id => resultsById.has(id))
      let predsCount = 0
      const possible = data.profiles.length * ids.length
      for (const prof of data.profiles) {
        const up = predsByUser.get(prof.id)
        for (const id of ids) if (up?.has(id)) predsCount++
      }
      return {
        fecha: FECHA_LABELS[fid] || fid,
        pct: possible ? Math.round((predsCount / possible) * 100) : 0,
      }
    })

    // Predicciones de último minuto: quién suele guardar cerca del cierre.
    // Usamos created_at/updated_at de la predicción vs kickoff del partido.
    const lastMinuteCounts = new Map() // uid -> { count, total }
    for (const p of data.predictions) {
      const m = matchById(p.match_id)
      if (!m?.kickoff_utc) continue
      const ts = p.updated_at || p.created_at
      if (!ts) continue
      const ko = new Date(m.kickoff_utc).getTime()
      const saved = new Date(ts).getTime()
      const minsBefore = (ko - saved) / 60000
      if (minsBefore < 0) continue
      if (!lastMinuteCounts.has(p.user_id)) lastMinuteCounts.set(p.user_id, { count: 0, total: 0 })
      const c = lastMinuteCounts.get(p.user_id)
      c.total++
      if (minsBefore <= 60) c.count++ // guardó en la última hora antes del pitazo
    }
    const lastMinuters = []
    for (const prof of data.profiles) {
      const c = lastMinuteCounts.get(prof.id)
      if (c && c.total >= 3 && c.count / c.total >= 0.5) {
        lastMinuters.push({ prof, pct: Math.round((c.count / c.total) * 100) })
      }
    }
    lastMinuters.sort((a, b) => b.pct - a.pct)

    return {
      nextMatch, missingNext, missingAllUpcoming, inactiveStreak, unpaid,
      playedNoResult, participationRate, participationByFecha, lastMinuters,
      totalPlayers: data.profiles.length,
    }
  }, [data])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>
  if (!stats) return null

  const nameOf = (p) => (p.nickname || '').trim() || p.display_name

  const copyList = (people, intro) => {
    const names = people.map(nameOf).join(', ')
    const text = `${intro}\n\n${names}`
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(intro); setTimeout(() => setCopied(''), 2000) },
      () => {}
    )
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="card">
        <h1 className="text-xl font-bold mb-1">🛡️ Panel de control</h1>
        <p className="text-xs text-ink-300">
          Control de participación y pendientes. Solo visible para administradores.
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-brand-500">{stats.totalPlayers}</div>
          <div className="text-[10px] text-ink-400">jugadores</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-brand-500">{stats.participationRate}%</div>
          <div className="text-[10px] text-ink-400">participación</div>
        </div>
        <div className="card text-center py-3">
          <div className={`text-2xl font-bold ${stats.unpaid.length > 0 ? 'text-yellow-500' : 'text-green-500'}`}>{stats.unpaid.length}</div>
          <div className="text-[10px] text-ink-400">sin pagar</div>
        </div>
      </div>

      {/* Partidos jugados sin resultado — lo más urgente para el admin */}
      {stats.playedNoResult.length > 0 && (
        <div className="card bg-red-900/20 border border-red-600">
          <h2 className="font-semibold text-red-200 mb-2">⚠️ Resultados pendientes de cargar</h2>
          <div className="space-y-1">
            {stats.playedNoResult.map(m => (
              <Link key={m.id} to="/admin/marcadores" className="text-sm flex justify-between items-center hover:bg-red-900/20 rounded px-1 py-0.5">
                <span>{m.team1} vs {m.team2}</span>
                <span className="text-brand-300 text-xs">Cargar →</span>
              </Link>
            ))}
          </div>
          <div className="text-[10px] text-red-300/80 mt-2">Toca un partido para ir a cargar su marcador.</div>
        </div>
      )}

      {/* Quién no ha puesto el próximo partido */}
      {stats.nextMatch && (
        <div className="card">
          <h2 className="font-semibold mb-1">📋 Falta predecir el próximo</h2>
          <div className="text-xs text-ink-400 mb-2">
            {stats.nextMatch.team1} vs {stats.nextMatch.team2} · {stats.missingNext.length} sin predecir
          </div>
          {stats.missingNext.length === 0 ? (
            <div className="text-sm text-green-400">✅ ¡Todos pusieron su marcador!</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {stats.missingNext.map(p => (
                  <span key={p.id} className="text-xs bg-ink-700 rounded px-2 py-0.5">
                    {nameOf(p)}
                  </span>
                ))}
              </div>
              <button
                onClick={() => copyList(stats.missingNext,
                  `⚽ ¡Falta poner el marcador de ${stats.nextMatch.team1} vs ${stats.nextMatch.team2}! No se les olvide pronosticar 👇`)}
                className="mt-2 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-1.5"
              >
                📋 Copiar lista para WhatsApp
              </button>
            </>
          )}
        </div>
      )}

      {/* Quién lleva 2+ fechas sin predecir */}
      <div className="card">
        <h2 className="font-semibold mb-1">😴 Inactivos (2+ fechas sin predecir)</h2>
        {stats.inactiveStreak.length === 0 ? (
          <div className="text-sm text-green-400">✅ Nadie lleva 2 fechas seguidas sin predecir.</div>
        ) : (
          <div className="space-y-1">
            {stats.inactiveStreak.sort((a, b) => b.missed - a.missed).map(({ prof, missed }) => (
              <div key={prof.id} className="text-sm flex justify-between items-center">
                <span>{nameOf(prof)}</span>
                <span className="text-xs text-orange-400">{missed} fechas 😴</span>
              </div>
            ))}
          </div>
        )}
        {stats.inactiveStreak.length > 0 && (
          <button
            onClick={() => copyList(stats.inactiveStreak.map(i => i.prof),
              '👀 ¡Los extrañamos en la polla! Llevan varias fechas sin pronosticar, vuelvan que se están perdiendo los puntos 🔥')}
            className="mt-2 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-1.5"
          >
            📋 Copiar lista para WhatsApp
          </button>
        )}
        <div className="text-[10px] text-ink-500 mt-2">Buen momento para escribirles por WhatsApp.</div>
      </div>

      {/* Completamente ausentes de los próximos */}
      {stats.missingAllUpcoming.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">👻 Sin ningún pronóstico próximo</h2>
          <div className="text-xs text-ink-400 mb-2">No han puesto nada en los próximos partidos abiertos.</div>
          <div className="flex flex-wrap gap-1">
            {stats.missingAllUpcoming.map(p => (
              <span key={p.id} className="text-xs bg-ink-700 rounded px-2 py-0.5">
                {nameOf(p)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pagos pendientes */}
      {stats.unpaid.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1 text-yellow-300">💰 Pagos pendientes</h2>
          <div className="flex flex-wrap gap-1">
            {stats.unpaid.map(p => (
              <span key={p.id} className="text-xs bg-yellow-900/30 text-yellow-200 rounded px-2 py-0.5">
                {nameOf(p)}
              </span>
            ))}
          </div>
          <button
            onClick={() => copyList(stats.unpaid,
              '💰 Recordatorio amistoso: aún falta confirmar tu pago de la polla 🙏 Avísale a Dari cuando transfieras.')}
            className="mt-2 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-1.5"
          >
            📋 Copiar lista para WhatsApp
          </button>
        </div>
      )}

      {/* Tendencia de participación por fecha */}
      {stats.participationByFecha.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">📈 Tendencia de participación</h2>
          <div className="space-y-1.5">
            {stats.participationByFecha.map(f => (
              <div key={f.fecha} className="flex items-center gap-2">
                <span className="text-[10px] text-ink-400 w-14 shrink-0">{f.fecha}</span>
                <div className="flex-1 bg-ink-900 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full ${f.pct >= 80 ? 'bg-green-500' : f.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${f.pct}%` }} />
                </div>
                <span className="text-[10px] text-ink-300 w-9 text-right">{f.pct}%</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-ink-500 mt-2">% de marcadores puestos sobre el total posible, por fecha.</div>
        </div>
      )}

      {/* Predicciones de último minuto */}
      {stats.lastMinuters.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">⏰ Suelen poner sobre la hora</h2>
          <div className="text-xs text-ink-400 mb-2">Estos guardan más de la mitad de sus predicciones en la última hora antes del pitazo. Avísales temprano.</div>
          <div className="space-y-1">
            {stats.lastMinuters.map(({ prof, pct }) => (
              <div key={prof.id} className="text-sm flex justify-between items-center">
                <span>{nameOf(prof)}</span>
                <span className="text-xs text-orange-400">{pct}% a última hora</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => copyList(stats.lastMinuters.map(l => l.prof),
              '⏰ ¡Aviso anticipado! Pongan sus marcadores con tiempo que el partido se acerca 😅')}
            className="mt-2 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-1.5"
          >
            📋 Copiar lista para WhatsApp
          </button>
        </div>
      )}

      {/* Toast de copiado */}
      {copied && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          ✅ Lista copiada
        </div>
      )}
    </div>
  )
}
