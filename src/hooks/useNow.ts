import { useEffect, useState } from 'react'

// Module-level shared timer: all useNow() callers share one setInterval
// instead of each SLABadge/TaskDetail spinning its own timer.
const subs = new Set<() => void>()
let sharedTimer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void): () => void {
  subs.add(cb)
  if (!sharedTimer) sharedTimer = setInterval(() => subs.forEach(f => f()), 30_000)
  return () => {
    subs.delete(cb)
    if (subs.size === 0 && sharedTimer) { clearInterval(sharedTimer); sharedTimer = null }
  }
}

export function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => subscribe(() => setNow(Date.now())), [])
  return now
}
