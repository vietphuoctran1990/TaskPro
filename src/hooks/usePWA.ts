import { useState, useEffect, useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000)
      }
    },
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
    return outcome === 'accepted'
  }

  // Use direct SW API instead of vite-pwa's updateServiceWorker, which can
  // silently fail on mobile when vite-plugin-pwa@1.x and vite@8 are paired.
  const updateServiceWorker = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.waiting) {
        let reloaded = false
        const reload = () => { if (!reloaded) { reloaded = true; window.location.reload() } }
        navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        // Fallback: if controllerchange never fires within 3 s, reload anyway
        setTimeout(reload, 3000)
      } else {
        window.location.reload()
      }
    } catch {
      window.location.reload()
    }
  }, [])

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    isOnline,
    needRefresh,
    install,
    updateServiceWorker,
  }
}
