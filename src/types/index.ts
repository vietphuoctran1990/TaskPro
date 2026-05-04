export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type ViewMode = 'dashboard' | 'kanban' | 'list' | 'calendar'
export type SortField = 'title' | 'priority' | 'status' | 'dueDate' | 'sla' | 'createdAt'
export type SortDir = 'asc' | 'desc'

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
  interval: number        // every N days/weeks/months
  endDate?: string        // "YYYY-MM-DD" optional
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
  dueDate: string | null        // "YYYY-MM-DD"
  dueTime: string | null        // "HH:MM" — specific SLA time
  slaHours: number | null       // max resolution time (hours from creation)
  estimatedHours: number | null // estimated effort
  recurrence: Recurrence | null
  createdAt: string
  updatedAt: string
  projectId: string
}

export interface Project {
  id: string
  name: string
  color: string
  description: string
  notes: string
}

export interface AppState {
  tasks: Task[]
  projects: Project[]
  labels: Label[]
  activeProjectId: string | null
  searchQuery: string
  filterPriority: Priority | 'all'
  filterStatus: Status | 'all'
  filterSLA: SLAStatus | 'all'
  viewMode: ViewMode
  sortField: SortField
  sortDir: SortDir
  darkMode: boolean
  language: 'en' | 'vi'
  notifBefore: number[]
}

export type SLAStatus = 'on_track' | 'at_risk' | 'critical' | 'breached' | 'completed' | 'none'
