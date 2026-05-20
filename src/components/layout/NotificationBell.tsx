import { useState, useCallback } from 'react'
import { Bell, BellOff, CheckCircle2, X, Send } from 'lucide-react'
import { cn, getDeadline, getTimeRemaining } from '../../lib/utils'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { useNotificationsCtx } from '../../context/NotificationsContext'

const NOTIF_OPTIONS = [15, 30, 60] as const

export default function NotificationBell() {
  const { state, dispatch, finalStatusIds } = useApp()
  const t = useT()
  const [open, setOpen] = useState(false)
  const { permission, requestPermission, getUpcomingAlerts } = useNotificationsCtx()

  const alerts = getUpcomingAlerts()

  const urgentCount = state.tasks.filter(task => {
    if (finalStatusIds.has(task.status)) return false
    const deadline = getDeadline(task)
    if (!deadline) return false
    const minsLeft = (deadline.getTime() - Date.now()) / 60_000
    return minsLeft <= 60
  }).length

  const handleEnable = useCallback(async () => {
    await requestPermission()
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
          <div className="fixed right-4 top-14 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden pop-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.notifications.title}</span>
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
              <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
                {permission === 'denied' ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t.notifications.denied}</p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">{t.notifications.enable}</p>
                    <Button variant="primary" size="sm" onClick={handleEnable}>
                      <Bell size={12} /> {t.notifications.enable}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Alert list */}
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400 dark:text-slate-500">
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
                        'flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
                        overdue && 'bg-red-50/50 dark:bg-red-900/20'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 w-2 h-2 rounded-full shrink-0',
                        overdue ? 'bg-red-500' : minutesLeft <= 15 ? 'bg-orange-500' : 'bg-amber-400'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
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
                        onClick={() => {
                          const finalId = state.statuses.find(s => s.isFinal)?.id ?? 'done'
                          dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: finalId } })
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

            {/* Notify-before settings */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">{t.notifications.notifyBefore}:</p>
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
                          : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600'
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
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
                <button
                  onClick={handleDebug}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Check server
                </button>
                <button
                  onClick={handleTestPush}
                  disabled={testStatus === 'sending'}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    testStatus === 'ok'   && 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                    testStatus === 'fail' && 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
                    testStatus === 'idle' && 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600',
                    testStatus === 'sending' && 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600',
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
