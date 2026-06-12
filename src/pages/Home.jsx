import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useLeagueData } from '../lib/useLeagueData'
import { TOURNAMENT, formatKickoff, isMatchLocked } from '../lib/matches'
import {
  scoreMatch,
  scoreGroupPositions,
  scoreThirds,
} from '../lib/scoring'
import PendingMatchesBanner from '../components/PendingMatchesBanner'
import NewResultsBanner from '../components/NewResultsBanner'
import { useNewResults } from '../lib/useNewResults'

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function Home() {
  const { user, profile } = useAuth()
  const data = useLeagueData()
  const { newResults, totalNewPoints, dismiss: dismissResults } = useNewResults(user.id)

  const myPreds = useMemo(
    () => data.predictions.filter(p => p.user_id === user.id),
    [data.predictions, user.id]
  )

  const stats = useMemo(() => {
    const myGroupPreds = data.groupPreds.filter(p => p.user_id === user.id)
    const myThirdPreds = data.thirdPreds.filter(p => p.user_id === user.id)

    // calc total points for current user
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

    return {
      myPreds: myPreds.length,
      myGroupPreds: myGroupPreds.length,
      myThirdPreds: myThirdPreds.length,
      myPoints: pts,
      myFines: myFines.length,
      myFinesCOP: myFines.reduce((s, f) => s + (f.amount || fineAmount), 0),
      bolsa,
      players: data.profiles.length,
      playersPaid: paidProfiles.length,
    }
  }, [data, user.id, myPreds])

  const nextMatch = useMemo(() => {
    const now = Date.now()
    return TOURNAMENT.matches
      .filter(m => m.kickoff_utc && new Date(m.kickoff_utc).getTime() > now)
      .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc))[0]
  }, [])

  if (data.loading) return <div className="text-center text-ink-300 py-8">Cargando…</div>

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-sm text-ink-300">¡Hola{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}! 👋</p>
        <h1 className="text-xl font-bold mt-1">Mundial 2026</h1>
        {!profile?.paid && (
          <div className="mt-3 p-3 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm">
            ⚠️ Tu pago de 50.000 COP aún no está confirmado. Transfiérele a Dari y avísale.
          </div>
        )}
      </div>

      {/* Notificación de resultados nuevos */}
      <NewResultsBanner
        newResults={newResults}
        totalNewPoints={totalNewPoints}
        dismiss={dismissResults}
      />

      {/* Banner de partidos pendientes (auto-refresh cada 30s) */}
      <PendingMatchesBanner userPredictions={myPreds} />

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="text-xs text-ink-300 uppercase tracking-wider">Mis puntos</div>
          <div className="text-3xl font-bold text-brand-500 mt-1">{stats.myPoints}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-ink-300 uppercase tracking-wider">Bolsa</div>
          <div className="text-2xl font-bold text-brand-500 mt-1">{formatCOP(stats.bolsa)}</div>
          <div className="text-xs text-ink-500 mt-0.5">{stats.playersPaid}/{stats.players} pagos</div>
        </div>
      </div>

      {nextMatch && (
        <div className="card">
          <div className="text-xs uppercase text-ink-300 tracking-wider mb-2">Próximo partido</div>
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <div className="font-semibold">{nextMatch.team1}</div>
            </div>
            <div className="px-3 text-ink-500 text-sm">vs</div>
            <div className="flex-1 text-center">
              <div className="font-semibold">{nextMatch.team2}</div>
            </div>
          </div>
          <div className="text-center text-xs text-ink-300 mt-2">
            {formatKickoff(nextMatch.kickoff_utc)}
            {isMatchLocked(nextMatch) && <span className="ml-2 text-red-400">🔒 Cerrado</span>}
          </div>
        </div>
      )}

      <div className="card space-y-2">
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

      <Link to="/bracket" className="block card text-center text-brand-500 hover:bg-ink-700">
        🏆 Ver el camino a la final
      </Link>

      <Link to="/progreso" className="block card text-center text-brand-500 hover:bg-ink-700">
        📈 Ver mi progreso y logros
      </Link>

      <Link to="/comunidad" className="block card text-center text-brand-500 hover:bg-ink-700">
        📊 Ver estadísticas comunales
      </Link>

      <Link to="/reglas" className="block card text-center text-brand-500 hover:bg-ink-700">
        📜 Ver reglas y premios
      </Link>

      <a
        href="/mundial-2026.ics"
        download="Mundial-2026.ics"
        className="block card text-center text-brand-500 hover:bg-ink-700"
      >
        📅 Agregar partidos a mi calendario
      </a>
    </div>
  )
}
