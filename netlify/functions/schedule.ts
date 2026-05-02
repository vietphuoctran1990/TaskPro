import type { Handler } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' }

  try {
    const { deviceId, schedules } = JSON.parse(event.body || '{}')
    if (!deviceId || !Array.isArray(schedules)) return { statusCode: 400, headers, body: 'Missing fields' }

    const store = getStore('push-data')
    await store.set(`sched:${deviceId}`, JSON.stringify(schedules))

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, headers, body: String(err) }
  }
}
