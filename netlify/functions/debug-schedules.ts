import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { jsonResponse, optionsResponse, methodNotAllowed } from '../lib/utils'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return methodNotAllowed()

  try {
    const { deviceId } = await req.json()
    if (!deviceId) return jsonResponse({ ok: false, error: 'Missing deviceId' }, 400)

    const store     = getStore('push-data')
    const subJson   = await store.get(`sub:${deviceId}`)
    const schedJson = await store.get(`sched:${deviceId}`)
    const schedules = schedJson ? JSON.parse(schedJson) : []
    const now       = Date.now()

    return jsonResponse({
      ok: true,
      hasSubscription: !!subJson,
      scheduleCount: schedules.length,
      schedules: schedules.map((s: { key: string; title: string; fireAt: number }) => ({
        key:       s.key,
        title:     s.title,
        fireAt:    new Date(s.fireAt).toISOString(),
        inMinutes: Math.round((s.fireAt - now) / 60_000),
      })),
    })
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500)
  }
}

export const config: Config = { path: '/api/debug-schedules' }
