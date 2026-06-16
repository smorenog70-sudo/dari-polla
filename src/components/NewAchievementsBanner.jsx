import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAchievements } from '../lib/useAchievements'

/**
 * Banner que aparece en Inicio cuando el usuario desbloquea medallas nuevas
 * (que no había visto antes). Recuerda las vistas en localStorage por usuario.
 */
export default function NewAchievementsBanner() {
  const { user } = useAuth()
  const { achievements, loading } = useAchievements()
  const [dismissed, setDismissed] = useState(false)

  const storageKey = `dari-seen-badges-${user?.id || 'anon'}`

  // IDs actualmente desbloqueados
  const unlockedIds = useMemo(
    () => achievements.filter(a => a.unlocked).map(a => a.id),
    [achievements]
  )

  // Medallas nuevas = desbloqueadas que no estaban en localStorage
  const newOnes = useMemo(() => {
    if (loading || unlockedIds.length === 0) return []
    let seen = []
    try {
      seen = JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch { seen = [] }
    const seenSet = new Set(seen)
    return achievements.filter(a => a.unlocked && !seenSet.has(a.id))
  }, [achievements, unlockedIds, loading, storageKey])

  // Marcar como vistas cuando el usuario las reconoce (al ir a verlas o cerrar)
  const markSeen = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(unlockedIds))
    } catch { /* ignorar */ }
    setDismissed(true)
  }

  if (loading || dismissed || newOnes.length === 0) return null

  return (
    <div className="card border-brand-500/60 bg-gradient-to-br from-brand-700/40 to-ink-900 shadow-lg shadow-brand-900/30">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{newOnes.length === 1 ? newOnes[0].icon : '🏅'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-brand-300">
            {newOnes.length === 1
              ? `¡Desbloqueaste "${newOnes[0].name}"!`
              : `¡Desbloqueaste ${newOnes.length} medallas nuevas!`}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {newOnes.slice(0, 6).map(a => (
              <span key={a.id} className="pill bg-brand-800/60 text-brand-100 text-xs">
                {a.icon} {a.name}
              </span>
            ))}
            {newOnes.length > 6 && (
              <span className="pill bg-ink-700 text-ink-200 text-xs">+{newOnes.length - 6}</span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Link
              to="/progreso"
              onClick={markSeen}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition"
            >
              Ver mis logros →
            </Link>
            <button
              onClick={markSeen}
              className="text-sm px-3 py-1.5 rounded-lg bg-ink-700 hover:bg-ink-600 text-ink-200 transition"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
