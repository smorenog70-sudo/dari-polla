import { useEffect, useState } from 'react'

/**
 * Returns a timestamp that updates every `intervalMs` (default 30s).
 * Used so components re-render and re-evaluate time-based UI (countdowns,
 * lock states, "match starts in N min" banners) without a manual refresh.
 */
export function useNowTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)

    // Also re-evaluate when tab becomes visible again (mobile users often
    // background the app for a while and come back — we want fresh state
    // immediately, not waiting for the next tick).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
