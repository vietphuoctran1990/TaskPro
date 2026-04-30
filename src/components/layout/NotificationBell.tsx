import { useState, useCallback, useEffect } from 'react'
import { Bell, BellOff, CheckCircle2, Clock, X } from 'lucide-react'
import { cn, getDeadline, getTimeRemaining } from '../../lib/utils'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { useNotifications } from '../../hooks/useNotifications'

export default function NotificationBell() {
  const { state, dispatch } = useApp()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  const { requestPermission, getUpcomingAlerts } = useNotifications({
    tasks: state.tasks,
    t,
    enabled: permission === 'granted',
  })

  const alerts = getUpcomingAlerts()

  // Critical/breached count for badge
  const urgentCount = state.tasks.filter(task => {
    if (task.status === 'done') return false
    const deadline = getDeadline(task)
    if (!deadline) return false
    const minsLeft = (deadline.getTime() - Date.now()) / 60_000
    return minsLeft <= 60
  }).length

  const handleEnable = useCallback(async () => {
    const perm = await requestPermission()
    setPermission(perm)
  }, [requestPermission])

  // Sync permission state if it changes externally
  useEffect(() => {
    if (!('Notification' in window)) return
    const check = () => setPermission(Notification.permission)
    const id = setInterval(check, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(v => !v)}
        className={cn('relative', urgentCount > 0 && 'text-orange-500')}
        aria-label={t.notifications.title}
      >
        {permission === 'denied' ? <BellOff size={15} /> : <Bell size={15} />}
        {urgentCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
            {urgentCount > 9 ? '9+' : urgentCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">{t.notifications.title}</span>
              <div className="flex items-center gap-1">
                {alerts.length > 0 && (
                  <span className="text-xs text-slate-400">{t.notifications.upcomingCount(alerts.length)}</span>
                )}
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setOpen(false)}>
                  <X size={12} />
                </Button>
              </div>
            </div>

            {/* Permission banner */}
            {permission !== 'granted' && (
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                {permission === 'denied' ? (
                  <p className="text-xs text-slate-600">{t.notifications.denied}</p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-600">{t.notifications.enable}</p>
                    <Button variant="primary" size="sm" onClick={handleEnable}>
                      <Bell size={12} /> {t.notifications.enable}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Alert list */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <p className="text-xs">{t.notifications.noUpcoming}</p>
                </div>
              ) : (
                alerts.map(({ task, label, minutesLeft }) => {
                  const deadline = getDeadline(task)
                  const overdue = minutesLeft < 0
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors',
                        overdue && 'bg-red-50/50'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 w-2 h-2 rounded-full shrink-0',
                        overdue ? 'bg-red-500' : minutesLeft <= 15 ? 'bg-orange-500' : 'bg-amber-400'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn(
                            'text-xs font-medium',
                            overdue ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {label}
                          </span>
                          {deadline && (
                            <span className="text-xs text-slate-400">
                              · {overdue ? '+' : ''}{getTimeRemaining(deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="shrink-0 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        onClick={() => {
                          dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: 'done' } })
                        }}
                        title={t.notifications.markDone}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {permission === 'granted' && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={11} />
                Checked every 60s
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
