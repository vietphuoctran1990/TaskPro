import { Moon, Sun, Search, SlidersHorizontal, Plus, Menu, LayoutDashboard, List, Calendar } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import type { Priority, Status, ViewMode, SLAStatus } from '../../types'

interface HeaderProps {
  onAddTask: () => void
  onOpenSidebar: () => void
}

const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'kanban',   label: 'Kanban',   icon: LayoutDashboard },
  { id: 'list',     label: 'List',     icon: List },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
]

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all',    label: 'All priorities' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High' },
  { value: 'medium', label: '🔵 Medium' },
  { value: 'low',    label: '⚪ Low' },
]

const STATUSES: { value: Status | 'all'; label: string }[] = [
  { value: 'all',         label: 'All statuses' },
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review',   label: 'In Review' },
  { value: 'done',        label: 'Done' },
]

const SLA_FILTERS: { value: SLAStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All SLA' },
  { value: 'breached',  label: '🔴 Breached' },
  { value: 'critical',  label: '🟠 Critical' },
  { value: 'at_risk',   label: '🟡 At Risk' },
  { value: 'on_track',  label: '🟢 On Track' },
  { value: 'none',      label: '— No SLA' },
]

export default function Header({ onAddTask, onOpenSidebar }: HeaderProps) {
  const { state, dispatch } = useApp()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const project = state.projects.find(p => p.id === state.activeProjectId)
  const hasFilters =
    state.filterPriority !== 'all' ||
    state.filterStatus !== 'all' ||
    state.filterSLA !== 'all' ||
    state.searchQuery.trim() !== ''

  const taskCount = state.tasks.filter(t =>
    state.activeProjectId ? t.projectId === state.activeProjectId : true
  ).length

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-0 shrink-0">
      {/* Top row */}
      <div className="flex items-center gap-3 h-14">
        {/* Mobile menu */}
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <Menu size={18} />
        </Button>

        {/* Title */}
        <div className="flex items-center gap-2 mr-auto min-w-0">
          {project && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          )}
          <h1 className="text-sm font-semibold text-slate-900 truncate">
            {project?.name ?? 'All Tasks'}
          </h1>
          <span className="text-xs text-slate-400 shrink-0">{taskCount}</span>
        </div>

        {/* View switcher */}
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {VIEWS.map(v => {
            const Icon = v.icon
            return (
              <button
                key={v.id}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v.id })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  state.viewMode === v.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={13} />
                {v.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="hidden md:flex relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={state.searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            className="h-8 pl-8 pr-3 w-44 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
          />
        </div>

        {/* Filter toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', hasFilters && 'text-indigo-600 bg-indigo-50')}
          onClick={() => setFiltersOpen(v => !v)}
        >
          <SlidersHorizontal size={15} />
          {hasFilters && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
          )}
        </Button>

        {/* Dark mode */}
        <Button variant="ghost" size="icon" onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}>
          {state.darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </Button>

        {/* New task */}
        <Button variant="primary" size="sm" onClick={onAddTask}>
          <Plus size={14} /> New Task
        </Button>
      </div>

      {/* Mobile view switcher */}
      <div className="sm:hidden flex gap-0.5 bg-slate-100 rounded-lg p-0.5 mb-2 w-fit">
        {VIEWS.map(v => {
          const Icon = v.icon
          return (
            <button
              key={v.id}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v.id })}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                state.viewMode === v.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
              )}
            >
              <Icon size={12} /> {v.label}
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <select
            value={state.filterPriority}
            onChange={e => dispatch({ type: 'SET_FILTER_PRIORITY', payload: e.target.value as Priority | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <select
            value={state.filterStatus}
            onChange={e => dispatch({ type: 'SET_FILTER_STATUS', payload: e.target.value as Status | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select
            value={state.filterSLA}
            onChange={e => dispatch({ type: 'SET_FILTER_SLA', payload: e.target.value as SLAStatus | 'all' })}
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {SLA_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-50"
              onClick={() => {
                dispatch({ type: 'SET_FILTER_PRIORITY', payload: 'all' })
                dispatch({ type: 'SET_FILTER_STATUS',   payload: 'all' })
                dispatch({ type: 'SET_FILTER_SLA',      payload: 'all' })
                dispatch({ type: 'SET_SEARCH',          payload: '' })
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </header>
  )
}
