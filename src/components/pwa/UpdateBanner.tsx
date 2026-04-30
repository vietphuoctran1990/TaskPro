import { RefreshCw } from 'lucide-react'
import Button from '../ui/Button'
import { useT } from '../../i18n'

interface UpdateBannerProps {
  onUpdate: () => void
}

export default function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  const t = useT()
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-top-4 duration-300">
      <div className="bg-indigo-600 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <RefreshCw size={16} className="shrink-0 animate-spin" />
        <p className="flex-1 text-sm font-medium">
          {t.pwa.updateTitle}
        </p>
        <Button
          size="sm"
          className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-none"
          onClick={onUpdate}
        >
          {t.pwa.update}
        </Button>
      </div>
    </div>
  )
}
