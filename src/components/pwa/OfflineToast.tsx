import { WifiOff, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import { useT } from '../../i18n'

interface OfflineToastProps {
  isOnline: boolean
}

export default function OfflineToast({ isOnline }: OfflineToastProps) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setVisible(true)
      setWasOffline(true)
      setShowReconnected(false)
    } else if (wasOffline) {
      setVisible(false)
      setShowReconnected(true)
      const id = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(id)
    }
  }, [isOnline, wasOffline])

  if (!visible && !showReconnected) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white',
          showReconnected ? 'bg-emerald-600' : 'bg-slate-800 dark:bg-slate-700'
        )}
      >
        {showReconnected ? (
          <>
            <Wifi size={15} />
            {t.pwa.backOnline}
          </>
        ) : (
          <>
            <WifiOff size={15} />
            {t.pwa.offline}
          </>
        )}
      </div>
    </div>
  )
}
