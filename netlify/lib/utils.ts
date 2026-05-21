import crypto from 'node:crypto'
import webpush from 'web-push'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
}

export function deriveVapidPublicKey(privateKeyB64url: string): string {
  const priv = Buffer.from(privateKeyB64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const ec = crypto.createECDH('prime256v1')
  ec.setPrivateKey(priv)
  return ec.getPublicKey().toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function initVapid(): { publicKey: string; privateKey: string; subject: string } {
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ''
  const publicKey  = privateKey ? deriveVapidPublicKey(privateKey) : (process.env.VAPID_PUBLIC_KEY ?? '')
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@taskpro.app'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return { publicKey, privateKey, subject }
}

export function parseSubscription(subJson: string): { subscription: webpush.PushSubscription; userId: string | null } {
  const parsed = JSON.parse(subJson) as Record<string, unknown>
  if (parsed.subscription && 'userId' in parsed) {
    return {
      subscription: parsed.subscription as webpush.PushSubscription,
      userId: (parsed.userId as string | null) ?? null,
    }
  }
  return { subscription: parsed as unknown as webpush.PushSubscription, userId: null }
}
