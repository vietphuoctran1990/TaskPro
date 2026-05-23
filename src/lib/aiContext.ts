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
  if (s.name) return s.name                                    // user-set custom name
  const builtin = BUILTIN_NAME[s.id]
  if (builtin) return language === 'vi' ? builtin.vi : builtin.en
  return s.id
}

/** Strip base64 image data from note content for AI context (too large to send). */
function noteSnippet(content: string, maxLen = 200): string {
  return content
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

/** Build the full context object to send to /api/ai-chat. */
export function buildAIContext(
  state: AppState,
  finalStatusIds: ReadonlySet<string>,
  maxTasks = 30,
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
    title:          t.title,
    status:         t.status,
    statusLabel:    statusDisplayName(
      { id: t.status, name: state.statuses.find(s => s.id === t.status)?.name ?? '' },
      lang,
    ),
    isDone:         finalStatusIds.has(t.status),
    priority:       t.priority,
    dueDate:        t.dueDate ?? null,
    projectName:    projMap[t.projectId] ?? '',
    description:    t.description ? t.description.replace(/\n+/g, ' ').slice(0, 120) : undefined,
    subtasksCount:  t.subtasks.length || undefined,
  }))

  const statuses = state.statuses.map(s => ({
    id:      s.id,
    name:    statusDisplayName({ id: s.id, name: s.name }, lang),
    isFinal: Boolean(s.isFinal),
  }))

  // Pinned first, then by most recently updated, max 15 notes
  const notes = [...state.notes]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 15)
    .map(n => ({
      title:     n.title,
      folder:    folderMap[n.folderId] ?? '',
      pinned:    n.pinned,
      snippet:   noteSnippet(n.content),
      updatedAt: n.updatedAt.slice(0, 10),
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
