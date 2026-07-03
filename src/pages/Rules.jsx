import { useMemo } from 'react'
import { useLeagueData } from '../lib/useLeagueData'

const CORRAL_BONO = 50000
const BONOS_TOTALES = CORRAL_BONO * 2

function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
}

export default function Rules() {
  const data = useLeagueData()

  const premios = useMemo(() => {
    if (data.loading) return null
    const entryFee = Number(data.config.entry_fee || 50000)
    const fineAmount = Number(data.config.fine_amount || 5000)
    const paidProfiles = data.profiles.filter(p => p.paid)
    const finesTotal = (data.fines || []).reduce((s, f) => s + (f.amount || fineAmount), 0)
    const bolsa = paidProfiles.length * entryFee + finesTotal
    const repartible = Math.max(0, bolsa - BONOS_TOTALES)
    return {
      bolsa,
      repartible,
      primero: Math.round(repartible * 0.7),
      segundo: Math.round(repartible * 0.2),
      tercero: Math.round(repartible * 0.1),
      tieneBolsa: bolsa > 0,
    }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold mb-2">🔥 Polla Mundialista 2026 🔥</h1>
        <p className="text-ink-300 text-sm">
          Se viene el mundial y armamos nueva edición de la polla ⚽️
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">💰 Entrada</h2>
        <p className="text-2xl font-bold text-brand-500">50.000 COP</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">📊 ¿Cómo se puntúa?</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Ganador o empate</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Marcador exacto</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Goles del local</span><span className="font-mono text-brand-500">2 pts</span></li>
          <li className="flex justify-between"><span>Goles del visitante</span><span className="font-mono text-brand-500">2 pts</span></li>
          <li className="flex justify-between"><span>Diferencia de gol</span><span className="font-mono text-brand-500">1 pt</span></li>
          <li className="flex justify-between"><span>Posición final en el grupo</span><span className="font-mono text-brand-500">5 pts</span></li>
          <li className="flex justify-between"><span>Mejor tercero</span><span className="font-mono text-brand-500">5 pts</span></li>
        </ul>
        <p className="text-xs text-ink-500 mt-3">
          Los puntos son aditivos: si aciertas el marcador exacto también te dan los 5 de ganador, los 2 del local, los 2 del visitante y 1 de diferencia.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">🏆 Bono "¿Quién clasifica?"</h2>
        <p className="text-xs text-ink-300 mb-3">
          En cada cruce de eliminación, puntos extra por acertar quién pasa a la siguiente ronda.
          El bono <strong>sube según la ronda</strong>:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Dieciseisavos</span><span className="font-mono text-brand-500">10 pts</span></li>
          <li className="flex justify-between"><span>Octavos</span><span className="font-mono text-brand-500">15 pts</span></li>
          <li className="flex justify-between"><span>Cuartos</span><span className="font-mono text-brand-500">20 pts</span></li>
          <li className="flex justify-between"><span>Semifinal</span><span className="font-mono text-brand-500">30 pts</span></li>
          <li className="flex justify-between"><span>Final</span><span className="font-mono text-brand-500">50 pts</span></li>
        </ul>
        <p className="text-xs text-ink-500 mt-3">
          El "quién clasifica" es tu elección aparte del marcador: si pones empate a los 90, eliges quién
          crees que pasa por prórroga/penales. Los dieciseisavos se quedan en 10 porque ya se están jugando.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">🏅 Bono de podio</h2>
        <p className="text-xs text-ink-300 mb-3">
          Elige el podio final del Mundial (campeón, subcampeón, 3ro y 4to). Puntos por cada
          <strong> posición exacta</strong> que aciertes. Se cierra al arrancar los octavos.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>🥇 Campeón</span><span className="font-mono text-brand-500">30 pts</span></li>
          <li className="flex justify-between"><span>🥈 Subcampeón</span><span className="font-mono text-brand-500">20 pts</span></li>
          <li className="flex justify-between"><span>🥉 3er puesto</span><span className="font-mono text-brand-500">15 pts</span></li>
          <li className="flex justify-between"><span>🎖️ 4to puesto</span><span className="font-mono text-brand-500">10 pts</span></li>
        </ul>
        <p className="text-xs text-ink-500 mt-3">
          Solo cuenta la posición exacta: si pusiste a un equipo de campeón y quedó subcampeón, no se da
          el bono de subcampeón. Acertar al campeón puede sumar doble: el bono de la final más el de podio.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">⚠️ Reglas clave</h2>
        <ul className="space-y-2 text-sm text-ink-100">
          <li>
            Después de cada fecha (fase de grupos y eliminatorias), los dos últimos de la tabla
            en esa fecha (<strong>no</strong> acumulado) pagan una multa de <strong>5.000 COP</strong> cada uno.
            Esa plata se suma a la bolsa final 💸
          </li>
          <li>
            Cada partido cierra automáticamente <strong>10 minutos antes</strong> del pitazo inicial.
            Después de eso ya no puedes editar el pronóstico ⏱️
          </li>
        </ul>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">🏆 Premios</h2>
        <ul className="space-y-2">
          <li className="flex justify-between items-center">
            <span>🥇 1er lugar</span>
            <span className="text-right">
              <span className="font-bold text-brand-500">70% de la bolsa</span>
              {premios?.tieneBolsa && <span className="block text-xs text-ink-400">{formatCOP(premios.primero)}</span>}
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>🥈 2do lugar</span>
            <span className="text-right">
              <span className="font-bold text-brand-500">20% de la bolsa</span>
              {premios?.tieneBolsa && <span className="block text-xs text-ink-400">{formatCOP(premios.segundo)}</span>}
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>🥉 3er lugar</span>
            <span className="text-right">
              <span className="font-bold text-brand-500">10% de la bolsa</span>
              {premios?.tieneBolsa && <span className="block text-xs text-ink-400">{formatCOP(premios.tercero)}</span>}
            </span>
          </li>
          <li className="flex justify-between items-center border-t border-ink-700 pt-2 mt-2">
            <span>🍔 4to lugar</span>
            <span className="font-bold text-brand-500">Bono El Corral $50.000</span>
          </li>
          <li className="flex justify-between items-center">
            <span>🍔 5to lugar</span>
            <span className="font-bold text-brand-500">Bono El Corral $50.000</span>
          </li>
        </ul>
        <p className="text-xs text-ink-500 mt-3">
          Primero se separan los dos bonos de El Corral ($100.000 en total para el 4° y 5° lugar).
          El resto de la bolsa se reparte entre el podio: 70% / 20% / 10%.
        </p>
        {premios?.tieneBolsa && (
          <div className="mt-3 text-xs text-ink-400 bg-ink-900/50 rounded-lg p-2">
            Bolsa actual: <strong>{formatCOP(premios.bolsa)}</strong> · A repartir en podio tras bonos:{' '}
            <strong>{formatCOP(premios.repartible)}</strong>
          </div>
        )}
      </div>

      <p className="text-center text-ink-300 text-sm py-4">
        La idea es meterle emoción a cada partido y que nadie se duerma 😏
      </p>
    </div>
  )
}
