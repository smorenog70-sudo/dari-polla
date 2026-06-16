import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, formatKickoff, isMatchLocked, fechaMatchIds, FECHA_LABELS, matchById } from '../lib/matches'
import { teamWithFlag, flagFor } from '../lib/flags'
import { useNowTick } from '../lib/useNowTick'
import {
  scoreMatch,
  scoreGroupPositions,
  scoreThirds,
} from '../lib/scoring'
import { playedMatches, streaks, lastCompletedFecha } from '../lib/playerStats'
import PendingMatchesBanner from '../components/PendingMatchesBanner'
import NewResultsBanner from '../components/NewResultsBanner'
import NewAchievementsBanner from '../components/NewAchievementsBanner'
import { useNewResults } from '../lib/useNewResults'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

// Cuenta regresiva compacta
// Devuelve el tiempo restante hasta `target` (ms). Incluye segundos solo si
// faltan 15 min o menos, para que el segundero corra en la recta final.
function countdownTo(targetMs, now) {
  const ms = targetMs - now
  if (ms <= 0) return null
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const showSeconds = ms <= 15 * 60 * 1000 // 15 min
  if (d >= 1) return `${d}d ${h}h`
  if (h >= 1) return `${h}h ${m}m`
  if (showSeconds) return `${m}:${String(s).padStart(2, '0')}`
  return `${m}m`
}

// Estado estimado de un partido en curso desde su pitazo.
// Tiempos: 1T 45'+7' rep · descanso 15' · 2T 45'+7' rep.
function liveStatus(kickoffUtc, now) {
  const ko = new Date(kickoffUtc).getTime()
  const elapsedMin = (now - ko) / 60000
  if (elapsedMin < 0) return null

  const FIRST_END = 45 + 7          // 52'
  const HALFTIME_END = FIRST_END + 15  // 67'
  const SECOND_END = HALFTIME_END + 45 + 7 // 119'

  if (elapsedMin <= FIRST_END) {
    const m = Math.floor(elapsedMin)
    return { phase: '1T', label: m > 45 ? `45+${m - 45}'` : `${m}'`, live: true }
  }
  if (elapsedMin <= HALFTIME_END) {
    return { phase: 'HT', label: 'Descanso', live: true }
  }
  if (elapsedMin <= SECOND_END) {
    const since = elapsedMin - HALFTIME_END
    const m = Math.floor(45 + since)
    return { phase: '2T', label: m > 90 ? `90+${m - 90}'` : `${m}'`, live: true }
  }
  return { phase: 'FT', label: 'Finalizando', live: false }
}

