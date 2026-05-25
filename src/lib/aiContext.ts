/**
 * Shared helpers for building AI context payloads.
 * Centralises status-name lookup and task ordering so all AI features
 * (chat, briefing, priorities) send consistent, accurate data.
 */
import type { AppState } from '../types'
import { todayLocalISO } from './dateLocal'

// Human-readable names for builtin status IDs (match what the UI shows via i18n)
const BUILTIN_NAME: Record<string, { vi: string; en: string }> = {
  todo:        { vi: 'Cần làm',        en: 'To Do' },
  in_progress: { vi: 'Đang làm',       en: 'In Progress' },
  in_review:   { vi: 'Đang xét duyệt', en: 'In Review' },
  done:        { vi: 'Hoàn thành',     en: 'Done' },
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

/** Return the display name for a status, in the user's language. */
export function statusDisplayName(
  s: { id: string; name: string },
  language: string,
): string {
  if (s.name) return s.name
  const builtin = BUILTIN_NAME[s.id]
  if (builtin) return language === 'vi' ? builtin.vi : builtin.en
  return s.id
}

/** Strip base64 image blobs from note/description text — keep alt text as [ảnh]. */
function stripBase64(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(data:[^)]+\)/g, (_, alt) => `[ảnh${alt ? ': ' + alt : ''}]`)
}

/** Build the full context object to send to /api/ai-chat. */
export function buildAIContext(
  state: AppState,
  finalStatusIds: ReadonlySet<string>,
  maxTasks = 50,
) {
  const today      = todayLocalISO()
  const projMap    = Object.fromEntries(state.projects.map(p => [p.id, p.name]))
  const folderMap  = Object.fromEntries(state.noteFolders.map(f => [f.id, f.name]))
  const lang       = state.language

  // Sort: active (overdue → high-prio → rest) first, then done tasks
  const active = state.tasks
    .filter(t => !finalStatusIds.has(t.status))
    .sort((a, b) => {
      const aOver = a.dueDate && a.dueDate < today ? 0 : 1
      const bOver = b.dueDate && b.dueDate < today ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    })
  const done = state.tasks.filter(t => finalStatusIds.has(t.status))

  const tasks = [...active, ...done].slice(0, maxTasks).map(t => ({
    title:       t.title,
    status:      t.status,
    statusLabel: statusDisplayName(
      { id: t.status, name: state.statuses.find(s => s.id === t.status)?.name ?? '' },
      lang,
    ),
    isDone:      finalStatusIds.has(t.status),
    priority:    t.priority,
    dueDate:     t.dueDate ?? null,
    dueTime:     t.dueTime ?? null,
    projectName: projMap[t.projectId] ?? '',
    // Full description (images stripped); omit field if empty
    description: t.description ? stripBase64(t.description) : undefined,
    // All subtasks with completion status
    subtasks:    t.subtasks.length > 0
      ? t.subtasks.map(s => ({ title: s.title, done: s.done }))
      : undefined,
    // Last 5 comments
    comments:    t.comments.length > 0
      ? t.comments.slice(-5).map(c => ({ text: c.text, at: c.createdAt.slice(0, 10) }))
      : undefined,
    estimatedHours: t.estimatedHours ?? undefined,
  }))

  const statuses = state.statuses.map(s => ({
    id:      s.id,
    name:    statusDisplayName({ id: s.id, name: s.name }, lang),
    isFinal: Boolean(s.isFinal),
  }))

  // Pinned first, then by most recently updated — full content, images stripped
  const notes = [...state.notes]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
    .map(n => ({
      title:     n.title,
      folder:    folderMap[n.folderId] ?? '',
      pinned:    n.pinned,
      content:   stripBase64(n.content),   // full content, no length truncation
      updatedAt: n.updatedAt.slice(0, 10),
      createdAt: n.createdAt.slice(0, 10),
    }))

  return {
    today,
    language:       lang,
    finalStatusIds: [...finalStatusIds],
    statuses,
    projects:       state.projects.map(p => ({ id: p.id, name: p.name })),
    tasks,
    notes,
    noteFolders:    state.noteFolders.map(f => ({ id: f.id, name: f.name })),
  }
}
