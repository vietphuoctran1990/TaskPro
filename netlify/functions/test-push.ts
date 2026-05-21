import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import webpush from 'web-push'
import { jsonResponse, optionsResponse, methodNotAllowed, initVapid, parseSubscription } from '../lib/utils'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return methodNotAllowed()

  const { publicKey, privateKey } = initVapid()
  if (!publicKey || !privateKey) return jsonResponse({ ok: false, error: 'VAPID keys not set on server' }, 500)

  try {
    const { deviceId } = await req.json()
    if (!deviceId) return jsonResponse({ ok: false, error: 'Missing deviceId' }, 400)

    const store   = getStore('push-data')
    const subJson = await store.get(`sub:${deviceId}`)
    if (!subJson) return jsonResponse({ ok: false, error: 'No subscription found for this device' }, 404)

    const { subscription } = parseSubscription(subJson)
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: '🧪 TaskPro test',
        body:  `Push pipeline OK — ${new Date().toLocaleTimeString()}`,
        tag:   `test-${Date.now()}`,
        taskId: '',
        requireInteraction: false,
      }),
      { urgency: 'high', TTL: 60 }
    )

    return jsonResponse({ ok: true })
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    return jsonResponse({ ok: false, error: String(err), statusCode }, 500)
  }
}

export const config: Config = { path: '/api/test-push' }
