import { useState } from 'react'
import {
  CheckSquare,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Tag,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import { Input } from '../ui/Input'
import type { Project } from '../../types'

const PROJECT_COLORS = [
  '#6366f1', '#0ea5e9', '#f59e0b', '#22c55e', '#ec4899',
  '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4',
]

interface SidebarProps {
  onClose?: () => void
  mobile?: boolean
}

export default function Sidebar({ onClose, mobile }: SidebarProps) {
  const { state, dispatch } = useApp()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])

  const handleAddProject = () => {
    if (!newProjectName.trim()) return
    dispatch({
      type: 'ADD_PROJECT',
      payload: {
        name: newProjectName.trim(),
        color: newProjectColor,
        description: '',
      },
    })
    setNewProjectName('')
    setNewProjectColor(PROJECT_COLORS[0])
    setAddingProject(false)
  }

  const taskCountByProject = (projectId: string) =>
    state.tasks.filter(t => t.projectId === projectId).length

  const totalTasks = state.tasks.length
  const doneTasks = state.tasks.filter(t => t.status === 'done').length

  return (
    <aside className={cn(
      'flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60',
      mobile ? 'w-full h-full' : 'w-60 shrink-0 h-full'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <CheckSquare size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            TaskPro
          </span>
        </div>
        {mobile && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
        {/* All Tasks */}
        <button
          onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null }); onClose?.() }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            state.activeProjectId === null
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
          )}
        >
          <LayoutDashboard size={15} />
          <span className="flex-1 text-left">All Tasks</span>
          <span className="text-xs font-medium opacity-60">{totalTasks}</span>
        </button>

        {/* Projects section */}
        <div className="pt-3 pb-1">
          <button
            className="w-full flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            onClick={() => setProjectsOpen(v => !v)}
          >
            <FolderOpen size={12} />
            <span className="flex-1 text-left">Projects</span>
            <ChevronDown
              size={12}
              className={cn('transition-transform', !projectsOpen && '-rotate-90')}
            />
          </button>

          {projectsOpen && (
            <div className="mt-1 space-y-0.5">
              {state.projects.map(project => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  active={state.activeProjectId === project.id}
                  count={taskCountByProject(project.id)}
                  onClick={() => {
                    dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project.id })
                    onClose?.()
                  }}
                />
              ))}

              {addingProject ? (
                <div className="px-2 pt-2 pb-1 space-y-2">
                  <Input
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddProject()
                      if (e.key === 'Escape') setAddingProject(false)
                    }}
                    autoFocus
                  />
                  <div className="flex gap-1 flex-wrap">
                    {PROJECT_COLORS.map(c => (
                      <button
                        key={c}
                        className={cn(
                          'w-5 h-5 rounded-full transition-transform hover:scale-110',
                          newProjectColor === c && 'ring-2 ring-offset-1 ring-slate-400'
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewProjectColor(c)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleAddProject}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingProject(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingProject(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <Plus size={12} /> New project
                </button>
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="pt-1 pb-1">
          <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <Tag size={12} />
            <span>Labels</span>
          </div>
          <div className="mt-1 px-3 flex flex-wrap gap-1.5">
            {state.labels.map(label => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Overall progress</span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {doneTasks}/{totalTasks}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%` }}
          />
        </div>
      </div>
    </aside>
  )
}

function ProjectItem({
  project,
  active,
  count,
  onClick,
}: {
  project: Project
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
        active
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
      )}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="flex-1 text-left truncate">{project.name}</span>
      <span className="text-xs opacity-50">{count}</span>
    </button>
  )
}
