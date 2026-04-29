import { useState, useCallback } from 'react'
import {
  Calendar,
  CheckSquare,
  Clock,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { PriorityBadge, Badge } from '../ui/Badge'
import { useApp } from '../../context/AppContext'
import { cn, formatDate, isOverdue, isDueSoon } from '../../lib/utils'
import type { Task } from '../../types'

interface TaskDetailProps {
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
}

export default function TaskDetail({ task, onClose, onEdit }: TaskDetailProps) {
  const { state, dispatch } = useApp()
  const [newSubtask, setNewSubtask] = useState('')

  const project = task ? state.projects.find(p => p.id === task.projectId) : null
  const labels = task ? state.labels.filter(l => task.labels.includes(l.id)) : []

  const handleToggleSubtask = useCallback(
    (subtaskId: string) => {
      if (!task) return
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id: task.id,
          subtasks: task.subtasks.map(s =>
            s.id === subtaskId ? { ...s, done: !s.done } : s
          ),
        },
      })
    },
    [task, dispatch]
  )

  const handleAddSubtask = useCallback(() => {
    if (!task || !newSubtask.trim()) return
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: task.id,
        subtasks: [
          ...task.subtasks,
          { id: Math.random().toString(36).slice(2), title: newSubtask.trim(), done: false },
        ],
      },
    })
    setNewSubtask('')
  }, [task, newSubtask, dispatch])

  const handleDeleteSubtask = useCallback(
    (subtaskId: string) => {
      if (!task) return
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id: task.id,
          subtasks: task.subtasks.filter(s => s.id !== subtaskId),
        },
      })
    },
    [task, dispatch]
  )

  const handleDelete = useCallback(() => {
    if (!task) return
    dispatch({ type: 'DELETE_TASK', payload: task.id })
    onClose()
  }, [task, dispatch, onClose])

  const dueDateClass = task
    ? isOverdue(task.dueDate)
      ? 'text-red-500'
      : isDueSoon(task.dueDate)
      ? 'text-amber-500'
      : 'text-slate-500 dark:text-slate-400'
    : ''

  const completedSubtasks = task?.subtasks.filter(s => s.done).length ?? 0
  const totalSubtasks = task?.subtasks.length ?? 0
  const progress = totalSubtasks ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0

  return (
    <Modal open={!!task} onClose={onClose} size="lg">
      {task && (
        <>
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className={cn(
                'text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug',
                task.status === 'done' && 'line-through text-slate-400 dark:text-slate-500'
              )}>
                {task.title}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { onClose(); onEdit(task) }} aria-label="Edit">
                  <Pencil size={15} />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDelete} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Delete">
                  <Trash2 size={15} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                  <X size={15} />
                </Button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-sm">
              <PriorityBadge priority={task.priority} />
              {project && (
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Clock size={13} />
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
              {task.dueDate && (
                <span className={cn('flex items-center gap-1.5', dueDateClass)}>
                  <Calendar size={13} />
                  {isOverdue(task.dueDate) ? 'Overdue: ' : 'Due: '}
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-6 overflow-y-auto">
            {/* Description */}
            {task.description && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Labels */}
            {labels.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag size={11} /> Labels
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map(label => (
                    <Badge key={label.id} color={label.color}>{label.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare size={11} /> Subtasks
                </h3>
                {totalSubtasks > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>

              {totalSubtasks > 0 && (
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {task.subtasks.map(subtask => (
                  <div key={subtask.id} className="flex items-center gap-2.5 group/sub">
                    <button
                      onClick={() => handleToggleSubtask(subtask.id)}
                      className={cn(
                        'shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                        subtask.done
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                      )}
                      aria-label={subtask.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {subtask.done && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={cn(
                      'flex-1 text-sm',
                      subtask.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover/sub:opacity-100 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all"
                      aria-label="Delete subtask"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add subtask */}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Add subtask…"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                  className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button variant="ghost" size="icon" onClick={handleAddSubtask} disabled={!newSubtask.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </div>

          {/* Footer - status changer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Move to:</span>
              {(['todo', 'in_progress', 'in_review', 'done'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: s } })}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    task.status === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'
                  )}
                >
                  {{ todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' }[s]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
