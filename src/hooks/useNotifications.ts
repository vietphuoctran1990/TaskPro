import { useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import type { Translations } from '../i18n/types'
import { getDeadline } from '../lib/utils'

export type NotifAlert = {
  task: Task
  label: string
  minutesLeft: number
}

interface Options {
  tasks: Task[]
  t: Translations
  enabled: boolean
  notifBefore: number[]   // e.g. [15, 30, 60]
  onMarkDone: (taskId: string) => void
}

interface Threshold {
  key: string
  label: (t: Translations) => string
  minutes: number
  minMin: number   // window for 60s polling fallback
  maxMin: number
}

const ALL_THRESHOLDS: Threshold[] = [
  { key: '60m', label: t => t.notifications.dueIn60, minutes: 60, minMin: 55, maxMin: 65 },
  { key: '30m', label: t => t.notifications.dueIn30, minutes: 30, minMin: 25, maxMin: 35 },
  { key: '15m', label: t => t.notifications.dueIn15, minutes: 15, minMin: 10, maxMin: 20 },
  { key: 'due', label: t => t.notifications.overdue, minutes:  0, minMin: -30, maxMin: 5 },
]

export function useNotifications({ tasks, t, enabled, notifBefore, onMarkDone }: Options) {
  const notifiedRef  = useRef(new Set<string>())  // already-shown in this session
  const scheduledRef = useRef(new Set<string>())  // already-sent to SW
  const swRegRef     = useRef<ServiceWorkerRegistration | null>(null)

  // Active thresholds (always include overdue)
  const activeThresholds = ALL_THRESHOLDS.filter(
    th => th.minutes === 0 || notifBefore.includes(th.minutes)
  )

  // ── Get SW registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => { swRegRef.current = reg })
  }, [])

  // ── Listen for MARK_DONE messages from SW (notification action) ────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent<{ type: string; taskId?: string }>) => {
      if (event.data?.type === 'MARK_DONE' && event.data.taskId) {
        onMarkDone(event.data.taskId)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [onMarkDone])

  // ── Helper: show notification (via SW registration or fallback) ────────────
  const showNotification = useCallback((
    notifKey: string, taskId: string, title: string, body: string, requireInteraction: boolean
  ) => {
    const reg = swRegRef.current
    if (reg) {
      // Extended options (badge, actions, data, renotify) are valid at runtime
      // but not all present in TS DOM types; cast to bypass.
      const opts = {
        body, icon: '/icon-192x192.png', badge: '/icon-72x72.png',
        tag: notifKey, requireInteraction,
        data: { key: notifKey, taskId },
        actions: [{ action: 'done', title: '✓ Done' }],
      } as NotificationOptions
      reg.showNotification(title, opts).catch(() => {})
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body, icon: '/icon-192x192.png', tag: notifKey })
        n.onclick = () => { window.focus(); n.close() }
      } catch {}
    }
  }, [])

  // ── Schedule ahead-of-time via SW when tasks change ───────────────────────
  useEffect(() => {
    if (!enabled) return
    const reg = swRegRef.current
    if (!reg?.active) return

    const pending = tasks.filter(task => task.status !== 'done')
    pending.forEach(task => {
      const deadline = getDeadline(task)
      if (!deadline) return
      activeThresholds.forEach(({ key, label, minutes }) => {
        const notifKey = `${task.id}-${key}`
        if (scheduledRef.current.has(notifKey)) return
        if (notifiedRef.current.has(notifKey)) return
        const fireAt = deadline.getTime() - minutes * 60_000
        const delay = fireAt - Date.now()
        // Schedule if between 1min and 3h from now
        if (delay > 60_000 && delay < 3 * 60 * 60 * 1000) {
          reg.active!.postMessage({
            type: 'SCHEDULE_NOTIFICATION',
            payload: {
              key: notifKey, taskId: task.id,
              title: label(t), body: task.title,
              fireAt, requireInteraction: key === 'due',
            },
          })
          scheduledRef.current.add(notifKey)
        }
      })
    })
  })  // runs on every render — SW deduplicates via tag

  // ── Cancel SW notifications for completed tasks ───────────────────────────
  useEffect(() => {
    const reg = swRegRef.current
    if (!reg?.active) return
    tasks.filter(task => task.status === 'done').forEach(task => {
      activeThresholds.forEach(({ key }) => {
        const notifKey = `${task.id}-${key}`
        if (scheduledRef.current.has(notifKey)) {
          reg.active!.postMessage({ type: 'CANCEL_NOTIFICATION', payload: { key: notifKey } })
          scheduledRef.current.delete(notifKey)
        }
      })
    })
  })

  // ── 60-second polling fallback (also handles immediate/past-due) ──────────
  const checkAndNotify = useCallback(() => {
    if (!enabled || Notification.permission !== 'granted') return
    const pending = tasks.filter(task => task.status !== 'done')
    pending.forEach(task => {
      const deadline = getDeadline(task)
      if (!deadline) return
      const minsLeft = (deadline.getTime() - Date.now()) / 60_000
      activeThresholds.forEach(({ key, label, minMin, maxMin }) => {
        if (minsLeft >= minMin && minsLeft <= maxMin) {
          const notifKey = `${task.id}-${key}`
          if (!notifiedRef.current.has(notifKey)) {
            notifiedRef.current.add(notifKey)
            showNotification(notifKey, task.id, label(t), task.title, key === 'due')
          }
        }
      })
    })
  }, [tasks, t, enabled, activeThresholds, showNotification])

  useEffect(() => {
    checkAndNotify()
    const id = setInterval(checkAndNotify, 60_000)
    return () => clearInterval(id)
  }, [checkAndNotify])

  // ── Upcoming alerts for dropdown ──────────────────────────────────────────
  const getUpcomingAlerts = useCallback((): NotifAlert[] => {
    return tasks
      .filter(tk => tk.status !== 'done')
      .flatMap(task => {
        const deadline = getDeadline(task)
        if (!deadline) return []
        const minsLeft = (deadline.getTime() - Date.now()) / 60_000
        if (minsLeft > 120 && minsLeft >= 0) return []
        let label = ''
        if (minsLeft < 0)        label = t.notifications.overdue
        else if (minsLeft <= 15) label = t.notifications.dueIn15
        else if (minsLeft <= 30) label = t.notifications.dueIn30
        else                     label = t.notifications.dueIn60
        return [{ task, label, minutesLeft: minsLeft }]
      })
      .sort((a, b) => a.minutesLeft - b.minutesLeft)
  }, [tasks, t])

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied'
    return await Notification.requestPermission()
  }, [])

  return { requestPermission, getUpcomingAlerts }
}
