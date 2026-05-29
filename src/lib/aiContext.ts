/**
 * Shared helpers for building AI context payloads.
 * Centralises status-name lookup and task ordering so all AI features
 * (chat, briefing, priorities) send consistent, accurate data.
 */
import type { AppState } from '../types'
import { todayLocalISO } from './dateLocal'

const BUILTIN_NAME: Record<string, { vi: string; en: string }> = {
  todo:        { vi: 'Cần làm',        en: 'To Do' },
  in_progress: { vi: 'Đang làm',       en: 'In Progress' },
  in_review:   { vi: 'Đang xét duyệt', en: 'In Review' },
  done:        { vi: 'Hoàn thành',     en: 'Done' },
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

export function statusDisplayName(
  s: { id: string; name: string },
  language: string,
): string {
  if (s.name) return s.name
  const builtin = BUILTIN_NAME[s.id]
  if (builtin) return language === 'vi' ? builtin.vi : builtin.en
  return s.id
}

/** Remove base64 image blobs; keep readable alt text. */
function stripBase64(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(data:[^)]+\)/g, (_, alt) => `[ảnh${alt ? ': ' + alt : ''}]`)
}

/** Build the context object sent to /api/ai-chat. */
export function buildAIContext(
  state: AppState,
  finalStatusIds: ReadonlySet<string>,
  maxTasks = 50,
) {
  const today      = todayLocalISO()
  const projMap    = Object.fromEntries(state.projects.map(p => [p.id, p.name]))
  const folderMap  = Object.fromEntries(state.noteFolders.map(f => [f.id, f.name]))
  const lang       = state.language

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
    // Description: full text, images stripped, max 400 chars
    description: t.description
      ? stripBase64(t.description).slice(0, 400)
      : undefined,
    // All subtasks (usually short)
    subtasks: t.subtasks && t.subtasks.length > 0
      ? t.subtasks.map(s => ({ title: s.title, done: s.done }))
      : undefined,
    // Last 3 comments
    comments: t.comments && t.comments.length > 0
      ? t.comments.slice(-3).map(c => ({ text: c.text, at: c.createdAt.slice(0, 10) }))
      : undefined,
    estimatedHours: t.estimatedHours ?? undefined,
  }))

  const statuses = state.statuses.map(s => ({
    id:      s.id,
    name:    statusDisplayName({ id: s.id, name: s.name }, lang),
    isFinal: Boolean(s.isFinal),
  }))

  // Max 20 notes, pinned first, full content limited to 3000 chars each
  const notes = [...state.notes]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20)
    .map(n => ({
      title:     n.title,
      folder:    folderMap[n.folderId] ?? '',
      pinned:    n.pinned,
      content:   stripBase64(n.content).slice(0, 3000),
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
