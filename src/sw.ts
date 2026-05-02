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

// ------- Types -------

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

// ------- In-memory state (reset each SW lifetime) -------

const timers = new Map<string, ReturnType<typeof setTimeout>>()
// Keys already fired this SW lifetime — prevents duplicates after RESCHEDULE_ALL
const fired = new Set<string>()

// ------- IndexedDB persistence -------
// Schedules are saved here so Periodic Background Sync can fire them
// even after the browser kills and restarts the SW.

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('taskpro-sw', 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('schedules')) {
        req.result.createObjectStore('schedules', { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function saveSchedulesToDB(schedules: SchedulePayload[]): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction('schedules', 'readwrite')
    const store = tx.objectStore('schedules')
    store.clear()
    schedules.forEach(s => store.put(s))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })).catch(() => {})
}

function loadSchedulesFromDB(): Promise<SchedulePayload[]> {
  return openDB().then(db => new Promise<SchedulePayload[]>((resolve, reject) => {
    const req = db.transaction('schedules', 'readonly').objectStore('schedules').getAll()
    req.onsuccess = () => resolve(req.result as SchedulePayload[])
    req.onerror = () => reject(req.error)
  })).catch(() => [])
}

// ------- Notification helpers -------

function showNotif(p: SchedulePayload) {
  fired.add(p.key)
  timers.delete(p.key)
  // Tell open clients so they sync notifiedRef and don't re-fire
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
  if (delay <= -5 * 60_000) return           // more than 5 min overdue — skip spam
  if (delay <= 0) {
    showNotif(p)                              // SW was asleep — fire immediately
  } else if (delay < 3 * 60 * 60_000) {
    timers.set(p.key, setTimeout(() => showNotif(p), delay))
  }
}

// Load IDB and fire anything currently due.
// Used by Periodic Background Sync (app closed) and SW wake-up.
async function fireFromIDB(): Promise<void> {
  const schedules = await loadSchedulesFromDB()
  schedules.forEach(scheduleOne)
}

// ------- Periodic Background Sync -------
// Wakes the SW on a schedule even when the app is fully closed.
// Requires: PWA installed on home screen + Android Chrome 80+.

self.addEventListener('periodicsync', (event: Event) => {
  const e = event as ExtendableEvent & { tag: string }
  if (e.tag === 'task-notifications') {
    e.waitUntil(fireFromIDB())
  }
})

// ------- Message handler -------

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as { type: string; payload: unknown } | null
  if (!msg) return

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  // Full reschedule from client heartbeat (every 30 s).
  // Also persists to IDB so Periodic Background Sync can read them after SW restarts.
  if (msg.type === 'RESCHEDULE_ALL') {
    const schedules = (msg.payload as { schedules: SchedulePayload[] }).schedules
    const incoming  = new Set(schedules.map(s => s.key))
    for (const [k, timer] of timers) {
      if (!incoming.has(k)) { clearTimeout(timer); timers.delete(k) }
    }
    schedules.forEach(scheduleOne)
    saveSchedulesToDB(schedules)
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

// ------- Web Push handler (server → SW, works when app is closed) -------

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  try {
    const d = event.data.json() as {
      title: string; body: string; tag: string
      taskId: string; requireInteraction: boolean
    }
    event.waitUntil(
      self.registration.showNotification(d.title, {
        body:                d.body,
        icon:                '/icon-192x192.png',
        badge:               '/icon-72x72.png',
        tag:                 d.tag,
        requireInteraction:  d.requireInteraction,
        data:                { key: d.tag, taskId: d.taskId },
        // @ts-expect-error actions is valid in SW context
        actions:             [{ action: 'done', title: '✓ Done' }],
      })
    )
  } catch {}
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
