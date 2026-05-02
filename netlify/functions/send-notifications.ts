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
        const [subJson, schedJson] = await Promise.all([
          store.get(key),
          store.get(`sched:${deviceId}`),
        ])
        if (!subJson || !schedJson) return

        const subscription = JSON.parse(subJson) as webpush.PushSubscription
        const schedules    = JSON.parse(schedJson) as SchedulePayload[]

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

            await store.set(firedKey, '1')

            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title:              s.title,
                body:               s.body,
                tag:                s.key,
                taskId:             s.taskId,
                requireInteraction: s.requireInteraction,
              })
            )
            console.log(`[notify] sent push "${s.title}" → device ${deviceId}`)
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
