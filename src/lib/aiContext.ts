import type { AppState, Task, Project, Label, StatusDef, Note, NoteFolder, Subtask, Comment, Habit } from '../types'
import { todayLocalISO } from './dateLocal'
import { habitStreak, habitLast7, isHabitDueOn, isHabitDoneOn } from './habits'

export function buildAIContext(state: AppState, finalStatusIds: ReadonlySet<string>) {
  // Local-date based (matches how dueDate / habit logs are stored across the app).
  const today = todayLocalISO()
  const now = new Date()

  const labelMap = new Map(state.labels.map((l: Label) => [l.id, l.name]))
  const projectMap = new Map(state.projects.map((p: Project) => [p.id, p.name]))
  const statusMap = new Map(state.statuses.map((s: StatusDef) => [s.id, s.name || s.id]))

  return {
    today,
    language: state.language,

    tasks: state.tasks
      .filter((t: Task) => !t.isNote)
      .map((t: Task) => ({
        id:             t.id,
        title:          t.title,
        description:    t.description || undefined,
        status:         t.status,
        statusLabel:    statusMap.get(t.status) || t.status,
        isDone:         finalStatusIds.has(t.status),
        priority:       t.priority,
        projectId:      t.projectId || undefined,
        projectName:    t.projectId ? projectMap.get(t.projectId) : undefined,
        labels:         t.labels.map((id: string) => labelMap.get(id)).filter(Boolean) as string[],
        dueDate:        t.dueDate || undefined,
        dueTime:        t.dueTime || undefined,
        estimatedHours: t.estimatedHours || undefined,
        slaHours:       t.slaHours || undefined,
        subtasks:       t.subtasks.length > 0 ? t.subtasks.map((s: Subtask) => ({ title: s.title, done: s.done })) : undefined,
        comments:       t.comments.length > 0 ? t.comments.map((c: Comment) => ({ text: c.text, at: c.createdAt.slice(0, 10) })) : undefined,
        recurrence:     t.recurrence ? `${t.recurrence.type} mỗi ${t.recurrence.interval}` : undefined,
        createdAt:      t.createdAt.slice(0, 10),
        updatedAt:      t.updatedAt.slice(0, 10),
        pinned:         t.pinned || undefined,
      })),

    projects: state.projects.map((p: Project) => ({
      id:          p.id,
      name:        p.name,
      description: p.description || undefined,
      taskCount:   state.tasks.filter((t: Task) => t.projectId === p.id && !t.isNote).length,
    })),

    statuses: state.statuses
      .slice().sort((a: StatusDef, b: StatusDef) => a.order - b.order)
      .map((s: StatusDef) => ({
        id:      s.id,
        name:    s.name || s.id,
        isFinal: s.isFinal,
        color:   s.color,
      })),

    labels: state.labels.map((l: Label) => ({ id: l.id, name: l.name })),

    notes: state.notes.map((n: Note) => ({
      id:        n.id,
      title:     n.title,
      content:   n.content
        .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[ảnh]')
        .slice(0, 3000),
      folder:    n.folderId ? state.noteFolders.find((f: NoteFolder) => f.id === n.folderId)?.name : undefined,
      pinned:    n.pinned || undefined,
      updatedAt: n.updatedAt.slice(0, 10),
    })),

    noteFolders: state.noteFolders.map((f: NoteFolder) => ({ id: f.id, name: f.name })),

    habits: (state.habits ?? []).map((h: Habit) => {
      const last7 = habitLast7(h, today)
      return {
        title:            h.title,
        emoji:            h.emoji,
        description:      h.description || undefined,
        frequency:        h.frequency,
        dueToday:         isHabitDueOn(h, now),
        doneToday:        isHabitDoneOn(h, today),
        streak:           habitStreak(h, today),
        totalCompletions: h.logs.length,
        last7Done:        last7.filter(d => d.done).length,
        last7Due:         last7.filter(d => d.due).length,
      }
    }),

    finalStatusIds: [...finalStatusIds],
  }
}
