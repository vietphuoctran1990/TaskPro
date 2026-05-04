import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type {
  AppState, Task, Project, Label, Priority, Status, ViewMode, SortField, SortDir, SLAStatus, Comment,
} from '../types'
import { DEFAULT_PROJECTS, DEFAULT_LABELS, DEFAULT_TASKS } from '../data/defaults'
import {
  generateId, getSLAStatus, PRIORITY_ORDER, STATUS_ORDER, SLA_ORDER,
  getDeadline, createNextRecurringTask,
} from '../lib/utils'

type Action =
  | { type: 'ADD_TASK';        payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TASK';     payload: Partial<Task> & { id: string } }
  | { type: 'DELETE_TASK';     payload: string }
  | { type: 'MOVE_TASK';       payload: { id: string; status: Status } }
  | { type: 'REORDER_TASKS';   payload: Task[] }
  | { type: 'ADD_COMMENT';     payload: { taskId: string; comment: Omit<Comment, 'id' | 'createdAt'> } }
  | { type: 'ADD_PROJECT';     payload: Omit<Project, 'id'> & { id?: string } }
  | { type: 'UPDATE_PROJECT';  payload: Project }
  | { type: 'DELETE_PROJECT';  payload: string }
  | { type: 'ADD_LABEL';       payload: Omit<Label, 'id'> & { id?: string } }
  | { type: 'UPDATE_LABEL';    payload: Label }
  | { type: 'DELETE_LABEL';    payload: string }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string | null }
  | { type: 'SET_SEARCH';      payload: string }
  | { type: 'SET_FILTER_PRIORITY'; payload: Priority | 'all' }
  | { type: 'SET_FILTER_STATUS';   payload: Status | 'all' }
  | { type: 'SET_FILTER_SLA';      payload: SLAStatus | 'all' }
  | { type: 'SET_VIEW_MODE';   payload: ViewMode }
  | { type: 'SET_SORT';        payload: { field: SortField; dir: SortDir } }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_LANGUAGE';    payload: 'en' | 'vi' }
  | { type: 'SET_NOTIF_BEFORE'; payload: number[] }
  | { type: 'IMPORT_STATE';    payload: { data: AppState; mode: 'replace' | 'merge' } }

const STORAGE_KEY = 'taskpro_v2_state'

function getInitialState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as AppState
      return {
        ...parsed,
        tasks: parsed.tasks.map(t => ({
          ...t,
          comments:       t.comments       ?? [],
          dueTime:        t.dueTime        ?? null,
          slaHours:       t.slaHours       ?? null,
          estimatedHours: t.estimatedHours ?? null,
          recurrence:     t.recurrence     ?? null,
        })),
        filterSLA:   parsed.filterSLA   ?? 'all',
        viewMode:    parsed.viewMode    ?? 'kanban',
        sortField:   parsed.sortField   ?? 'createdAt',
        sortDir:     parsed.sortDir     ?? 'desc',
        darkMode:    false,
        language:    parsed.language    ?? 'vi',
        notifBefore: parsed.notifBefore ?? [15, 30, 60],
      }
    }
  } catch {}
  return {
    tasks: DEFAULT_TASKS,
    projects: DEFAULT_PROJECTS,
    labels: DEFAULT_LABELS,
    activeProjectId: null,
    searchQuery: '',
    filterPriority: 'all',
    filterStatus: 'all',
    filterSLA: 'all',
    viewMode: 'kanban',
    sortField: 'createdAt',
    sortDir: 'desc',
    darkMode: false,
    language: 'vi',
    notifBefore: [15, 30, 60],
  }
}

