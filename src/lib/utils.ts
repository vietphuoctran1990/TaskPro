import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Task, SLAStatus, Recurrence } from '../types'
import { localISO } from './dateLocal'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(dateStr: string | null, timeStr: string | null): string {
  if (!dateStr) return ''
  const base = formatDate(dateStr)
  return timeStr ? `${base} ${timeStr}` : base
}

export function getDeadline(task: Task): Date | null {
  if (task.dueDate) {
    const time = task.dueTime ?? '23:59'
    return new Date(`${task.dueDate}T${time}:00`)
  }
  if (task.slaHours != null) {
    return new Date(new Date(task.createdAt).getTime() + task.slaHours * 3600_000)
  }
  return null
}

export function getSLAStatus(task: Task): SLAStatus {
  if (task.status === 'done') return 'completed'
  const deadline = getDeadline(task)
  if (!deadline) return 'none'
  const msLeft = deadline.getTime() - Date.now()
  if (msLeft < 0) return 'breached'
  if (msLeft < 4 * 3600_000) return 'critical'
  if (msLeft < 24 * 3600_000) return 'at_risk'
  return 'on_track'
}

export function getTimeRemaining(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3600_000)
  const m = Math.floor((abs % 3600_000) / 60_000)
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h >= 1) return `${h}h ${m}m`
  return `${m}m`
}

export function isOverdue(dateStr: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false
  const time = timeStr ?? '23:59'
  return new Date(`${dateStr}T${time}:00`) < new Date()
}

export function isDueSoon(dateStr: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false
  const time = timeStr ?? '23:59'
  const due = new Date(`${dateStr}T${time}:00`)
  const now = new Date()
  const diff = due.getTime() - now.getTime()
  return diff >= 0 && diff < 24 * 3600_000
}

/** Compute the next due date for a recurring task */
export function nextRecurringDate(dueDate: string, recurrence: Recurrence): string {
  const [y, m, day] = dueDate.split('-').map(Number)
  const d = new Date(y, m - 1, day) // parse as local midnight, not UTC
  if (recurrence.type === 'daily')   d.setDate(d.getDate() + recurrence.interval)
  if (recurrence.type === 'weekly')  d.setDate(d.getDate() + recurrence.interval * 7)
  if (recurrence.type === 'monthly') d.setMonth(d.getMonth() + recurrence.interval)
  return localISO(d)
}

/** Spawn the next instance of a recurring task (returns null if past endDate) */
export function createNextRecurringTask(task: Task, now: string): Task | null {
  if (!task.recurrence || !task.dueDate) return null
  const nextDue = nextRecurringDate(task.dueDate, task.recurrence)
  if (task.recurrence.endDate && nextDue > task.recurrence.endDate) return null
  return {
    ...task,
    id: generateId(),
    status: 'todo',
    dueDate: nextDue,
    comments: [],
    subtasks: task.subtasks.map(s => ({ ...s, done: false })),
    createdAt: now,
    updatedAt: now,
  }
}

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

export const STATUS_ORDER: Record<string, number> = {
  todo: 0, in_progress: 1, in_review: 2, done: 3,
}

export const SLA_ORDER: Record<SLAStatus, number> = {
  breached: 0, critical: 1, at_risk: 2, on_track: 3, none: 4, completed: 5,
}
