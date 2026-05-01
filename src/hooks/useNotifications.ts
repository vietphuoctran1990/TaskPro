import { useEffect, useRef, useCallback, useState } from 'react'
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
  notifBefore: number[]
  onMarkDone: (taskId: string) => void
}

interface Threshold {
  key: string
  label: (t: Translations) => string
  minutes: number
}

const ALL_THRESHOLDS: Threshold[] = [
  { key: '60m', label: t => t.notifications.dueIn60, minutes: 60 },
  { key: '30m', label: t => t.notifications.dueIn30, minutes: 30 },
  { key: '15m', label: t => t.notifications.dueIn15, minutes: 15 },
  { key: 'due', label: t => t.notifications.overdue, minutes:  0 },
]

const HEARTBEAT_MS = 30_000   // ping SW every 30 s to keep it warm + reschedule
const WINDOW_MS    = 3 * 60 * 60_000  // schedule at most 3 hours ahead

export function useNotifications({ tasks, t, enabled, notifBefore, onMarkDone }: Options) {
  const notifiedRef   = useRef(new Set<string>())
  const mainTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const swRegRef      = useRef<ServiceWorkerRegistration | null>(null)
  const [swReady, setSwReady] = useState(false)

  // ── Get SW registration once ───────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      swRegRef.current = reg
      setSwReady(true)
      // Register Periodic Background Sync so the SW can fire notifications
      // even when the app is fully closed (Android Chrome, installed PWA).
      if ('periodicSync' in reg) {
        ;(reg as ServiceWorkerRegistration & { periodicSync: { register(tag: string, opts: { minInterval: number }): Promise<void> } })
          .periodicSync.register('task-notifications', { minInterval: 15 * 60 * 1000 })
          .catch(() => {})
      }
    })
  }, [])

  // ── Listen for SW → client messages ───────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent<{ type: string; taskId?: string; key?: string }>) => {
      const { type, taskId, key } = event.data ?? {}
      if (type === 'MARK_DONE' && taskId) onMarkDone(taskId)
      // SW fired a notification — sync so main thread doesn't re-fire it
      if (type === 'NOTIFIED' && key) notifiedRef.current.add(key)
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [onMarkDone])

  // ── Show notification via SW registration (better mobile support) ──────────
  const showNow = useCallback((
    notifKey: string, taskId: string, title: string, body: string, requireInteraction: boolean
  ) => {
    const reg = swRegRef.current
    if (reg) {
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

  // ── Build the schedule payload (shared between heartbeat and main effect) ──
  const buildSchedules = useCallback(() => {
    const activeThresholds = ALL_THRESHOLDS.filter(
      th => th.minutes === 0 || notifBefore.includes(th.minutes)
    )
    return tasks
      .filter(task => task.status !== 'done')
      .flatMap(task => {
        const deadline = getDeadline(task)
        if (!deadline) return []
        const timeStr = deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return activeThresholds.flatMap(({ key, label, minutes }) => {
          const notifKey = `${task.id}-${key}`
          if (notifiedRef.current.has(notifKey)) return []
          const fireAt  = deadline.getTime() - minutes * 60_000
          const delayMs = fireAt - Date.now()
          // Include anything not too far in the past and within 3h future
          if (delayMs < -5 * 60_000 || delayMs > WINDOW_MS) return []
          return [{ key: notifKey, taskId: task.id, title: task.title,
                    body: `${label(t)} · ${timeStr}`, fireAt,
                    requireInteraction: key === 'due' }]
        })
      })
  }, [tasks, notifBefore, t])

  // ── Heartbeat: ping SW every 30 s with full schedule ──────────────────────
  // This wakes the SW if it was killed and re-registers any missed timers.
  // The SW fires overdue notifications immediately on receipt.
  useEffect(() => {
    if (!enabled || !swReady) return

    const send = () => {
      const reg = swRegRef.current
      if (!reg?.active || Notification.permission !== 'granted') return
      reg.active.postMessage({
        type: 'RESCHEDULE_ALL',
        payload: { schedules: buildSchedules() },
      })
    }

    send()  // immediate send on mount / dependency change
    const id = setInterval(send, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [tasks, enabled, notifBefore, t, swReady, buildSchedules])

  // ── Main-thread exact-time scheduling (foreground precision) ──────────────
  // Runs when app is in foreground; fires at the exact millisecond.
  useEffect(() => {
    mainTimersRef.current.forEach(id => clearTimeout(id))
    mainTimersRef.current.clear()
    if (!enabled || Notification.permission !== 'granted') return

    buildSchedules().forEach(({ key: notifKey, taskId, title, body, fireAt, requireInteraction }) => {
      const delayMs = fireAt - Date.now()
      if (delayMs <= 0) {
        // Already in window — show immediately
        notifiedRef.current.add(notifKey)
        showNow(notifKey, taskId, title, body, requireInteraction)
      } else {
        mainTimersRef.current.set(notifKey, setTimeout(() => {
          if (notifiedRef.current.has(notifKey)) return
          notifiedRef.current.add(notifKey)
          showNow(notifKey, taskId, title, body, requireInteraction)
        }, delayMs))
      }
    })

    return () => {
      mainTimersRef.current.forEach(id => clearTimeout(id))
      mainTimersRef.current.clear()
    }
  }, [tasks, enabled, notifBefore, t, swReady, buildSchedules, showNow])

  // ── Cancel SW timers for completed tasks ──────────────────────────────────
  useEffect(() => {
    const reg = swRegRef.current
    if (!reg?.active) return
    const thresholds = ALL_THRESHOLDS.filter(th => th.minutes === 0 || notifBefore.includes(th.minutes))
    tasks.filter(task => task.status === 'done').forEach(task => {
      thresholds.forEach(({ key }) => {
        reg.active!.postMessage({ type: 'CANCEL_NOTIFICATION', payload: { key: `${task.id}-${key}` } })
      })
    })
  }, [tasks, notifBefore])

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