function googleSearchUrl(team1, team2) {
  const q = `Copa mundo fifa ${team1} ${team2}`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

export default function Home() {
  const { user, profile } = useAuth()
  const data = useLeagueData()
  const { newResults, totalNewPoints, dismiss: dismissResults } = useNewResults(user.id)
  const now = useNowTick(1000)

  const myPreds = useMemo(
    () => data.predictions.filter(p => p.user_id === user.id),
    [data.predictions, user.id]
  )

  const stats = useMemo(() => {
    const myGroupPreds = data.groupPreds.filter(p => p.user_id === user.id)
    const myThirdPreds = data.thirdPreds.filter(p => p.user_id === user.id)

    const resultsById = new Map(data.results.map(r => [r.match_id, r]))
    let pts = 0
    for (const p of myPreds) {
      const r = resultsById.get(p.match_id)
      if (r) pts += scoreMatch(p, r).total
    }
    pts += scoreGroupPositions(myGroupPreds, data.groupResults).total
    pts += scoreThirds(myThirdPreds.map(t => t.team), data.thirdResults.map(t => t.team)).total

    const entryFee = Number(data.config.entry_fee || 50000)
    const fineAmount = Number(data.config.fine_amount || 5000)
    const paidProfiles = data.profiles.filter(p => p.paid)
    const finesTotal = data.fines.reduce((sum, f) => sum + (f.amount || fineAmount), 0)
    const bolsa = paidProfiles.length * entryFee + finesTotal

    const myFines = data.fines.filter(f => f.user_id === user.id)

    // Posición actual en la tabla general (por puntos de partidos + bonus)
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
    const actualThirds = data.thirdResults.map(r => r.team)
    const totals = data.profiles.map(prof => {
      let p2 = 0
      for (const p of (predsByUser.get(prof.id) || [])) {
        const r = resultsById.get(p.match_id)
        if (r) p2 += scoreMatch(p, r).total
      }
      p2 += scoreGroupPositions(gpByUser.get(prof.id) || [], data.groupResults).total
      p2 += scoreThirds(tpByUser.get(prof.id) || [], actualThirds).total
      return { id: prof.id, pts: p2 }
    }).sort((a, b) => b.pts - a.pts)
    const myRank = totals.findIndex(t => t.id === user.id) + 1

    // Líderes destacados: GOAT (#1 general) y rey de la última fecha jugada
    const profById = {}
    for (const p of data.profiles) profById[p.id] = p
    const nameOf = (id) => {
      const p = profById[id]
      return p ? ((p.nickname || '').trim() || p.display_name) : '—'
    }
    const goatId = totals[0] && totals[0].pts > 0 ? totals[0].id : null

    // Rey de la última fecha completada
    let kingName = null, kingFecha = null
    const lastFecha = lastCompletedFecha(resultsById)
    if (lastFecha) {
      const ids = new Set(fechaMatchIds(lastFecha))
      const fechaScores = data.profiles.map(prof => {
        let p2 = 0
        for (const p of (predsByUser.get(prof.id) || [])) {
          if (!ids.has(p.match_id)) continue
          const r = resultsById.get(p.match_id)
          if (r) p2 += scoreMatch(p, r).total
        }
        return { id: prof.id, pts: p2 }
      }).sort((a, b) => b.pts - a.pts)
      if (fechaScores[0] && fechaScores[0].pts > 0) {
        kingName = nameOf(fechaScores[0].id)
        kingFecha = FECHA_LABELS[lastFecha] || lastFecha
      }
    }

    // Rey del ÚLTIMO PARTIDO (el más reciente con resultado, por hora de pitazo)
    let matchKingName = null, matchKingLabel = null, matchKingPts = 0, matchKingId = null
    let lastMatchId = null, lastKo = -Infinity
    for (const r of data.results) {
      const m = matchById(r.match_id)
      const ko = m?.kickoff_utc ? new Date(m.kickoff_utc).getTime() : 0
      if (ko >= lastKo) { lastKo = ko; lastMatchId = r.match_id }
    }
    if (lastMatchId) {
      const lm = matchById(lastMatchId)
      const lr = resultsById.get(lastMatchId)
      const scores = data.profiles.map(prof => {
        const p = (predsByUser.get(prof.id) || []).find(x => x.match_id === lastMatchId)
        const pts = (p && lr) ? scoreMatch(p, lr).total : 0
        return { id: prof.id, pts }
      }).sort((a, b) => b.pts - a.pts)
      if (scores[0] && scores[0].pts > 0) {
        matchKingName = nameOf(scores[0].id)
        matchKingId = scores[0].id
        matchKingPts = scores[0].pts
        matchKingLabel = lm ? `${lm.team1?.slice(0,3).toUpperCase()}-${lm.team2?.slice(0,3).toUpperCase()}` : ''
      }
    }

    // Rey del DÍA (más puntos sumando todos los partidos del último día con resultado)
    let dayKingName = null, dayKingPts = 0, dayKingLabel = null, dayKingId = null
    if (lastMatchId) {
      const lm = matchById(lastMatchId)
      const lastDayKey = lm?.kickoff_utc ? new Date(lm.kickoff_utc).toLocaleDateString('en-CA') : null
      if (lastDayKey) {
        // partidos de ese día con resultado
        const dayMatchIds = new Set()
        for (const r of data.results) {
          const m = matchById(r.match_id)
          if (m?.kickoff_utc && new Date(m.kickoff_utc).toLocaleDateString('en-CA') === lastDayKey) {
            dayMatchIds.add(r.match_id)
          }
        }
        const dayScores = data.profiles.map(prof => {
          let p2 = 0
          for (const p of (predsByUser.get(prof.id) || [])) {
            if (!dayMatchIds.has(p.match_id)) continue
            const r = resultsById.get(p.match_id)
            if (r) p2 += scoreMatch(p, r).total
          }
          return { id: prof.id, pts: p2 }
        }).sort((a, b) => b.pts - a.pts)
        if (dayScores[0] && dayScores[0].pts > 0) {
          dayKingName = nameOf(dayScores[0].id)
          dayKingId = dayScores[0].id
          dayKingPts = dayScores[0].pts
          const d = new Date(lastDayKey + 'T12:00:00')
          const today = new Date(); today.setHours(0,0,0,0)
          const diff = Math.round((new Date(lastDayKey + 'T12:00:00').setHours(0,0,0,0) - today) / 86400000)
          dayKingLabel = diff === 0 ? 'Hoy' : diff === -1 ? 'Ayer'
            : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')
        }
      }
    }

    // Racha actual
    const myRows = playedMatches(myPreds, resultsById)
    const { current: streak } = streaks(myRows)

    return {
      myPreds: myPreds.length,
      myGroupPreds: myGroupPreds.length,
      myThirdPreds: myThirdPreds.length,
      myPoints: pts,
      myRank,
      streak,
      myFines: myFines.length,
      myFinesCOP: myFines.reduce((s, f) => s + (f.amount || fineAmount), 0),
      bolsa,
      players: data.profiles.length,
      playersPaid: paidProfiles.length,
      totalPlayers: totals.length,
      goatName: goatId ? nameOf(goatId) : null,
      goatIsMe: goatId === user.id,
      kingName,
      kingFecha,
      matchKingName, matchKingLabel, matchKingPts,
      matchKingIsMe: matchKingId === user.id,
      dayKingName, dayKingPts, dayKingLabel,
      dayKingIsMe: dayKingId === user.id,
    }
  }, [data, user.id, myPreds])

  const nextMatch = useMemo(() => {
    return TOURNAMENT.matches
      .filter(m => m.kickoff_utc && new Date(m.kickoff_utc).getTime() > now)
      .filter(m => !m.team1?.match(/^[0-9WL]/) && !m.team2?.match(/^[0-9WL]/))
      .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))[0]
  }, [now])

  // ¿Ya pronostiqué el próximo partido?
  const nextPredicted = useMemo(() => {
    if (!nextMatch) return false
    return myPreds.some(p => p.match_id === nextMatch.id)
  }, [nextMatch, myPreds])

  // Partidos EN CURSO: ya pasó el pitazo, sin resultado oficial, dentro del tiempo estimado
  const liveMatches = useMemo(() => {
    const resultIds = new Set(data.results.map(r => r.match_id))
    return TOURNAMENT.matches
      .filter(m => m.kickoff_utc && !m.team1?.match(/^[0-9WL]/) && !m.team2?.match(/^[0-9WL]/))
      .filter(m => !resultIds.has(m.id)) // sin resultado oficial cargado
      .map(m => ({ match: m, status: liveStatus(m.kickoff_utc, now) }))
      .filter(x => x.status && x.status.live) // en juego (no terminados)
      .sort((a, b) => new Date(a.match.kickoff_utc) - new Date(b.match.kickoff_utc))
  }, [data.results, now])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  const firstName = profile?.display_name ? profile.display_name.split(' ')[0] : ''
  const rankSuffix = stats.myRank === 1 ? 'er' : stats.myRank === 2 ? 'do' : stats.myRank === 3 ? 'er' : 'º'

  return (
    <div className="space-y-4">
      {/* Saludo */}
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="Dari-polla"
          className="w-14 h-14 rounded-2xl shadow-lg shadow-brand-900/40 shrink-0"
        />
        <div>
          <p className="text-sm text-ink-300">¡Hola{firstName ? `, ${firstName}` : ''}! 👋</p>
          <h1 className="text-2xl font-bold mt-0.5 leading-none">Dari-polla</h1>
          <p className="text-xs text-ink-400 mt-0.5">Mundial 2026</p>
        </div>
      </div>

      {!profile?.paid && (
        <div className="p-3 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm">
          ⚠️ Tu pago de 50.000 COP aún no está confirmado. Transfiérele a Dari y avísale.
        </div>
      )}

      {/* Banners */}
      <NewResultsBanner newResults={newResults} totalNewPoints={totalNewPoints} dismiss={dismissResults} />
      <PendingMatchesBanner userPredictions={myPreds} />
      <NewAchievementsBanner />

      {/* PARTIDOS EN CURSO */}
      {liveMatches.length > 0 && (
        <div className="space-y-2">
          {liveMatches.map(({ match, status }) => (
            <a
              key={match.id}
              href={googleSearchUrl(match.team1, match.team2)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl p-4 bg-gradient-to-br from-red-900/40 via-ink-900 to-ink-900 border border-red-700/50 hover:border-red-500 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-red-300">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  En vivo
                </span>
                <span className="text-xs font-mono font-bold text-red-300">
                  {status.phase === 'HT' ? '⏸ Descanso' : `⏱ ~${status.label}`}
                </span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-3xl mb-1">{flagFor(match.team1) || '⚽'}</div>
                  <div className="font-bold text-sm leading-tight">{match.team1}</div>
                </div>
                <div className="text-ink-500 font-bold text-sm px-2">VS</div>
                <div className="flex-1 text-center">
                  <div className="text-3xl mb-1">{flagFor(match.team2) || '⚽'}</div>
                  <div className="font-bold text-sm leading-tight">{match.team2}</div>
                </div>
              </div>
              <div className="mt-3 text-center text-sm font-medium rounded-lg py-2 bg-ink-800 text-brand-300">
                🔍 Ver marcador en Google →
              </div>
              <div className="text-[9px] text-ink-500 text-center mt-1.5">
                Minuto estimado desde el pitazo (puede variar por descuentos)
              </div>
            </a>
          ))}
        </div>
      )}

      {/* HERO: próximo partido */}
      {nextMatch && (() => {
        const ko = new Date(nextMatch.kickoff_utc).getTime()
        const closeMs = ko - 10 * 60 * 1000 // cierre de predicciones: 10 min antes
        const predCountdown = countdownTo(closeMs, now)   // tiempo para predecir
        const startCountdown = countdownTo(ko, now)        // tiempo para el pitazo
        const predClosed = predCountdown === null
        return (
        <Link
          to="/predicciones"
          className="block rounded-2xl p-4 bg-gradient-to-br from-brand-700/50 via-brand-900/30 to-ink-900 border border-brand-600/40 hover:border-brand-500 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider text-brand-300 font-semibold">⚡ Próximo partido</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 text-center">
              <div className="text-4xl mb-1">{flagFor(nextMatch.team1) || '⚽'}</div>
              <div className="font-bold text-sm leading-tight">{nextMatch.team1}</div>
            </div>
            <div className="text-ink-500 font-bold text-lg px-2">VS</div>
            <div className="flex-1 text-center">
              <div className="text-4xl mb-1">{flagFor(nextMatch.team2) || '⚽'}</div>
              <div className="font-bold text-sm leading-tight">{nextMatch.team2}</div>
            </div>
          </div>
          <div className="text-center text-xs text-ink-300 mt-3">
            {formatKickoff(nextMatch.kickoff_utc)}
          </div>

          {/* Dos contadores */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className={`rounded-lg py-2 px-2 text-center ${predClosed ? 'bg-ink-800/60' : 'bg-ink-900/60'}`}>
              <div className="text-[9px] uppercase tracking-wider text-ink-400 leading-tight">
                ✏️ Para predecir
              </div>
              <div className={`font-mono font-bold mt-0.5 ${
                predClosed ? 'text-ink-500 text-xs' : predCountdown.includes(':') ? 'text-red-400 text-lg' : 'text-brand-300 text-base'
              }`}>
                {predClosed ? 'Cerrado' : predCountdown}
              </div>
            </div>
            <div className="rounded-lg py-2 px-2 text-center bg-ink-900/60">
              <div className="text-[9px] uppercase tracking-wider text-ink-400 leading-tight">
                ⏱ Para el pitazo
              </div>
              <div className={`font-mono font-bold mt-0.5 ${
                startCountdown && startCountdown.includes(':') ? 'text-green-400 text-lg' : 'text-ink-200 text-base'
              }`}>
                {startCountdown || '¡En juego!'}
              </div>
            </div>
          </div>

          <div className={`mt-3 text-center text-sm font-medium rounded-lg py-2 ${
            nextPredicted
              ? 'bg-green-900/30 text-green-300'
              : predClosed
                ? 'bg-ink-700 text-ink-400'
                : 'bg-brand-600 text-white'
          }`}>
            {nextPredicted ? '✓ Ya pronosticaste' : predClosed ? '🔒 Predicciones cerradas' : '✏️ Pronosticar ahora →'}
          </div>
        </Link>
        )
      })()}

      {/* Líderes actuales */}
      {(stats.goatName || stats.kingName) && (
        <div className="grid grid-cols-2 gap-3">
          {stats.goatName && (
            <Link to="/tabla" className="card text-center hover:bg-ink-700 transition">
              <div className="text-2xl">🐐</div>
              <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-0.5">Líder (GOAT)</div>
              <div className={`text-sm font-bold mt-0.5 truncate ${stats.goatIsMe ? 'text-brand-400' : 'text-ink-100'}`}>
                {stats.goatIsMe ? '¡Tú! 🎉' : stats.goatName}
              </div>
            </Link>
          )}
          {stats.kingName && (
            <Link to="/tabla" className="card text-center hover:bg-ink-700 transition">
              <div className="text-2xl">👑</div>
              <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-0.5">Rey · {stats.kingFecha}</div>
              <div className="text-sm font-bold mt-0.5 truncate text-ink-100">{stats.kingName}</div>
            </Link>
          )}
        </div>
      )}

      {/* Reyes recientes: último partido y día */}
      {(stats.matchKingName || stats.dayKingName) && (
        <div className="grid grid-cols-2 gap-3">
          {stats.matchKingName && (
            <Link to="/tabla" className="card text-center hover:bg-ink-700 transition">
              <div className="text-2xl">⚽👑</div>
              <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-0.5">
                Rey del partido{stats.matchKingLabel ? ` · ${stats.matchKingLabel}` : ''}
              </div>
              <div className={`text-sm font-bold mt-0.5 truncate ${stats.matchKingIsMe ? 'text-brand-400' : 'text-ink-100'}`}>
                {stats.matchKingIsMe ? '¡Tú! 🎉' : stats.matchKingName}
              </div>
              <div className="text-[10px] text-ink-500">{stats.matchKingPts} pts</div>
            </Link>
          )}
          {stats.dayKingName && (
            <Link to="/tabla" className="card text-center hover:bg-ink-700 transition">
              <div className="text-2xl">📅👑</div>
              <div className="text-[10px] text-ink-400 uppercase tracking-wider mt-0.5">
                Rey del día{stats.dayKingLabel ? ` · ${stats.dayKingLabel}` : ''}
              </div>
              <div className={`text-sm font-bold mt-0.5 truncate ${stats.dayKingIsMe ? 'text-brand-400' : 'text-ink-100'}`}>
                {stats.dayKingIsMe ? '¡Tú! 🎉' : stats.dayKingName}
              </div>
              <div className="text-[10px] text-ink-500">{stats.dayKingPts} pts</div>
            </Link>
          )}
        </div>
      )}

      {/* Tarjeta de estatus personal */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-[10px] text-ink-400 uppercase tracking-wider">Puntos</div>
          <div className="text-2xl font-bold text-brand-500 mt-1">{stats.myPoints}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-ink-400 uppercase tracking-wider">Posición</div>
          <div className="text-2xl font-bold text-brand-500 mt-1">
            {stats.myRank > 0 ? `${stats.myRank}${rankSuffix}` : '—'}
          </div>
          <div className="text-[10px] text-ink-500">de {stats.totalPlayers}</div>
        </div>
        <div className="card text-center">
          <div className="text-[10px] text-ink-400 uppercase tracking-wider">Racha</div>
          <div className="text-2xl font-bold text-brand-500 mt-1">
            {stats.streak > 0 ? `${stats.streak}🔥` : '0'}
          </div>
        </div>
      </div>

      {/* Bolsa */}
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-[10px] text-ink-400 uppercase tracking-wider">Bolsa acumulada</div>
          <div className="text-xl font-bold text-brand-500">{formatCOP(stats.bolsa)}</div>
        </div>
        <div className="text-right text-xs text-ink-400">
          {stats.playersPaid}/{stats.players}<br/>pagos
        </div>
      </div>

      {/* Mis pronósticos */}
      <div className="card space-y-1">
        <h3 className="font-semibold mb-2">Mis pronósticos</h3>
        <Link to="/predicciones" className="flex items-center justify-between py-2 border-b border-ink-700">
          <span>⚽ Partidos</span>
          <span className="text-sm text-ink-300">{stats.myPreds} / {TOURNAMENT.matches.length}</span>
        </Link>
        <Link to="/grupos" className="flex items-center justify-between py-2 border-b border-ink-700">
          <span>🅰️ Posiciones de grupo</span>
          <span className="text-sm text-ink-300">{stats.myGroupPreds} / 48</span>
        </Link>
        <Link to="/terceros" className="flex items-center justify-between py-2">
          <span>🥉 Mejores terceros</span>
          <span className="text-sm text-ink-300">{stats.myThirdPreds} / 8</span>
        </Link>
      </div>

      {stats.myFines > 0 && (
        <div className="card border-red-700/50">
          <h3 className="font-semibold mb-1 text-red-300">Mis multas</h3>
          <div className="text-sm">
            {stats.myFines} multa{stats.myFines !== 1 ? 's' : ''} · {formatCOP(stats.myFinesCOP)}
          </div>
        </div>
      )}

      {/* Grid de accesos rápidos */}
      <div>
        <h3 className="font-semibold mb-2 text-sm text-ink-300">Explora</h3>
        <div className="grid grid-cols-3 gap-2">
          <QuickLink to="/tabla" icon="🏆" label="Tabla" />
          <QuickLink to="/grupos-mundial" icon="🌍" label="Grupos FIFA" />
          <QuickLink to="/progreso" icon="📈" label="Mi progreso" />
          <QuickLink to="/simulador" icon="🔮" label="Simulador" />
          <QuickLink to="/bracket" icon="🗺️" label="Camino" />
          <QuickLink to="/comunidad" icon="📊" label="Stats" />
          <QuickLink to="/revive" icon="🎬" label="Revive" />
          <QuickLink to="/muro" icon="💬" label="Muro" />
          <QuickLink to="/reglas" icon="📜" label="Reglas" />
          <QuickLink to="/resumen" icon="📋" label="Resumen" />
        </div>
      </div>

      {/* Calendario */}
      <a
        href="/mundial-2026.ics"
        download="Mundial-2026.ics"
        className="block card text-center text-sm text-ink-300 hover:bg-ink-700"
      >
        📅 Agregar todos los partidos a mi calendario
      </a>
    </div>
  )
}

function QuickLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 card py-3 hover:bg-ink-700 transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] text-ink-300 text-center leading-tight">{label}</span>
    </Link>
  )
}
