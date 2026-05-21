import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import webpush from 'web-push'
import { jsonResponse, optionsResponse, methodNotAllowed, deriveVapidPublicKey } from '../lib/utils'

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     ?? 'mailto:admin@taskpro.app'

export default async (req: Request, context: Context) => {
  void context
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST')   return methodNotAllowed()

  const { deviceId } = await req.json().catch(() => ({})) as { deviceId?: string }

  // VAPID key diagnostics
  const vapidPublicSet  = !!VAPID_PUBLIC
  const vapidPrivateSet = !!VAPID_PRIVATE
  let vapidKeysValid  = false
  let vapidKeysMatch  = false
  let derivedPublic   = ''
  let vapidError      = ''

  if (vapidPublicSet && vapidPrivateSet) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
      vapidKeysValid = true
      try {
        derivedPublic  = deriveVapidPublicKey(VAPID_PRIVATE)
        vapidKeysMatch = derivedPublic === VAPID_PUBLIC
      } catch (e) {
        vapidError = 'derive: ' + String(e)
      }
    } catch (e) {
      vapidError = String(e)
    }
  }

  // Subscription diagnostics
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
          subEndpointPrefix = String((parsed.subscription as { endpoint?: string }).endpoint ?? '').slice(0, 40)
        } else {
          subFormat         = 'old (raw)'
          subEndpointPrefix = String((parsed as { endpoint?: string }).endpoint ?? '').slice(0, 40)
        }
      }
    } catch {}
  }

  return jsonResponse({
    vapid: {
      publicKeySet:       vapidPublicSet,
      privateKeySet:      vapidPrivateSet,
      keysValid:          vapidKeysValid,
      keysMatchPair:      vapidKeysMatch,
      error:              vapidError || null,
      publicKey:          VAPID_PUBLIC,
      derivedFromPrivate: derivedPublic,
    },
    subscription: {
      found:         hasSubscription,
      format:        subFormat,
      endpointStart: subEndpointPrefix,
    },
  })
}

export const config: Config = { path: '/api/check-config' }
