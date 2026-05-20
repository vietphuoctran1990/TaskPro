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

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     ?? 'mailto:admin@taskpro.app'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors() })

  const { deviceId } = await req.json().catch(() => ({})) as { deviceId?: string }

  // 1. VAPID key checks
  const vapidPublicSet  = !!VAPID_PUBLIC
  const vapidPrivateSet = !!VAPID_PRIVATE
  let vapidKeysValid    = false
  let vapidKeysMatch    = false
  let derivedPublic     = ''
  let vapidError        = ''
  if (vapidPublicSet && vapidPrivateSet) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
      vapidKeysValid = true
      // Derive public key from private key to verify they're a matching pair
      try {
        const privBytes = Buffer.from(VAPID_PRIVATE.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
        const ec = crypto.createECDH('prime256v1')
        ec.setPrivateKey(privBytes)
        derivedPublic = ec.getPublicKey().toString('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
        vapidKeysMatch = derivedPublic === VAPID_PUBLIC
      } catch (e) {
        vapidError = 'derive: ' + String(e)
      }
    } catch (e) {
      vapidError = String(e)
    }
  }

  // 2. Subscription check
  let hasSubscription   = false
  let subFormat         = 'none'
  let subEndpointPrefix = ''
  if (deviceId) {
    try {
      const store   = getStore('push-data')
      const subJson = await store.get(`sub:${deviceId}`)
      if (subJson) {
        hasSubscription = true
        const parsed = JSON.parse(subJson) as Record<string, unknown>
        if (parsed.subscription && 'userId' in parsed) {
          subFormat         = 'new ({ subscription, userId })'
          const sub = parsed.subscription as { endpoint?: string }
          subEndpointPrefix = String(sub.endpoint ?? '').slice(0, 40)
        } else {
          subFormat         = 'old (raw)'
          const sub = parsed as { endpoint?: string }
          subEndpointPrefix = String(sub.endpoint ?? '').slice(0, 40)
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify({
    vapid: {
      publicKeySet:    vapidPublicSet,
      privateKeySet:   vapidPrivateSet,
      keysValid:       vapidKeysValid,
      keysMatchPair:   vapidKeysMatch,
      error:           vapidError || null,
      // safe to show — it's the public key
      publicKey:           VAPID_PUBLIC,
      derivedFromPrivate:  derivedPublic,
    },
    subscription: {
      found:         hasSubscription,
      format:        subFormat,
      endpointStart: subEndpointPrefix,
    },
  }), { headers: { ...cors(), 'Content-Type': 'application/json' } })
}

export const config: Config = { path: '/api/check-config' }
