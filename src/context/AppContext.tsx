import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type {
  AppState, Task, Project, Label, Note, NoteFolder, Priority, Status, ViewMode,
  SortField, SortDir, SLAStatus, Comment, DateFilter, Density, DarkModeMode, StatusDef, DeletedIds, TaskTemplate,
} from '../types'
import { DEFAULT_PROJECTS, DEFAULT_LABELS, DEFAULT_TASKS, DEFAULT_STATUSES, DEFAULT_TEMPLATES } from '../data/defaults'
import {
  generateId, getSLAStatus, PRIORITY_ORDER, SLA_ORDER,
  getDeadline, createNextRecurringTask, buildStatusOrder,
} from '../lib/utils'
import { todayLocalISO, tomorrowLocalISO } from '../lib/dateLocal'

type Action =
  | { type: 'ADD_TASK';        payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TASK';     payload: Partial<Task> & { id: string } }
  | { type: 'DELETE_TASK';     payload: string }
  | { type: 'RESTORE_TASK';    payload: Task }
  | { type: 'RESTORE_NOTE';    payload: Note }
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
  | { type: 'SET_FILTER_LABEL';    payload: string | 'all' }
  | { type: 'SET_DATE_FILTER';     payload: DateFilter }
  | { type: 'SET_VIEW_MODE';   payload: ViewMode }
  | { type: 'SET_SORT';        payload: { field: SortField; dir: SortDir } }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_DARK_MODE';      payload: { mode: DarkModeMode; value?: boolean } }
  | { type: 'SET_DENSITY';        payload: Density }
  | { type: 'TOGGLE_PIN_TASK';    payload: string }
  | { type: 'SET_LANGUAGE';    payload: 'en' | 'vi' }
  | { type: 'SET_NOTIF_BEFORE'; payload: number[] }
  | { type: 'ADD_STATUS';       payload: Omit<StatusDef, 'id' | 'isBuiltin'> }
  | { type: 'UPDATE_STATUS';    payload: StatusDef }
  | { type: 'DELETE_STATUS';    payload: { id: string; moveTo: string } }
  | { type: 'REORDER_STATUSES'; payload: string[] }
  | { type: 'IMPORT_STATE';    payload: { data: AppState; mode: 'replace' | 'merge' } }
  | { type: 'ADD_NOTE';           payload: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } }
  | { type: 'UPDATE_NOTE';        payload: Partial<Note> & { id: string } }
  | { type: 'DELETE_NOTE';        payload: string }
  | { type: 'ADD_NOTE_FOLDER';    payload: Omit<NoteFolder, 'id'> }
  | { type: 'UPDATE_NOTE_FOLDER'; payload: NoteFolder }
  | { type: 'DELETE_NOTE_FOLDER'; payload: string }
  | { type: 'SET_ACTIVE_NOTE_FOLDER'; payload: string | null }
  | { type: 'ADD_TEMPLATE';    payload: Omit<TaskTemplate, 'id'> }
  | { type: 'UPDATE_TEMPLATE'; payload: TaskTemplate }
  | { type: 'DELETE_TEMPLATE'; payload: string }

const STORAGE_KEY = 'taskpro_v2_state'
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function tombstone(ids: AppState['_deletedIds'], key: keyof DeletedIds, id: string): DeletedIds {
  const now = Date.now()
  const base: DeletedIds = { tasks: {}, projects: {}, labels: {}, notes: {}, noteFolders: {}, statuses: {}, ...(ids ?? {}) }
  return { ...base, [key]: { ...base[key], [id]: now } }
}

