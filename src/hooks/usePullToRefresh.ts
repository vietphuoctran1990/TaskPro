import { useEffect, useState, type RefObject } from 'react'

interface Options {
  onRefresh: () => Promise<void> | void
  threshold?: number    // px the user must pull to trigger
  enabled?: boolean
}

interface State {
  pulling: boolean      // touch held & at top
  distance: number      // current pull distance (capped)
  willRefresh: boolean  // past threshold
  refreshing: boolean   // onRefresh promise in flight
}

const MAX_PULL = 120

export function usePullToRefresh(ref: RefObject<HTMLElement | null>, { onRefresh, threshold = 70, enabled = true }: Options): State {
  const [pulling, setPulling] = useState(false)
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    let startY = 0
    let active = false

    const onStart = (e: TouchEvent) => {
      if (refreshing) return
      if (el.scrollTop > 0) return
      startY = e.touches[0].clientY
      active = true
    }

    const onMove = (e: TouchEvent) => {
      if (!active || refreshing) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        if (pulling) { setPulling(false); setDistance(0) }
        return
      }
      // Resist beyond threshold
      const eased = Math.min(MAX_PULL, dy * 0.55)
      setPulling(true)
      setDistance(eased)
    }

    const onEnd = async () => {
      if (!active) return
      active = false
      const willRefresh = distance >= threshold
      if (willRefresh) {
        setRefreshing(true)
        setDistance(threshold)
        try { await onRefresh() } catch { /* swallow — UI just stops spinning */ }
        setRefreshing(false)
      }
      setPulling(false)
      setDistance(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, enabled, onRefresh, threshold, distance, pulling, refreshing])

  return { pulling, distance, willRefresh: distance >= threshold, refreshing }
}
