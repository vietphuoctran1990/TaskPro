import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import webpush from 'web-push'
import crypto from 'node:crypto'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Always derive public key from private key to avoid dashboard/toml mismatch
function deriveVapidPublicKey(privateKeyB64url: string): string {
  const priv = Buffer.from(privateKeyB64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const ec = crypto.createECDH('prime256v1')
  ec.setPrivateKey(priv)
  return ec.getPublicKey().toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_PUBLIC  = VAPID_PRIVATE ? deriveVapidPublicKey(VAPID_PRIVATE) : (process.env.VAPID_PUBLIC_KEY ?? '')
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@taskpro.app'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: cors() })

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ ok: false, error: 'VAPID keys not set on server' }),
      { status: 500, headers: { ...cors(), 'Content-Type': 'application/json' } })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  try {
    const { deviceId } = await req.json()
    if (!deviceId) return new Response(JSON.stringify({ ok: false, error: 'Missing deviceId' }),
      { status: 400, headers: { ...cors(), 'Content-Type': 'application/json' } })

    const store = getStore('push-data')
    const subJson = await store.get(`sub:${deviceId}`)
    if (!subJson) return new Response(JSON.stringify({ ok: false, error: 'No subscription found for this device' }),
      { status: 404, headers: { ...cors(), 'Content-Type': 'application/json' } })

    // Handle both old format (raw subscription) and new format ({ subscription, userId })
    const parsed = JSON.parse(subJson) as Record<string, unknown>
    const subscription = (parsed.subscription && 'userId' in parsed)
      ? (parsed.subscription as webpush.PushSubscription)
      : (parsed as unknown as webpush.PushSubscription)

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title:              '🧪 TaskPro test',
        body:               `Push pipeline OK — ${new Date().toLocaleTimeString()}`,
        tag:                `test-${Date.now()}`,
        taskId:             '',
        requireInteraction: false,
      }),
      { urgency: 'high', TTL: 60 }
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    return new Response(JSON.stringify({ ok: false, error: String(err), statusCode: status }),
      { status: 500, headers: { ...cors(), 'Content-Type': 'application/json' } })
  }
}

export const config: Config = { path: '/api/test-push' }
