import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { jsonResponse, optionsResponse, methodNotAllowed, CORS_HEADERS } from '../lib/utils'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return methodNotAllowed()

  try {
    const { deviceId, enabled } = await req.json() as { deviceId?: string; enabled?: boolean }
    if (!deviceId || typeof enabled !== 'boolean') {
      return new Response('Missing deviceId or enabled', { status: 400, headers: CORS_HEADERS })
    }

    const store = getStore('push-data')
    const subJson = await store.get(`sub:${deviceId}`)
    if (!subJson) return new Response('Subscription not found', { status: 404, headers: CORS_HEADERS })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(subJson) as Record<string, unknown>
      // Normalize legacy format (bare PushSubscription without wrapper)
      if (!('subscription' in parsed)) {
        parsed = { subscription: parsed, userId: null }
      }
    } catch {
      return new Response('Invalid subscription data', { status: 500, headers: CORS_HEADERS })
    }

    // Merge morningBrief flag and write back
    const updated = { ...parsed, morningBrief: enabled }
    await store.set(`sub:${deviceId}`, JSON.stringify(updated))
    console.log(`[morning-brief] ${enabled ? 'enabled' : 'disabled'} for device ${deviceId}`)

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('[morning-brief-flag] error:', err)
    return new Response(String(err), { status: 500, headers: CORS_HEADERS })
  }
}

export const config: Config = { path: '/api/morning-brief' }
