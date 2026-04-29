import { Moon, Sun, Search, SlidersHorizontal, Plus, Menu } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import type { Priority, Status } from '../../types'

interface HeaderProps {
  onAddTask: () => void
  onOpenSidebar: () => void
}

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const STATUSES: { value: Status | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
]

export default function Header({ onAddTask, onOpenSidebar }: HeaderProps) {
  const { state, dispatch } = useApp()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const projectName = state.activeProjectId
    ? state.projects.find(p => p.id === state.activeProjectId)?.name
    : 'All Tasks'

  const hasFilters =
    state.filterPriority !== 'all' || state.filterStatus !== 'all' || state.searchQuery.trim()

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 px-4 py-3 shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </Button>

        {/* Title */}
        <div className="flex items-center gap-2 mr-auto">
          {state.activeProjectId && (
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: state.projects.find(p => p.id === state.activeProjectId)?.color,
              }}
            />
          )}
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {projectName}
          </h1>
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {/* task count badge */}
            {state.tasks.filter(t =>
              state.activeProjectId ? t.projectId === state.activeProjectId : true
            ).length} tasks
          </span>
        </div>

        {/* Search */}
        <div className="hidden sm:flex relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search tasks…"
            value={state.searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            className="h-9 pl-8 pr-3 w-52 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filters toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFiltersOpen(v => !v)}
          className={cn(hasFilters && 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30')}
          aria-label="Filters"
        >
          <SlidersHorizontal size={16} />
          {hasFilters && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
          )}
        </Button>

        {/* Dark mode */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
          aria-label="Toggle dark mode"
        >
          {state.darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </Button>

        {/* Add task */}
        <Button variant="primary" size="sm" onClick={onAddTask}>
          <Plus size={15} /> New Task
        </Button>
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <select
            value={state.filterPriority}
            onChange={e =>
              dispatch({
                type: 'SET_FILTER_PRIORITY',
                payload: e.target.value as Priority | 'all',
              })
            }
            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={state.filterStatus}
            onChange={e =>
              dispatch({
                type: 'SET_FILTER_STATUS',
                payload: e.target.value as Status | 'all',
              })
            }
            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: 'SET_FILTER_PRIORITY', payload: 'all' })
                dispatch({ type: 'SET_FILTER_STATUS', payload: 'all' })
                dispatch({ type: 'SET_SEARCH', payload: '' })
              }}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </header>
  )
}
