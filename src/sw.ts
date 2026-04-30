/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>
  }
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ------- Notification scheduling -------

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
// Track keys already fired this SW lifetime to avoid re-showing after RESCHEDULE_ALL
const fired = new Set<string>()

function showNotif(p: SchedulePayload) {
  fired.add(p.key)
  timers.delete(p.key)
  // Notify open clients so they sync notifiedRef
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then(clients => clients.forEach(c => c.postMessage({ type: 'NOTIFIED', key: p.key, taskId: p.taskId })))
    .catch(() => {})
  self.registration.showNotification(p.title, {
    body: p.body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: p.key,
    requireInteraction: p.requireInteraction,
    data: { key: p.key, taskId: p.taskId },
    // @ts-expect-error actions is valid in SW context
    actions: [{ action: 'done', title: '✓ Done' }],
  })
}

function scheduleOne(p: SchedulePayload) {
  if (fired.has(p.key)) return
  if (timers.has(p.key)) clearTimeout(timers.get(p.key))
  const delay = p.fireAt - Date.now()
  if (delay <= -5 * 60_000) return           // more than 5 min overdue — skip to avoid spam
  if (delay <= 0) {
    showNotif(p)                              // SW was asleep — fire immediately now
  } else if (delay < 3 * 60 * 60_000) {
    timers.set(p.key, setTimeout(() => showNotif(p), delay))
  }
}

// ------- Message handler -------

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as { type: string; payload: unknown } | null
  if (!msg) return

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  // Full reschedule from client heartbeat (every 30s).
  // Handles: SW-was-killed recovery, missed notifications, preference changes.
  if (msg.type === 'RESCHEDULE_ALL') {
    const schedules = (msg.payload as { schedules: SchedulePayload[] }).schedules
    const incoming  = new Set(schedules.map(s => s.key))
    // Clear timers for removed/done tasks
    for (const [k, timer] of timers) {
      if (!incoming.has(k)) { clearTimeout(timer); timers.delete(k) }
    }
    schedules.forEach(scheduleOne)
    return
  }

  // Legacy single-notification schedule (kept for compatibility)
  if (msg.type === 'SCHEDULE_NOTIFICATION') {
    scheduleOne(msg.payload as SchedulePayload)
    return
  }

  if (msg.type === 'CANCEL_NOTIFICATION') {
    const k = (msg.payload as { key: string }).key
    if (timers.has(k)) { clearTimeout(timers.get(k)); timers.delete(k) }
    fired.delete(k)
  }
})

// ------- Notification click -------

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const { taskId } = (event.notification.data ?? {}) as { taskId?: string }

  if (event.action === 'done' && taskId) {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'MARK_DONE', taskId }))
      )
    )
    return
  }

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      const visible = clients.find(c => c.visibilityState === 'visible')
      if (visible) return visible.focus()
      return self.clients.openWindow('/')
    })
  )
})
