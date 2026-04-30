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

// ------- Scheduled notification timers -------

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function schedule(p: SchedulePayload) {
  if (timers.has(p.key)) clearTimeout(timers.get(p.key))
  const delay = p.fireAt - Date.now()
  if (delay <= 0 || delay > 3 * 60 * 60 * 1000) return
  timers.set(p.key, setTimeout(() => {
    timers.delete(p.key)
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: p.key,
      renotify: false,
      requireInteraction: p.requireInteraction,
      data: { key: p.key, taskId: p.taskId },
      // @ts-expect-error actions exists in SW context
      actions: [{ action: 'done', title: '✓ Done' }],
    })
  }, delay))
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data as { type: string; payload: SchedulePayload & { key: string } } | null
  if (!msg) return
  // Required for vite-plugin-pwa update flow (registerType: 'prompt')
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (msg.type === 'SCHEDULE_NOTIFICATION') {
    schedule(msg.payload)
  } else if (msg.type === 'CANCEL_NOTIFICATION') {
    const k = msg.payload.key
    if (timers.has(k)) { clearTimeout(timers.get(k)); timers.delete(k) }
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
