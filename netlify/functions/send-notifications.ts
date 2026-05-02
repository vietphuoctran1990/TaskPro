import { schedule } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'

interface SchedulePayload {
  key: string
  taskId: string
  title: string
  body: string
  fireAt: number
  requireInteraction: boolean
}

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || 'mailto:admin@taskpro.app'

export default schedule('* * * * *', async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('VAPID keys not configured')
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  const store = getStore('push-data')
  const now   = Date.now()

  try {
    const { blobs } = await store.list({ prefix: 'sub:' })

    await Promise.allSettled(
      blobs.map(async ({ key }) => {
        const deviceId  = key.replace(/^sub:/, '')
        const [subJson, schedJson] = await Promise.all([
          store.get(key),
          store.get(`sched:${deviceId}`),
        ])
        if (!subJson || !schedJson) return

        const subscription: webpush.PushSubscription = JSON.parse(subJson)
        const schedules: SchedulePayload[]            = JSON.parse(schedJson)

        // Fire notifications due within ±60 s window (cron precision)
        const due = schedules.filter(s => {
          const delay = s.fireAt - now
          return delay <= 60_000 && delay > -5 * 60_000
        })

        await Promise.allSettled(
          due.map(async (s) => {
            // Check fired flag to avoid duplicates across cron runs
            const firedKey = `fired:${deviceId}:${s.key}`
            const alreadyFired = await store.get(firedKey)
            if (alreadyFired) return

            // Mark fired FIRST to prevent parallel duplicates
            await store.set(firedKey, '1')

            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title:               s.title,
                body:                s.body,
                tag:                 s.key,
                taskId:              s.taskId,
                requireInteraction:  s.requireInteraction,
              })
            )

            console.log(`Sent push for ${s.key} to device ${deviceId}`)
          })
        )
      })
    )
  } catch (err) {
    console.error('send-notifications error:', err)
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
})
