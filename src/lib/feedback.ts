// Tiny user-feedback helpers: haptics + confetti burst.
// All are no-ops when not supported (reduced motion, no Vibration API, etc.)

export function haptic(ms: number = 10): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  try { navigator.vibrate(ms) } catch { /* iOS Safari without permission */ }
}

export function burstConfetti(originEl?: HTMLElement | null, count: number = 18): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const rect = originEl?.getBoundingClientRect()
  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

  const layer = document.createElement('div')
  layer.style.position = 'fixed'
  layer.style.left = `${originX}px`
  layer.style.top = `${originY}px`
  layer.style.pointerEvents = 'none'
  layer.style.zIndex = '9999'
  document.body.appendChild(layer)

  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7']

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.className = 'confetti-piece'
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dist = 80 + Math.random() * 90
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 30
    piece.style.setProperty('--cx', `${dx}px`)
    piece.style.setProperty('--cy', `${dy}px`)
    piece.style.setProperty('--cr', `${(Math.random() - 0.5) * 720}deg`)
    piece.style.setProperty('--cd', `${800 + Math.random() * 500}ms`)
    piece.style.background = colors[i % colors.length]
    piece.style.left = '0'
    piece.style.top = '0'
    layer.appendChild(piece)
  }

  setTimeout(() => layer.remove(), 1500)
}
