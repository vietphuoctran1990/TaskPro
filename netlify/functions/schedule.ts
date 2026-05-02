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
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() })

  try {
    const { deviceId, schedules } = await req.json()
    if (!deviceId || !Array.isArray(schedules)) return new Response('Missing fields', { status: 400, headers: cors() })

    const store = getStore('push-data')
    await store.set(`sched:${deviceId}`, JSON.stringify(schedules))
    console.log(`[schedule] stored ${schedules.length} items for device ${deviceId}`)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[schedule] error:', err)
    return new Response(String(err), { status: 500, headers: cors() })
  }
}

export const config: Config = { path: '/api/schedule' }
