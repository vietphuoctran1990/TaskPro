// Shared habit-tracking computations — used by HabitsView, DashboardView and the AI context.
import type { Habit } from '../types'
import { localISO } from './dateLocal'

/** True when the habit is scheduled on the given calendar day. */
export function isHabitDueOn(habit: Habit, d: Date): boolean {
  const dow = d.getDay() // 0=Sun … 6=Sat
  switch (habit.frequency) {
    case 'daily':    return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekends': return dow === 0 || dow === 6
    case 'custom':   return (habit.customDays ?? [0, 1, 2, 3, 4, 5, 6]).includes(dow)
    default:         return true
  }
}

export function isHabitDoneOn(habit: Habit, dateStr: string): boolean {
  return habit.logs.some(l => l.date === dateStr)
}

/**
 * Current streak = consecutive scheduled days (ending today/yesterday) that were
 * completed. Non-scheduled days are skipped, not counted as breaks.
 */
export function habitStreak(habit: Habit, todayStr: string): number {
  const logSet = new Set(habit.logs.map(l => l.date))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0

  // Count today only if it's scheduled and already done.
  if (isHabitDueOn(habit, today) && logSet.has(todayStr)) streak = 1

  // Walk backward from yesterday, skipping unscheduled days.
  const d = new Date(today)
  d.setDate(d.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    if (!isHabitDueOn(habit, d)) { d.setDate(d.getDate() - 1); continue }
    if (logSet.has(localISO(d))) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

export interface HabitDay {
  ds: string
  due: boolean
  done: boolean
  isToday: boolean
}

/** Last 7 calendar days (oldest → today) with scheduled/done flags. */
export function habitLast7(habit: Habit, todayStr: string): HabitDay[] {
  const logSet = new Set(habit.logs.map(l => l.date))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const ds = localISO(d)
    return { ds, due: isHabitDueOn(habit, d), done: logSet.has(ds), isToday: ds === todayStr }
  })
}
