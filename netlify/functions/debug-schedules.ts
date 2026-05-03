import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: cors() })

  try {
    const { deviceId } = await req.json()
    if (!deviceId) return new Response(JSON.stringify({ ok: false, error: 'Missing deviceId' }),
      { status: 400, headers: { ...cors(), 'Content-Type': 'application/json' } })

    const store   = getStore('push-data')
    const subJson = await store.get(`sub:${deviceId}`)
    const schedJson = await store.get(`sched:${deviceId}`)

    const schedules = schedJson ? JSON.parse(schedJson) : []
    const now = Date.now()

    return new Response(JSON.stringify({
      ok: true,
      hasSubscription: !!subJson,
      scheduleCount: schedules.length,
      schedules: schedules.map((s: { key: string; title: string; fireAt: number }) => ({
        key:   s.key,
        title: s.title,
        fireAt: new Date(s.fireAt).toISOString(),
        inMinutes: Math.round((s.fireAt - now) / 60_000),
      })),
    }), {
      headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...cors(), 'Content-Type': 'application/json' } })
  }
}

export const config: Config = { path: '/api/debug-schedules' }