function pruneTombstones(ids: AppState['_deletedIds']): AppState['_deletedIds'] {
  if (!ids) return ids
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  const prune = (rec: Record<string, number>) =>
    Object.fromEntries(Object.entries(rec).filter(([, ts]) => ts > cutoff))
  return { tasks: prune(ids.tasks), projects: prune(ids.projects), labels: prune(ids.labels),
           notes: prune(ids.notes), noteFolders: prune(ids.noteFolders), statuses: prune(ids.statuses) }
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getInitialState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(saved) as any
      const darkModeMode = parsed.darkModeMode ?? 'system'
      const initialDark = darkModeMode === 'system' ? systemPrefersDark() : (parsed.darkMode ?? false)

      // Migrate old columnLabels into StatusDef.name
      const legacyLabels: Record<string, string> = parsed.columnLabels ?? {}
      const rawStatuses: StatusDef[] = parsed.statuses ?? DEFAULT_STATUSES
      // Migrate: ensure isFinal is always boolean — old data may lack this field.
      // 'done' is the only builtin status that defaults to isFinal=true.
      const statuses = rawStatuses.map((s: StatusDef) => ({
        ...s,
        name:     s.name || legacyLabels[s.id] || '',
        isFinal:  (s.isFinal != null) ? Boolean(s.isFinal) : (s.id === 'done'),
        wipLimit: s.wipLimit ?? null,
      }))

      return {
        ...parsed,
        statuses,
        tasks: (parsed.tasks ?? []).map((t: Task) => ({
          ...t,
          comments:       t.comments       ?? [],
          dueTime:        t.dueTime        ?? null,
          slaHours:       t.slaHours       ?? null,
          estimatedHours: t.estimatedHours ?? null,
          recurrence:     t.recurrence     ?? null,
          isNote:         t.isNote         ?? false,
          pinned:         t.pinned         ?? false,
        })),
        notes:              parsed.notes              ?? [],
        noteFolders:        parsed.noteFolders        ?? [],
        activeNoteFolderId: parsed.activeNoteFolderId ?? null,
        filterSLA:    parsed.filterSLA    ?? 'all',
        filterLabel:  parsed.filterLabel  ?? 'all',
        dateFilter:   parsed.dateFilter   ?? 'all',
        viewMode:     parsed.viewMode     ?? 'kanban',
        // Migrate old default (createdAt desc) → new default (dueDate asc)
        sortField:    (parsed.sortField === 'createdAt' && parsed.sortDir === 'desc')
                        ? 'dueDate'
                        : (parsed.sortField ?? 'dueDate'),
        sortDir:      (parsed.sortField === 'createdAt' && parsed.sortDir === 'desc')
                        ? 'asc'
                        : (parsed.sortDir ?? 'asc'),
        darkMode:     initialDark,
        darkModeMode,
        density:      parsed.density      ?? 'comfortable',
        language:     parsed.language     ?? 'vi',
        notifBefore:  parsed.notifBefore  ?? [15, 30, 60],
        templates:    parsed.templates    ?? DEFAULT_TEMPLATES,
        _deletedIds:  pruneTombstones(parsed._deletedIds),
      }
    }
  } catch {}
  return {
    tasks: DEFAULT_TASKS,
    projects: DEFAULT_PROJECTS,
    labels: DEFAULT_LABELS,
    statuses: DEFAULT_STATUSES,
    notes: [],
    noteFolders: [],
    activeProjectId: null,
    activeNoteFolderId: null,
    searchQuery: '',
    filterPriority: 'all',
    filterStatus: 'all',
    filterSLA: 'all',
    filterLabel: 'all',
    dateFilter: 'all',
    viewMode: 'kanban',
    sortField: 'dueDate',
    sortDir: 'asc',
    darkMode: systemPrefersDark(),
    darkModeMode: 'system',
    density: 'comfortable',
    language: 'vi',
    notifBefore: [15, 30, 60],
    templates: DEFAULT_TEMPLATES,
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
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload), _deletedIds: tombstone(state._deletedIds, 'tasks', action.payload) }
    case 'RESTORE_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] }
    case 'RESTORE_NOTE':
      return { ...state, notes: [...state.notes, action.payload] }
    case 'MOVE_TASK': {
      const task = state.tasks.find(t => t.id === action.payload.id)
      const targetDef = state.statuses.find(s => s.id === action.payload.status)
      const updatedTasks = state.tasks.map(t =>
        t.id === action.payload.id ? { ...t, status: action.payload.status, updatedAt: now } : t
      )
      // Auto-spawn next occurrence when moving to a final status
      if (targetDef?.isFinal && task?.recurrence) {
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
        _deletedIds: tombstone(state._deletedIds, 'projects', action.payload),
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
        _deletedIds: tombstone(state._deletedIds, 'labels', action.payload),
      }
    case 'SET_ACTIVE_PROJECT':  return { ...state, activeProjectId: action.payload }
    case 'SET_SEARCH':          return { ...state, searchQuery: action.payload }
    case 'SET_FILTER_PRIORITY': return { ...state, filterPriority: action.payload }
    case 'SET_FILTER_STATUS':   return { ...state, filterStatus: action.payload }
    case 'SET_FILTER_SLA':      return { ...state, filterSLA: action.payload }
    case 'SET_FILTER_LABEL':    return { ...state, filterLabel: action.payload }
    case 'SET_DATE_FILTER':     return { ...state, dateFilter: action.payload }
    case 'SET_VIEW_MODE':       return { ...state, viewMode: action.payload }
    case 'SET_SORT':            return { ...state, sortField: action.payload.field, sortDir: action.payload.dir }
    case 'TOGGLE_DARK_MODE':    return { ...state, darkMode: !state.darkMode, darkModeMode: 'manual' }
    case 'SET_DARK_MODE': {
      const { mode, value } = action.payload
      if (mode === 'system') {
        return { ...state, darkModeMode: 'system', darkMode: value !== undefined ? value : systemPrefersDark() }
      }
      return { ...state, darkModeMode: 'manual', darkMode: value ?? state.darkMode }
    }
    case 'SET_DENSITY':         return { ...state, density: action.payload }
    case 'TOGGLE_PIN_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.payload ? { ...t, pinned: !t.pinned, updatedAt: now } : t),
      }
    case 'SET_LANGUAGE':        return { ...state, language: action.payload }
    case 'SET_NOTIF_BEFORE':    return { ...state, notifBefore: action.payload }
    case 'ADD_STATUS': {
      const maxOrder = Math.max(0, ...state.statuses.map(s => s.order))
      return {
        ...state,
        statuses: [...state.statuses, { ...action.payload, id: generateId(), isBuiltin: false, order: maxOrder + 1 }],
      }
    }
    case 'UPDATE_STATUS':
      return { ...state, statuses: state.statuses.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'DELETE_STATUS': {
      const { id, moveTo } = action.payload
      return {
        ...state,
        statuses: state.statuses.filter(s => s.id !== id),
        tasks:    state.tasks.map(t => t.status === id ? { ...t, status: moveTo, updatedAt: now } : t),
        _deletedIds: tombstone(state._deletedIds, 'statuses', id),
      }
    }
    case 'REORDER_STATUSES': {
      const ids = action.payload
      return {
        ...state,
        statuses: state.statuses.map(s => ({ ...s, order: ids.indexOf(s.id) })),
      }
    }
    case 'ADD_NOTE':
      return {
        ...state,
        notes: [...state.notes, { ...action.payload, id: action.payload.id ?? generateId(), createdAt: now, updatedAt: now }],
      }
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(n => n.id === action.payload.id ? { ...n, ...action.payload, updatedAt: now } : n),
      }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.payload), _deletedIds: tombstone(state._deletedIds, 'notes', action.payload) }
    case 'ADD_NOTE_FOLDER':
      return { ...state, noteFolders: [...state.noteFolders, { ...action.payload, id: generateId() }] }
    case 'UPDATE_NOTE_FOLDER':
      return { ...state, noteFolders: state.noteFolders.map(f => f.id === action.payload.id ? action.payload : f) }
    case 'DELETE_NOTE_FOLDER':
      return {
        ...state,
        noteFolders: state.noteFolders.filter(f => f.id !== action.payload),
        notes: state.notes.map(n => n.folderId === action.payload ? { ...n, folderId: '' } : n),
        activeNoteFolderId: state.activeNoteFolderId === action.payload ? null : state.activeNoteFolderId,
        _deletedIds: tombstone(state._deletedIds, 'noteFolders', action.payload),
      }
    case 'SET_ACTIVE_NOTE_FOLDER':
      return { ...state, activeNoteFolderId: action.payload }
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...(state.templates ?? []), { ...action.payload, id: generateId() }] }
    case 'UPDATE_TEMPLATE':
      return { ...state, templates: (state.templates ?? []).map(tp => tp.id === action.payload.id ? action.payload : tp) }
    case 'DELETE_TEMPLATE':
      return { ...state, templates: (state.templates ?? []).filter(tp => tp.id !== action.payload) }
    case 'IMPORT_STATE': {
      const { data, mode } = action.payload
      if (mode === 'replace') {
        return { ...data, darkMode: state.darkMode, language: state.language }
      }
      // merge: add items that don't already exist by id
      const existIds = new Set(state.tasks.map(t => t.id))
      const existPIds = new Set(state.projects.map(p => p.id))
      const existLIds = new Set(state.labels.map(l => l.id))
      const existNIds = new Set(state.notes.map(n => n.id))
      const existNFIds = new Set(state.noteFolders.map(f => f.id))
      return {
        ...state,
        tasks:       [...state.tasks,       ...data.tasks.filter(t => !existIds.has(t.id))],
        projects:    [...state.projects,    ...data.projects.filter(p => !existPIds.has(p.id))],
        labels:      [...state.labels,      ...data.labels.filter(l => !existLIds.has(l.id))],
        notes:       [...state.notes,       ...(data.notes ?? []).filter(n => !existNIds.has(n.id))],
        noteFolders: [...state.noteFolders, ...(data.noteFolders ?? []).filter(f => !existNFIds.has(f.id))],
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
  finalStatusIds: ReadonlySet<string>
  /** First non-final status id (column tasks start in). Falls back to 'todo'. */
  firstStatusId: string
  /** First final status id (where "mark done" sends a task). Falls back to 'done'. */
  finalStatusId: string
}

const AppContext = createContext<ContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  // Listen to system theme changes when in "system" mode
  useEffect(() => {
    if (state.darkModeMode !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      dispatch({ type: 'SET_DARK_MODE', payload: { mode: 'system', value: e.matches } })
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [state.darkModeMode])

  const finalStatusIds = useMemo(
    () => new Set(state.statuses.filter(s => s.isFinal).map(s => s.id)),
    [state.statuses]
  )

  // Derived once here so views/cards don't each recompute the same find().
  const { firstStatusId, finalStatusId } = useMemo(() => {
    const ordered = [...state.statuses].sort((a, b) => a.order - b.order)
    return {
      firstStatusId: ordered.find(s => !s.isFinal)?.id ?? 'todo',
      finalStatusId: ordered.find(s => s.isFinal)?.id ?? 'done',
    }
  }, [state.statuses])

  const statusOrder = useMemo(() => buildStatusOrder(state.statuses), [state.statuses])

  // Stage 1: project + isNote filter (changes rarely)
  const projectTasks = useMemo(() => {
    const nonNote = state.tasks.filter(t => !t.isNote)
    return state.activeProjectId
      ? nonNote.filter(t => t.projectId === state.activeProjectId)
      : nonNote
  }, [state.tasks, state.activeProjectId])

  // Stage 2: label map for text search
  const labelById = useMemo(
    () => new Map(state.labels.map(l => [l.id, l.name.toLowerCase()])),
    [state.labels]
  )

  // Stage 3: text search (re-runs on keypress, skips stage 1)
  const searchTasks = useMemo(() => {
    if (!state.searchQuery.trim()) return projectTasks
    const q = state.searchQuery.toLowerCase()
    return projectTasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.subtasks.some(s => s.title.toLowerCase().includes(q)) ||
      t.comments.some(c => c.text.toLowerCase().includes(q)) ||
      t.labels.some(lid => (labelById.get(lid) ?? '').includes(q))
    )
  }, [projectTasks, state.searchQuery, labelById])

  // Stage 4: attribute + date filters
  const filteredUnordered = useMemo(() => {
    let tasks = searchTasks
    if (state.filterPriority !== 'all') tasks = tasks.filter(t => t.priority === state.filterPriority)
    if (state.filterStatus   !== 'all') tasks = tasks.filter(t => t.status   === state.filterStatus)
    if (state.filterSLA      !== 'all') tasks = tasks.filter(t => getSLAStatus(t, finalStatusIds) === state.filterSLA)
    if (state.filterLabel    !== 'all') tasks = tasks.filter(t => t.labels.includes(state.filterLabel))
    if (state.dateFilter !== 'all') {
      const todayStr = todayLocalISO()
      const tomorrowStr = tomorrowLocalISO()
      if (state.dateFilter === 'today')         tasks = tasks.filter(t => t.dueDate === todayStr)
      else if (state.dateFilter === 'tomorrow') tasks = tasks.filter(t => t.dueDate === tomorrowStr)
      else if (state.dateFilter === 'upcoming') tasks = tasks.filter(t => t.dueDate != null && t.dueDate > todayStr)
    }
    return tasks
  }, [searchTasks, state.filterPriority, state.filterStatus, state.filterSLA,
      state.filterLabel, state.dateFilter, finalStatusIds])

  // Stage 5: sort (re-runs only when order or filter results change)
  const filteredTasks = useMemo(() => {
    return [...filteredUnordered].sort((a, b) => {
      const pin = Number(!!b.pinned) - Number(!!a.pinned)
      if (pin !== 0) return pin
      const aDone = finalStatusIds.has(a.status) ? 1 : 0
      const bDone = finalStatusIds.has(b.status) ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const dir = state.sortDir === 'asc' ? 1 : -1
      switch (state.sortField) {
        case 'title':    return dir * a.title.localeCompare(b.title)
        case 'priority': return dir * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        case 'status':   return dir * ((statusOrder[a.status] ?? 999) - (statusOrder[b.status] ?? 999))
        case 'dueDate': {
          const da = getDeadline(a)?.getTime() ?? Infinity
          const db = getDeadline(b)?.getTime() ?? Infinity
          return dir * (da - db)
        }
        case 'sla': return dir * (SLA_ORDER[getSLAStatus(a, finalStatusIds)] - SLA_ORDER[getSLAStatus(b, finalStatusIds)])
        default:    return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    })
  }, [filteredUnordered, state.sortField, state.sortDir, finalStatusIds, statusOrder])

  // Memoize the context object so consumers don't re-render on every provider
  // render — only when one of the derived values actually changes identity.
  const value = useMemo(
    () => ({ state, dispatch, filteredTasks, finalStatusIds, firstStatusId, finalStatusId }),
    [state, dispatch, filteredTasks, finalStatusIds, firstStatusId, finalStatusId]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
