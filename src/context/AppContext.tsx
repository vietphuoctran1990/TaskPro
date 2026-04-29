import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type { AppState, Task, Project, Priority, Status } from '../types'
import { DEFAULT_PROJECTS, DEFAULT_LABELS, DEFAULT_TASKS } from '../data/defaults'
import { generateId } from '../lib/utils'

type Action =
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'MOVE_TASK'; payload: { id: string; status: Status } }
  | { type: 'REORDER_TASKS'; payload: Task[] }
  | { type: 'ADD_PROJECT'; payload: Omit<Project, 'id'> }
  | { type: 'SET_ACTIVE_PROJECT'; payload: string | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER_PRIORITY'; payload: Priority | 'all' }
  | { type: 'SET_FILTER_STATUS'; payload: Status | 'all' }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'LOAD_STATE'; payload: AppState }

const STORAGE_KEY = 'taskpro_state'

function getInitialState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {
    tasks: DEFAULT_TASKS,
    projects: DEFAULT_PROJECTS,
    labels: DEFAULT_LABELS,
    activeProjectId: null,
    searchQuery: '',
    filterPriority: 'all',
    filterStatus: 'all',
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  }
}

function reducer(state: AppState, action: Action): AppState {
  const now = new Date().toISOString()
  switch (action.type) {
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { ...action.payload, id: generateId(), createdAt: now, updatedAt: now },
        ],
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
    case 'MOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload.id
            ? { ...t, status: action.payload.status, updatedAt: now }
            : t
        ),
      }
    case 'REORDER_TASKS':
      return { ...state, tasks: action.payload }
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [...state.projects, { ...action.payload, id: generateId() }],
      }
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.payload }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload }
    case 'SET_FILTER_PRIORITY':
      return { ...state, filterPriority: action.payload }
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload }
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode }
    case 'LOAD_STATE':
      return action.payload
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.darkMode])

  const filteredTasks = useMemo(() => {
    let tasks = state.tasks
    if (state.activeProjectId) {
      tasks = tasks.filter(t => t.projectId === state.activeProjectId)
    }
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase()
      tasks = tasks.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    }
    if (state.filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === state.filterPriority)
    }
    if (state.filterStatus !== 'all') {
      tasks = tasks.filter(t => t.status === state.filterStatus)
    }
    return tasks
  }, [state.tasks, state.activeProjectId, state.searchQuery, state.filterPriority, state.filterStatus])

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
