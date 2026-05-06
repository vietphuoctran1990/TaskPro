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
    const { subscription, deviceId, userId } = await req.json()
    if (!subscription || !deviceId) return new Response('Missing fields', { status: 400, headers: cors() })

    const store = getStore('push-data')
    // Store subscription with userId so cron can send cross-device for same user
    await store.set(`sub:${deviceId}`, JSON.stringify({ subscription, userId: userId ?? null }))
    console.log(`[subscribe] stored subscription for device ${deviceId}, userId: ${userId ?? 'anonymous'}`)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[subscribe] error:', err)
    return new Response(String(err), { status: 500, headers: cors() })
  }
}

export const config: Config = { path: '/api/subscribe' }
