import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface ToastAction { label: string; onClick: () => void }
interface Toast { id: string; message: string; type: ToastType; action?: ToastAction }

// Overloaded signature: `toast('msg')`, `toast('msg', 'error')`, or `toast({ message, action, type, duration })`
interface ToastOptions { message: string; type?: ToastType; action?: ToastAction; duration?: number }
interface ToastCtx {
  toast: ((msg: string, type?: ToastType) => void) & ((opts: ToastOptions) => void)
}

const ToastContext = createContext<ToastCtx | null>(null)

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const STYLES = {
  success: { wrap: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-200', icon: 'text-emerald-500' },
  error:   { wrap: 'border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800',                 text: 'text-red-800 dark:text-red-200',         icon: 'text-red-500' },
  info:    { wrap: 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800',     text: 'text-indigo-800 dark:text-indigo-200',   icon: 'text-indigo-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) { clearTimeout(tm); timers.current.delete(id) }
  }, [])

  const toast = useCallback(((arg1: string | ToastOptions, arg2?: ToastType) => {
    const opts: ToastOptions = typeof arg1 === 'string'
      ? { message: arg1, type: arg2 ?? 'success' }
      : arg1
    const id = crypto.randomUUID()
    const duration = opts.duration ?? (opts.action ? 6000 : 3500)
    setToasts(p => [...p, { id, message: opts.message, type: opts.type ?? 'success', action: opts.action }])
    const tm = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, tm)
  }) as ToastCtx['toast'], [dismiss])

  useEffect(() => () => {
    timers.current.forEach(t => clearTimeout(t))
    timers.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-28 lg:bottom-6 right-4 lg:right-6 z-[200] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)]">
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          const s = STYLES[t.type]
          return (
            <div
              key={t.id}
              className={`toast-in pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${s.wrap}`}
            >
              <Icon size={15} className={s.icon} />
              <span className={`flex-1 text-sm font-medium ${s.text}`}>{t.message}</span>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 ${s.text} transition-colors`}
                >
                  <Undo2 size={11} />
                  {t.action.label}
                </button>
              )}
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