function reducer(state: AppState, action: Action): AppState {
  const now = new Date().toISOString()
  switch (action.type) {
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [...state.tasks, { ...action.payload, id: generateId(), createdAt: now, updatedAt: now }],
      }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload, updatedAt: now } : t
        ),
      }
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) }
    case 'MOVE_TASK': {
      const task = state.tasks.find(t => t.id === action.payload.id)
      const updatedTasks = state.tasks.map(t =>
        t.id === action.payload.id ? { ...t, status: action.payload.status, updatedAt: now } : t
      )
      // Auto-spawn next occurrence when marking a recurring task done
      if (action.payload.status === 'done' && task?.recurrence) {
        const next = createNextRecurringTask(task, now)
        if (next) return { ...state, tasks: [...updatedTasks, next] }
      }
      return { ...state, tasks: updatedTasks }
    }
    case 'REORDER_TASKS':
      return { ...state, tasks: action.payload }
    case 'ADD_COMMENT':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.taskId
            ? { ...t, comments: [...t.comments, { ...action.payload.comment, id: generateId(), createdAt: now }], updatedAt: now }
            : t
        ),
      }
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, { ...action.payload, id: action.payload.id ?? generateId() }] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        tasks: state.tasks.map(t => t.projectId === action.payload ? { ...t, projectId: '' } : t),
        activeProjectId: state.activeProjectId === action.payload ? null : state.activeProjectId,
      }
    case 'ADD_LABEL':
      return { ...state, labels: [...state.labels, { ...action.payload, id: action.payload.id ?? generateId() }] }
    case 'UPDATE_LABEL':
      return { ...state, labels: state.labels.map(l => l.id === action.payload.id ? action.payload : l) }
    case 'DELETE_LABEL':
      return {
        ...state,
        labels: state.labels.filter(l => l.id !== action.payload),
        tasks: state.tasks.map(t => ({ ...t, labels: t.labels.filter(lid => lid !== action.payload) })),
      }
    case 'SET_ACTIVE_PROJECT':  return { ...state, activeProjectId: action.payload }
    case 'SET_SEARCH':          return { ...state, searchQuery: action.payload }
    case 'SET_FILTER_PRIORITY': return { ...state, filterPriority: action.payload }
    case 'SET_FILTER_STATUS':   return { ...state, filterStatus: action.payload }
    case 'SET_FILTER_SLA':      return { ...state, filterSLA: action.payload }
    case 'SET_VIEW_MODE':       return { ...state, viewMode: action.payload }
    case 'SET_SORT':            return { ...state, sortField: action.payload.field, sortDir: action.payload.dir }
    case 'TOGGLE_DARK_MODE':    return { ...state, darkMode: !state.darkMode }
    case 'SET_LANGUAGE':        return { ...state, language: action.payload }
    case 'SET_NOTIF_BEFORE':    return { ...state, notifBefore: action.payload }
    case 'IMPORT_STATE': {
      const { data, mode } = action.payload
      if (mode === 'replace') {
        return { ...data, darkMode: state.darkMode, language: state.language }
      }
      // merge: add items that don't already exist by id
      const existIds = new Set(state.tasks.map(t => t.id))
      const existPIds = new Set(state.projects.map(p => p.id))
      const existLIds = new Set(state.labels.map(l => l.id))
      return {
        ...state,
        tasks:    [...state.tasks,    ...data.tasks.filter(t => !existIds.has(t.id))],
        projects: [...state.projects, ...data.projects.filter(p => !existPIds.has(p.id))],
        labels:   [...state.labels,   ...data.labels.filter(l => !existLIds.has(l.id))],
      }
    }
    default:
      return state
  }
}

interface ContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  filteredTasks: Task[]
}

const AppContext = createContext<ContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  const filteredTasks = useMemo(() => {
    let tasks = state.tasks
    if (state.activeProjectId)      tasks = tasks.filter(t => t.projectId === state.activeProjectId)
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase()
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    }
    if (state.filterPriority !== 'all') tasks = tasks.filter(t => t.priority === state.filterPriority)
    if (state.filterStatus   !== 'all') tasks = tasks.filter(t => t.status   === state.filterStatus)
    if (state.filterSLA      !== 'all') tasks = tasks.filter(t => getSLAStatus(t) === state.filterSLA)

    return [...tasks].sort((a, b) => {
      const dir = state.sortDir === 'asc' ? 1 : -1
      switch (state.sortField) {
        case 'title':    return dir * a.title.localeCompare(b.title)
        case 'priority': return dir * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        case 'status':   return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
        case 'dueDate': {
          const da = getDeadline(a)?.getTime() ?? Infinity
          const db = getDeadline(b)?.getTime() ?? Infinity
          return dir * (da - db)
        }
        case 'sla':      return dir * (SLA_ORDER[getSLAStatus(a)] - SLA_ORDER[getSLAStatus(b)])
        default:         return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    })
  }, [state.tasks, state.activeProjectId, state.searchQuery,
      state.filterPriority, state.filterStatus, state.filterSLA,
      state.sortField, state.sortDir])

  return (
    <AppContext.Provider value={{ state, dispatch, filteredTasks }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
