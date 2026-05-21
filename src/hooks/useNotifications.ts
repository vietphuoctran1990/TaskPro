import { useEffect, useRef, useCallback, useState } from 'react'
import type { Task } from '../types'
import type { Translations } from '../i18n/types'
import { getDeadline, isIOSDevice, isInstalledPWA } from '../lib/utils'

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
  userId?: string
  finalStatusIds?: ReadonlySet<string>
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

const HEARTBEAT_MS = 30_000
const PAST_GRACE_MS = 5 * 60_000  // ignore schedules >5 min in the past

// VAPID public key for Web Push subscription (must match server's VAPID_PUBLIC_KEY env var)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function getDeviceId(): string {
  let id = localStorage.getItem('taskpro-device-id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('taskpro-device-id', id) }
  return id
}

async function syncSubscriptionToServer(reg: ServiceWorkerRegistration, userId?: string) {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — push disabled')
    return
  }
  // iOS Safari only supports Web Push in standalone (installed PWA) mode
  if (isIOSDevice() && !isInstalledPWA()) {
    console.warn('[push] iOS Safari without home screen install — push not supported')
    return
  }
  try {
    // Always re-subscribe (refreshes expired subscriptions)
    let sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    })
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), deviceId: getDeviceId(), userId: userId ?? null }),
    })
    console.log('[push] subscription synced, status:', res.status)
  } catch (err) {
    console.error('[push] subscribe failed:', err)
  }
}

interface ScheduleItem {
  key: string; taskId: string; title: string; body: string; fireAt: number; requireInteraction: boolean
}

async function syncSchedulesToServer(schedules: ScheduleItem[], userId?: string) {
  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), schedules, userId: userId ?? null }),
    })
    if (!res.ok) console.warn('[push] schedule sync failed:', res.status)
  } catch (err) {
    console.warn('[push] schedule sync error:', err)
  }
}

function buildSchedulesFor(
  tasks: Task[], notifBefore: number[], t: Translations,
  notifiedRef: { current: Set<string> },
  finalStatusIds?: ReadonlySet<string>
): ScheduleItem[] {
  const activeThresholds = ALL_THRESHOLDS.filter(
    th => th.minutes === 0 || notifBefore.includes(th.minutes)
  )
  const isDone = (status: string) =>
    finalStatusIds ? finalStatusIds.has(status) : status === 'done'
  return tasks
    .filter(task => !isDone(task.status))
    .flatMap(task => {
      const deadline = getDeadline(task)
      if (!deadline) return []
      const timeStr = deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return activeThresholds.flatMap(({ key, label, minutes }) => {
        const notifKey = `${task.id}-${key}`
        if (notifiedRef.current.has(notifKey)) return []
        const fireAt  = deadline.getTime() - minutes * 60_000
        const delayMs = fireAt - Date.now()
        if (delayMs < -PAST_GRACE_MS) return []
        return [{ key: notifKey, taskId: task.id, title: task.title,
                  body: `${label(t)} · ${timeStr}`, fireAt,
                  requireInteraction: key === 'due' }]
      })
    })
}

export function useNotifications({ tasks, t, enabled, notifBefore, onMarkDone, userId, finalStatusIds }: Options) {
  const notifiedRef   = useRef(new Set<string>())
  const mainTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const swRegRef      = useRef<ServiceWorkerRegistration | null>(null)
  const [swReady, setSwReady] = useState(false)

  // ── Get SW registration ───────────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      swRegRef.current = reg
      setSwReady(true)
      // Periodic Background Sync as additional fallback (Android Chrome, installed PWA)
      if ('periodicSync' in reg) {
        ;(reg as ServiceWorkerRegistration & { periodicSync: { register(tag: string, opts: { minInterval: number }): Promise<void> } })
          .periodicSync.register('task-notifications', { minInterval: 15 * 60 * 1000 })
          .catch(() => {})
      }
    })
  }, [])

  // ── Subscribe to Web Push whenever permission is granted ──────────────────
  // Runs when swReady or enabled changes so we don't miss the subscription.
  useEffect(() => {
    if (!swReady || !enabled) return
    if (Notification.permission === 'granted' && swRegRef.current) {
      syncSubscriptionToServer(swRegRef.current, userId)
    }
  }, [swReady, enabled, userId])

  // ── Listen for SW → client messages ───────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent<{ type: string; taskId?: string; key?: string }>) => {
      const { type, taskId, key } = event.data ?? {}
      if (type === 'MARK_DONE' && taskId) onMarkDone(taskId)
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

  // ── Build the schedule payload ─────────────────────────────────────────────
  const buildSchedules = useCallback(
    () => buildSchedulesFor(tasks, notifBefore, t, notifiedRef, finalStatusIds),
    [tasks, notifBefore, t, finalStatusIds]
  )

  // ── Heartbeat: ping SW every 30 s + sync server schedule ─────────────────
  useEffect(() => {
    if (!enabled || !swReady) return

    const send = () => {
      const reg = swRegRef.current
      if (!reg?.active || Notification.permission !== 'granted') return
      const schedules = buildSchedules()
      reg.active.postMessage({ type: 'RESCHEDULE_ALL', payload: { schedules } })
      // Sync to server so the cron job can push when the app is closed
      syncSchedulesToServer(schedules, userId)
    }

    send()
    const id = setInterval(send, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [tasks, enabled, notifBefore, t, swReady, buildSchedules, userId])

  // ── Main-thread exact-time scheduling (foreground precision) ──────────────
  useEffect(() => {
    mainTimersRef.current.forEach(id => clearTimeout(id))
    mainTimersRef.current.clear()
    if (!enabled || Notification.permission !== 'granted') return

    buildSchedules().forEach(({ key: notifKey, taskId, title, body, fireAt, requireInteraction }) => {
      const delayMs = fireAt - Date.now()
      if (delayMs <= 0) {
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
    const isDone = (s: string) => finalStatusIds ? finalStatusIds.has(s) : s === 'done'
    tasks.filter(task => isDone(task.status)).forEach(task => {
      thresholds.forEach(({ key }) => {
        reg.active!.postMessage({ type: 'CANCEL_NOTIFICATION', payload: { key: `${task.id}-${key}` } })
      })
    })
  }, [tasks, notifBefore, finalStatusIds])

  // ── Re-subscribe to Web Push when permission changes ──────────────────────
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied'
    // On iOS without standalone mode, push won't work regardless of permission
    if (isIOSDevice() && !isInstalledPWA()) return 'denied'
    const perm = await Notification.requestPermission()
    if (perm === 'granted' && swRegRef.current) {
      await syncSubscriptionToServer(swRegRef.current, userId)
    }
    return perm
  }, [userId])

  // ── Upcoming alerts for dropdown ──────────────────────────────────────────
  const getUpcomingAlerts = useCallback((): NotifAlert[] => {
    const isDone = (s: string) => finalStatusIds ? finalStatusIds.has(s) : s === 'done'
    return tasks
      .filter(tk => !isDone(tk.status))
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
  }, [tasks, t, finalStatusIds])

  return { requestPermission, getUpcomingAlerts }
}
