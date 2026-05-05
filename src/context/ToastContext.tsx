import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; type: ToastType }
interface ToastCtx { toast: (msg: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx | null>(null)

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const STYLES = {
  success: { wrap: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', icon: 'text-emerald-500' },
  error:   { wrap: 'border-red-200 bg-red-50',         text: 'text-red-800',     icon: 'text-red-500' },
  info:    { wrap: 'border-indigo-200 bg-indigo-50',   text: 'text-indigo-800',  icon: 'text-indigo-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: string) => setToasts(p => p.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-xs w-full">
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          const s = STYLES[t.type]
          return (
            <div
              key={t.id}
              className={`toast-in pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${s.wrap}`}
            >
              <Icon size={15} className={s.icon} />
              <span className={`flex-1 text-sm font-medium ${s.text}`}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
