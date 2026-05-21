export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Status = string           // 'todo' | 'in_progress' | 'in_review' | 'done' or any custom id
export type ViewMode = 'dashboard' | 'kanban' | 'list' | 'calendar' | 'timeline' | 'notes'
export type SortField = 'title' | 'priority' | 'status' | 'dueDate' | 'sla' | 'createdAt'
export type SortDir = 'asc' | 'desc'

export interface StatusDef {
  id: string
  name: string       // User-set label; '' = fall back to i18n for built-in statuses
  color: string      // Hex color for column dot/header accent
  order: number      // Column display order (ascending)
  isFinal: boolean   // True → task counts as "done" (SLA completed, progress, recurring spawn)
  isBuiltin: boolean // True → cannot be deleted; id is stable ('todo','in_progress','in_review','done')
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Comment {
  id: string
  text: string
  createdAt: string
}

export interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly'
  interval: number
  endDate?: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: Status
  priority: Priority
  labels: string[]
  subtasks: Subtask[]
  comments: Comment[]
  dueDate: string | null
  dueTime: string | null
  slaHours: number | null
  estimatedHours: number | null
  recurrence: Recurrence | null
  createdAt: string
  updatedAt: string
  projectId: string
  isNote: boolean
  pinned?: boolean
}

export type Density = 'compact' | 'comfortable' | 'spacious'
export type DarkModeMode = 'manual' | 'system'

export interface Project {
  id: string
  name: string
  color: string
  description: string
  notes: string
}

export interface NoteFolder {
  id: string
  name: string
  color: string
}

export interface Note {
  id: string
  title: string
  content: string
  folderId: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export type DateFilter = 'all' | 'today' | 'tomorrow' | 'upcoming'

export interface DeletedIds {
  tasks:       Record<string, number>
  projects:    Record<string, number>
  labels:      Record<string, number>
  notes:       Record<string, number>
  noteFolders: Record<string, number>
  statuses:    Record<string, number>
}

export interface AppState {
  tasks: Task[]
  projects: Project[]
  labels: Label[]
  statuses: StatusDef[]
  notes: Note[]
  noteFolders: NoteFolder[]
  activeProjectId: string | null
  activeNoteFolderId: string | null
  searchQuery: string
  filterPriority: Priority | 'all'
  filterStatus: Status | 'all'
  filterSLA: SLAStatus | 'all'
  dateFilter: DateFilter
  viewMode: ViewMode
  sortField: SortField
  sortDir: SortDir
  darkMode: boolean
  darkModeMode: DarkModeMode
  density: Density
  language: 'en' | 'vi'
  notifBefore: number[]
  _deletedIds?: DeletedIds
}

export type SLAStatus = 'on_track' | 'at_risk' | 'critical' | 'breached' | 'completed' | 'none'
