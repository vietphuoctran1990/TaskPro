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

export function useNotifications({ tasks, t, enabled, notifBefore, onMarkDone }: Options) {
  const notifiedRef   = useRef(new Set<string>())
  const mainTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const swRegRef      = useRef<ServiceWorkerRegistration | null>(null)
  const [swReady, setSwReady] = useState(false)

  // ── Get SW registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      swRegRef.current = reg
      setSwReady(true)
    })
  }, [])

  // ── Listen for MARK_DONE from notification action button ───────────────────
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

  // ── Show a notification right now ─────────────────────────────────────────
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

  // ── Core scheduling effect ─────────────────────────────────────────────────
  // Re-runs when tasks change, prefs change, SW becomes ready, or enabled toggles.
  // Uses exact setTimeout per notification — no polling window drift.
  useEffect(() => {
    // Clear previous main-thread timers
    mainTimersRef.current.forEach(id => clearTimeout(id))
    mainTimersRef.current.clear()

    if (!enabled || Notification.permission !== 'granted') return

    const activeThresholds = ALL_THRESHOLDS.filter(
      th => th.minutes === 0 || notifBefore.includes(th.minutes)
    )

    tasks.filter(task => task.status !== 'done').forEach(task => {
      const deadline = getDeadline(task)
      if (!deadline) return

      activeThresholds.forEach(({ key, label, minutes }) => {
        const notifKey = `${task.id}-${key}`
        if (notifiedRef.current.has(notifKey)) return

        const fireAt  = deadline.getTime() - minutes * 60_000
        const delayMs = fireAt - Date.now()

        if (delayMs <= 0 && delayMs > -30 * 60_000) {
          // Already inside the window — show immediately
          notifiedRef.current.add(notifKey)
          showNow(notifKey, task.id, label(t), task.title, key === 'due')

        } else if (delayMs > 0 && delayMs < 3 * 60 * 60_000) {
          // Future — schedule via main thread (precise)
          mainTimersRef.current.set(notifKey, setTimeout(() => {
            if (notifiedRef.current.has(notifKey)) return
            notifiedRef.current.add(notifKey)
            showNow(notifKey, task.id, label(t), task.title, key === 'due')
          }, delayMs))

          // Also schedule via SW for when app is backgrounded/minimised
          swRegRef.current?.active?.postMessage({
            type: 'SCHEDULE_NOTIFICATION',
            payload: { key: notifKey, taskId: task.id, title: label(t), body: task.title, fireAt, requireInteraction: key === 'due' },
          })
        }
      })
    })

    return () => {
      mainTimersRef.current.forEach(id => clearTimeout(id))
      mainTimersRef.current.clear()
    }
  }, [tasks, enabled, notifBefore, t, swReady, showNow])

  // ── Cancel SW timers when tasks are marked done ───────────────────────────
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
