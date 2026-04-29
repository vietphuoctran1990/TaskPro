export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type ViewMode = 'kanban' | 'list' | 'calendar'
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
  createdAt: string
  updatedAt: string
  projectId: string
}

export interface Project {
  id: string
  name: string
  color: string
  description: string
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
}

export type SLAStatus = 'on_track' | 'at_risk' | 'critical' | 'breached' | 'completed' | 'none'
