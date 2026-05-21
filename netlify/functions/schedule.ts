import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { jsonResponse, optionsResponse, methodNotAllowed, CORS_HEADERS } from '../lib/utils'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return methodNotAllowed()

  try {
    const { deviceId, schedules, userId } = await req.json()
    if (!deviceId || !Array.isArray(schedules)) return new Response('Missing fields', { status: 400, headers: CORS_HEADERS })

    const store = getStore('push-data')
    await store.set(`sched:${deviceId}`, JSON.stringify(schedules))
    if (userId) {
      await store.set(`sched:user:${userId}`, JSON.stringify(schedules))
      console.log(`[schedule] stored ${schedules.length} items for user ${userId} (device ${deviceId})`)
    } else {
      console.log(`[schedule] stored ${schedules.length} items for device ${deviceId}`)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('[schedule] error:', err)
    return new Response(String(err), { status: 500, headers: CORS_HEADERS })
  }
}

export const config: Config = { path: '/api/schedule' }
