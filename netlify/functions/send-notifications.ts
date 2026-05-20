import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import webpush from 'web-push'

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     ?? 'mailto:admin@taskpro.app'

export default async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('[notify] VAPID keys not set — skipping')
    return new Response('VAPID not configured', { status: 500 })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

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

        // Parse subscription — handle both old format (raw subscription) and new format ({ subscription, userId })
        let subscription: webpush.PushSubscription
        let userId: string | null = null
        try {
          const parsed = JSON.parse(subJson) as Record<string, unknown>
          if (parsed.subscription && 'userId' in parsed) {
            subscription = parsed.subscription as webpush.PushSubscription
            userId = (parsed.userId as string | null) ?? null
          } else {
            subscription = parsed as unknown as webpush.PushSubscription
          }
        } catch { return }

        // Look up schedule: user-scoped first (cross-device), fall back to device-specific
        let schedJson: string | null = null
        if (userId) {
          schedJson = await store.get(`sched:user:${userId}`)
        }
        if (!schedJson) {
          schedJson = await store.get(`sched:${deviceId}`)
        }
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
                {
                  urgency: 'high',  // wake Android from Doze mode immediately
                  TTL: 4 * 60 * 60, // retry for 4h if device offline
                }
              )
              // Mark fired only after successful delivery — transient errors will be retried next cron run
              await store.set(firedKey, '1')
              console.log(`[notify] sent push "${s.title}" → device ${deviceId}`)
            } catch (err) {
              const status = (err as { statusCode?: number })?.statusCode
              if (status === 404 || status === 410) {
                // Subscription expired/invalid — mark fired + remove so we stop retrying
                await store.set(firedKey, '1')
                await store.delete(key)
                console.warn(`[notify] removed dead subscription for device ${deviceId} (${status})`)
              } else {
                // Transient error — don't mark fired, next cron run will retry
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
