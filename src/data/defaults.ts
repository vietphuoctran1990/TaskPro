import type { Project, Label, Task, StatusDef } from '../types'

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'todo',        name: '', color: '#94a3b8', order: 0, isFinal: false, isBuiltin: true },
  { id: 'in_progress', name: '', color: '#3b82f6', order: 1, isFinal: false, isBuiltin: true },
  { id: 'in_review',   name: '', color: '#8b5cf6', order: 2, isFinal: false, isBuiltin: true },
  { id: 'done',        name: '', color: '#22c55e', order: 3, isFinal: true,  isBuiltin: true },
]

export const DEFAULT_PROJECTS: Project[] = []
export const DEFAULT_LABELS: Label[]  = []
export const DEFAULT_TASKS: Task[]    = []
