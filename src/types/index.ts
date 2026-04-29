export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'

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

export interface Task {
  id: string
  title: string
  description: string
  status: Status
  priority: Priority
  labels: string[]
  subtasks: Subtask[]
  dueDate: string | null
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
  darkMode: boolean
}
