import { Download, X } from 'lucide-react'
import { useState } from 'react'
import Button from '../ui/Button'
import { useT } from '../../i18n'

interface InstallBannerProps {
  onInstall: () => Promise<boolean>
  onDismiss: () => void
}

export default function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  const t = useT()
  const [installing, setInstalling] = useState(false)

  const handleInstall = async () => {
    setInstalling(true)
    await onInstall()
    setInstalling(false)
  }

  return (
    <div className="fixed bottom-safe left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <img src="/icon-96x96.png" alt="TaskPro" className="w-7 h-7 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.pwa.installTitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.pwa.installDesc}
          </p>
          <div className="flex gap-2 mt-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstall}
              disabled={installing}
            >
              <Download size={13} />
              {installing ? t.pwa.installing : t.pwa.install}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t.pwa.notNow}
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
