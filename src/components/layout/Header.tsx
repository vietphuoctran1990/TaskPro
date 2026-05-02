import { Moon, Sun, SlidersHorizontal, Plus, Menu, LayoutDashboard, List, Calendar, BarChart3, User, RefreshCw, LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../i18n'
import Button from '../ui/Button'
import NotificationBell from './NotificationBell'
import { supabase } from '../../lib/supabase'
import type { Priority, Status, ViewMode, SLAStatus } from '../../types'

interface HeaderProps {
  onAddTask: () => void
  onOpenSidebar: () => void
  onOpenAuth: () => void
}

const VIEW_ICONS: Record<ViewMode, React.ElementType> = {
  dashboard: BarChart3, kanban: LayoutDashboard, list: List, calendar: Calendar,
}

function UserMenu({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { user, syncing, lastSynced, signOut, syncNow } = useAuth()
  const t = useT()
  const [open, setOpen] = useState(false)

  if (!supabase) return null  // Auth not configured — hide button

  if (!user) {
    return (
      <button onClick={onOpenAuth}
        className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors bg-white">
        <User size={13} />{t.auth.signIn}
      </button>
    )
  }

  const initials = (user.email ?? 'U').slice(0, 2).toUpperCase()
  const syncLabel = syncing
    ? t.auth.syncing
    : lastSynced
      ? t.auth.syncedAt(lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      : t.auth.notSynced

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-slate-100 transition-colors">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
          {initials}
        </span>
        {syncing && <Loader2 size={11} className="animate-spin text-slate-400" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-52 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700 truncate">{user.email}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{syncLabel}</p>
            </div>
            <button onClick={() => { syncNow(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {t.auth.syncNow}
            </button>
            <button onClick={() => { signOut(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={13} />{t.auth.signOut}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Header({ onAddTask, onOpenSidebar, onOpenAuth }: HeaderProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const views: ViewMode[] = ['dashboard', 'kanban', 'list', 'calendar']
  const project = state.projects.find(p => p.id === state.activeProjectId)
  const taskCount = state.tasks.filter(tk =>
    state.activeProjectId ? tk.projectId === state.activeProjectId : true
  ).length
  const hasFilters =
    state.filterPriority !== 'all' || state.filterStatus !== 'all' ||
    state.filterSLA !== 'all' || state.searchQuery.trim() !== ''

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-0 shrink-0">
      {/* Top row */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 h-14">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <Menu size={18} />
        </Button>

        {/* Title */}
        <div className="flex items-center gap-2 mr-auto min-w-0">
          {project && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
          <h1 className="text-sm font-semibold text-slate-900 truncate">
            {project?.name ?? t.sidebar.allTasks}
          </h1>
          <span className="text-xs text-slate-400 shrink-0">{taskCount} {t.header.tasks}</span>
        </div>

        {/* View switcher — desktop */}
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {views.map(v => {
            const Icon = VIEW_ICONS[v]
            return (
              <button key={v} onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v })}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  state.viewMode === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={13} />
                <span className="hidden md:inline">{t.views[v]}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="hidden md:flex relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="search" placeholder={t.header.search} value={state.searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            className="h-8 pl-8 pr-3 w-40 rounded-lg border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <Button variant="ghost" size="icon" className={cn('relative', hasFilters && 'text-indigo-600 bg-indigo-50')}
          onClick={() => setFiltersOpen(v => !v)}>
          <SlidersHorizontal size={15} />
          {hasFilters && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
        </Button>

        <NotificationBell />

        <Button variant="ghost" size="icon" onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}>
          {state.darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </Button>

        <button
          onClick={() => dispatch({ type: 'SET_LANGUAGE', payload: state.language === 'vi' ? 'en' : 'vi' })}
          className="hidden sm:inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors bg-white"
        >
          {t.header.language}
        </button>

        <UserMenu onOpenAuth={onOpenAuth} />

        <Button variant="primary" size="sm" onClick={onAddTask}>
          <Plus size={14} /> <span className="hidden sm:inline">{t.header.newTask}</span>
        </Button>
      </div>

      {/* Mobile view tabs */}
      <div className="sm:hidden flex gap-0.5 bg-slate-100 rounded-lg p-0.5 mb-2 w-fit">
        {views.map(v => {
          const Icon = VIEW_ICONS[v]
          return (
            <button key={v} onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v })}
              className={cn('flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                state.viewMode === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500')}>
              <Icon size={12} />
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <select value={state.filterPriority}
            onChange={e => dispatch({ type: 'SET_FILTER_PRIORITY', payload: e.target.value as Priority | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="all">{t.priority.allPriorities}</option>
            <option value="urgent">{t.priority.urgentIcon}</option>
            <option value="high">{t.priority.highIcon}</option>
            <option value="medium">{t.priority.mediumIcon}</option>
            <option value="low">{t.priority.lowIcon}</option>
          </select>
          <select value={state.filterStatus}
            onChange={e => dispatch({ type: 'SET_FILTER_STATUS', payload: e.target.value as Status | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="all">{t.header.allStatuses}</option>
            <option value="todo">{t.status.todo}</option>
            <option value="in_progress">{t.status.in_progress}</option>
            <option value="in_review">{t.status.in_review}</option>
            <option value="done">{t.status.done}</option>
          </select>
          <select value={state.filterSLA}
            onChange={e => dispatch({ type: 'SET_FILTER_SLA', payload: e.target.value as SLAStatus | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="all">{t.sla.allSLA}</option>
            <option value="breached">🔴 {t.sla.breached}</option>
            <option value="critical">🟠 {t.sla.critical}</option>
            <option value="at_risk">🟡 {t.sla.at_risk}</option>
            <option value="on_track">🟢 {t.sla.on_track}</option>
            <option value="none">— {t.sla.none}</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50"
              onClick={() => {
                dispatch({ type: 'SET_FILTER_PRIORITY', payload: 'all' })
                dispatch({ type: 'SET_FILTER_STATUS',   payload: 'all' })
                dispatch({ type: 'SET_FILTER_SLA',      payload: 'all' })
                dispatch({ type: 'SET_SEARCH',          payload: '' })
              }}>
              {t.header.clear}
            </Button>
          )}
        </div>
      )}
    </header>
  )
}
