import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { initVapid } from '../lib/utils'

// Runs at 23:00 UTC every day = 06:00 UTC+7 (Vietnam Standard Time)
// REQUIRED env vars (set in Netlify dashboard — NEVER commit):
//   VAPID_PRIVATE_KEY           — VAPID key pair (already used by other push functions)
//   SUPABASE_URL                — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   — Service role key (bypasses RLS to read any user's data)

interface StoredSubscription {
  subscription: webpush.PushSubscription
  userId: string | null
  morningBrief?: boolean
}

interface HabitLog { date: string }
interface Habit { id: string; title: string; emoji: string; frequency: string; customDays?: number[]; logs: HabitLog[] }
interface Task { id: string; title: string; status: string; priority: string; dueDate: string | null }
interface StatusDef { id: string; isFinal: boolean }
interface UserData {
  tasks?: Task[]
  statuses?: StatusDef[]
  habits?: Habit[]
  morningBriefEnabled?: boolean
}

// Vietnam date string for a given UTC timestamp
function vietnamDateStr(utcMs: number): string {
  return new Date(utcMs + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function isDue(habit: Habit, dow: number): boolean {
  switch (habit.frequency) {
    case 'daily':    return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekends': return dow === 0 || dow === 6
    case 'custom':   return (habit.customDays ?? []).includes(dow)
    default:         return true
  }
}

function buildBody(data: UserData, todayVN: string): string {
  const finalIds = new Set((data.statuses ?? []).filter(s => s.isFinal).map(s => s.id))

  const tasks = data.tasks ?? []
  const activeTasks = tasks.filter(t => !finalIds.has(t.status))
  const overdue  = activeTasks.filter(t => t.dueDate && t.dueDate < todayVN)
  const dueToday = activeTasks.filter(t => t.dueDate === todayVN)

  const habits  = data.habits ?? []
  const todayDow = new Date(todayVN + 'T00:00:00').getDay()
  const dueHabits  = habits.filter(h => isDue(h, todayDow))
  const doneHabits = dueHabits.filter(h => h.logs.some(l => l.date === todayVN))

  const parts: string[] = []

  if (overdue.length > 0)
    parts.push(`⚠️ ${overdue.length} nhiệm vụ quá hạn`)
  if (dueToday.length > 0)
    parts.push(`📋 ${dueToday.length} việc cần làm hôm nay`)
  if (activeTasks.length === 0 && overdue.length === 0)
    parts.push('✅ Không có việc tồn đọng')
  if (dueHabits.length > 0)
    parts.push(`🎯 Thói quen: ${doneHabits.length}/${dueHabits.length} hoàn thành`)

  return parts.length > 0 ? parts.join(' · ') : 'Mở app để xem tóm tắt hôm nay'
}

export default async () => {
  const { publicKey, privateKey } = initVapid()
  if (!publicKey || !privateKey) {
    console.error('[morning-brief] VAPID keys not set — skipping')
    return new Response('VAPID not configured', { status: 500 })
  }

  const supabaseUrl     = process.env.SUPABASE_URL
  const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null

  const store  = getStore('push-data')
  const nowMs  = Date.now()
  const today  = vietnamDateStr(nowMs)

  try {
    const { blobs } = await store.list({ prefix: 'sub:' })
    console.log(`[morning-brief] checking ${blobs.length} device(s) for ${today}`)

    await Promise.allSettled(
      blobs.map(async ({ key }) => {
        const deviceId = key.replace(/^sub:/, '')
        const subJson  = await store.get(key)
        if (!subJson) return

        let stored: StoredSubscription
        try {
          const parsed = JSON.parse(subJson) as Record<string, unknown>
          if ('subscription' in parsed) {
            stored = parsed as unknown as StoredSubscription
          } else {
            stored = { subscription: parsed as unknown as webpush.PushSubscription, userId: null }
          }
        } catch { return }

        // Skip devices that haven't opted in
        if (!stored.morningBrief) return

        // Check already-sent guard (one per device per day)
        const firedKey = `morning-fired:${deviceId}:${today}`
        const alreadyFired = await store.get(firedKey)
        if (alreadyFired) return

        // Fetch user data from Supabase for personalised summary
        let body = 'Mở app để xem tóm tắt nhiệm vụ hôm nay'
        if (supabase && stored.userId) {
          try {
            const { data: row } = await supabase
              .from('user_state')
              .select('data')
              .eq('user_id', stored.userId)
              .maybeSingle()
            if (row?.data) {
              body = buildBody(row.data as UserData, today)
            }
          } catch (err) {
            console.warn(`[morning-brief] Supabase fetch failed for ${deviceId}:`, err)
          }
        }

        try {
          await webpush.sendNotification(
            stored.subscription,
            JSON.stringify({
              title: '🌅 Chào buổi sáng! TaskPro',
              body,
              tag:   `morning-brief-${today}`,
              url:   '/',
              requireInteraction: false,
            }),
            { urgency: 'normal', TTL: 3 * 60 * 60 } // 3h TTL — expires before the next day
          )
          await store.set(firedKey, '1')
          console.log(`[morning-brief] sent to device ${deviceId}`)
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) {
            // Dead subscription — remove it
            await store.delete(key)
            console.warn(`[morning-brief] removed dead subscription for ${deviceId} (${status})`)
          } else {
            console.error(`[morning-brief] push failed for ${deviceId}:`, err)
          }
        }
      })
    )

    // Clean up old morning-fired flags (older than 2 days)
    try {
      const { blobs: fired } = await store.list({ prefix: 'morning-fired:' })
      const cutoff = nowMs - 2 * 24 * 60 * 60_000
      await Promise.allSettled(
        fired.map(async ({ key, lastModified }) => {
          if (lastModified && new Date(lastModified).getTime() < cutoff) {
            await store.delete(key)
          }
        })
      )
    } catch {}

  } catch (err) {
    console.error('[morning-brief] error:', err)
  }

  return new Response('OK')
}

export const config: Config = { schedule: '0 23 * * *' }
