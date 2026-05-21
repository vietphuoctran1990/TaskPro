import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { initVapid, parseSubscription } from '../lib/utils'

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

export default async () => {
  const { publicKey, privateKey } = initVapid()
  if (!publicKey || !privateKey) {
    console.error('[notify] VAPID keys not set — skipping')
    return new Response('VAPID not configured', { status: 500 })
  }

  const store = getStore('push-data')
  const now   = Date.now()

  try {
    const { blobs } = await store.list({ prefix: 'sub:' })
    console.log(`[notify] checking ${blobs.length} device(s)`)

    await Promise.allSettled(
      blobs.map(async ({ key }) => {
        const deviceId = key.replace(/^sub:/, '')
        const subJson  = await store.get(key)
        if (!subJson) return

        let subscription: webpush.PushSubscription
        let userId: string | null = null
        try {
          ;({ subscription, userId } = parseSubscription(subJson))
        } catch { return }

        // Look up schedule: user-scoped first (cross-device), fall back to device-specific
        let schedJson: string | null = null
        if (userId) schedJson = await store.get(`sched:user:${userId}`)
        if (!schedJson) schedJson = await store.get(`sched:${deviceId}`)
        if (!schedJson) return

        const schedules = JSON.parse(schedJson) as SchedulePayload[]
        const due = schedules.filter(s => {
          const delay = s.fireAt - now
          return delay <= 60_000 && delay > -5 * 60_000
        })
        if (due.length === 0) return

        await Promise.allSettled(
          due.map(async (s) => {
            const firedKey     = `fired:${deviceId}:${s.key}`
            const alreadyFired = await store.get(firedKey)
            if (alreadyFired) return

            try {
              await webpush.sendNotification(
                subscription,
                JSON.stringify({
                  title:              s.title,
                  body:               s.body,
                  tag:                s.key,
                  taskId:             s.taskId,
                  requireInteraction: s.requireInteraction,
                }),
                { urgency: 'high', TTL: 4 * 60 * 60 }
              )
              await store.set(firedKey, '1')
              console.log(`[notify] sent push "${s.title}" → device ${deviceId}`)
            } catch (err) {
              const status = (err as { statusCode?: number })?.statusCode
              if (status === 404 || status === 410) {
                await store.set(firedKey, '1')
                await store.delete(key)
                console.warn(`[notify] removed dead subscription for device ${deviceId} (${status})`)
              } else {
                console.error(`[notify] push failed for device ${deviceId}:`, err)
              }
            }
          })
        )
      })
    )
  } catch (err) {
    console.error('[notify] error:', err)
  }

  // Clean up fired flags older than 2 hours
  try {
    const { blobs: fired } = await store.list({ prefix: 'fired:' })
    const cutoff = now - 2 * 60 * 60_000
    await Promise.allSettled(
      fired.map(async ({ key, lastModified }) => {
        if (lastModified && new Date(lastModified).getTime() < cutoff) {
          await store.delete(key)
        }
      })
    )
  } catch {}

  return new Response('OK')
}

export const config: Config = { schedule: '* * * * *' }
