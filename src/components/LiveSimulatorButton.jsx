import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLeagueData } from '../lib/useLeagueData'
import { liveMatchCount } from '../lib/liveStatus'

/**
 * Botón flotante que aparece SOLO cuando hay al menos un partido en vivo.
 * Lleva al simulador. Se oculta si ya estás en el simulador.
 */
export default function LiveSimulatorButton() {
  const data = useLeagueData()
  const location = useLocation()
  const [now, setNow] = useState(Date.now())

  // Actualiza cada 30s para detectar cuándo arranca/termina un partido
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (data.loading) return null
  // No mostrar si ya estás en el simulador
  if (location.pathname.startsWith('/simulador')) return null

  const resultsById = new Map(data.results.map(r => [r.match_id, r]))
  const liveCount = liveMatchCount(now, resultsById)
  if (liveCount === 0) return null

  return (
    <Link
      to="/simulador"
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg px-4 py-3 transition active:scale-95"
      style={{ boxShadow: '0 4px 20px rgba(220,38,38,0.5)' }}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
      </span>
      <span className="text-sm font-semibold">
        🔮 Simular {liveCount > 1 ? `(${liveCount} en vivo)` : 'en vivo'}
      </span>
    </Link>
  )
}
