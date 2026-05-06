import { useState, useCallback, useEffect } from 'react'
import { Bell, BellOff, CheckCircle2, X, Send } from 'lucide-react'
import { cn, getDeadline, getTimeRemaining } from '../../lib/utils'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { useNotifications } from '../../hooks/useNotifications'
import { useAuth } from '../../context/AuthContext'

const NOTIF_OPTIONS = [15, 30, 60] as const

export default function NotificationBell() {
  const { state, dispatch } = useApp()
  const t = useT()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  const { requestPermission, getUpcomingAlerts } = useNotifications({
    tasks: state.tasks,
    t,
    enabled: permission === 'granted',
    notifBefore: state.notifBefore,
    onMarkDone: (taskId) => dispatch({ type: 'MOVE_TASK', payload: { id: taskId, status: 'done' } }),
    userId: user?.id,
  })

  const alerts = getUpcomingAlerts()

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

  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle')
  const handleTestPush = useCallback(async () => {
    setTestStatus('sending')
    try {
      const deviceId = localStorage.getItem('taskpro-device-id')
      if (!deviceId) { setTestStatus('fail'); return }
      const res = await fetch('/api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) setTestStatus('ok')
      else { console.error('[test-push] failed:', data); setTestStatus('fail') }
    } catch (err) {
      console.error('[test-push] error:', err)
      setTestStatus('fail')
    }
    setTimeout(() => setTestStatus('idle'), 4000)
  }, [])

  const handleDebug = useCallback(async () => {
    const deviceId = localStorage.getItem('taskpro-device-id')
    if (!deviceId) { alert('No deviceId found'); return }
    try {
      const res = await fetch('/api/debug-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      const lines = [
        `deviceId: ${deviceId.slice(0, 8)}…`,
        `subscription on server: ${data.hasSubscription ? '✓ YES' : '✗ NO'}`,
        `schedules on server: ${data.scheduleCount}`,
        '',
        ...(data.schedules ?? []).map((s: { title: string; inMinutes: number }) =>
          `• ${s.title} → ${s.inMinutes >= 0 ? `in ${s.inMinutes}min` : `${-s.inMinutes}min ago`}`
        ),
      ]
      alert(lines.join('\n'))
    } catch (err) {
      alert('Debug failed: ' + String(err))
    }
  }, [])

  useEffect(() => {
    if (!('Notification' in window)) return
    const id = setInterval(() => setPermission(Notification.permission), 3000)
    return () => clearInterval(id)
  }, [])

  const toggleNotifBefore = (minutes: number) => {
    const next = state.notifBefore.includes(minutes)
      ? state.notifBefore.filter(m => m !== minutes)
      : [...state.notifBefore, minutes]
    dispatch({ type: 'SET_NOTIF_BEFORE', payload: next })
  }

  const labelFor = (m: number) =>
    m === 15 ? t.notifications.min15 : m === 30 ? t.notifications.min30 : t.notifications.hour1

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
          <div className="fixed right-4 top-14 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
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
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
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
                          <span className={cn('text-xs font-medium', overdue ? 'text-red-600' : 'text-amber-600')}>
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
                        onClick={() => dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: 'done' } })}
                        title={t.notifications.markDone}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Notify-before settings */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-500 font-medium mb-2">{t.notifications.notifyBefore}:</p>
              <div className="flex gap-2">
                {NOTIF_OPTIONS.map(m => {
                  const active = state.notifBefore.includes(m)
                  return (
                    <button
                      key={m}
                      onClick={() => toggleNotifBefore(m)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      )}
                    >
                      {labelFor(m)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            {permission === 'granted' && (
              <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-400">
                <button
                  onClick={handleDebug}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700 transition-colors"
                >
                  Check server
                </button>
                <button
                  onClick={handleTestPush}
                  disabled={testStatus === 'sending'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    testStatus === 'ok'   && 'bg-emerald-50 text-emerald-600 border-emerald-200',
                    testStatus === 'fail' && 'bg-red-50 text-red-600 border-red-200',
                    testStatus === 'idle' && 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600',
                    testStatus === 'sending' && 'bg-white text-slate-400 border-slate-200',
                  )}
                >
                  <Send size={10} />
                  {testStatus === 'sending' ? '…'
                    : testStatus === 'ok'   ? 'Sent ✓'
                    : testStatus === 'fail' ? 'Failed'
                    : 'Test push'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
