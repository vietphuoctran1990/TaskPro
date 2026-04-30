import { memo, useState } from 'react'
import {
  ChevronDown, ChevronUp, ChevronsUpDown,
  MoreHorizontal, Pencil, Trash2, CheckSquare,
} from 'lucide-react'
import { cn, formatDateTime, getDeadline } from '../../lib/utils'
import { PriorityBadge } from '../ui/Badge'
import SLABadge from '../sla/SLABadge'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { SortField, Task } from '../../types'

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-slate-400', in_progress: 'bg-blue-500', in_review: 'bg-violet-500', done: 'bg-emerald-500',
}

interface ListViewProps {
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onAddTask: () => void
}

interface SortHeaderProps {
  field: SortField
  label: string
  currentField: SortField
  currentDir: 'asc' | 'desc'
  onSort: (f: SortField) => void
  className?: string
}

function SortHeader({ field, label, currentField, currentDir, onSort, className }: SortHeaderProps) {
  const active = currentField === field
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 whitespace-nowrap',
        className
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? currentDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={12} className="opacity-30" />}
      </span>
    </th>
  )
}

const ListView = memo(function ListView({ onEditTask, onViewTask, onAddTask }: ListViewProps) {
  const { state, dispatch, filteredTasks } = useApp()
  const t = useT()
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    dispatch({
      type: 'SET_SORT',
      payload: {
        field,
        dir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
      },
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <SortHeader field="title"    label={t.list.task}     currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} className="pl-5 w-80" />
              <SortHeader field="status"   label={t.list.status}   currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="priority" label={t.list.priority} currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="sla"      label={t.list.sla}      currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="dueDate"  label={t.list.deadline} currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.list.project}</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <p className="text-slate-400 text-sm mb-3">{t.list.noTasks}</p>
                  <Button variant="primary" size="sm" onClick={onAddTask}>+ {t.header.newTask}</Button>
                </td>
              </tr>
            ) : (
              filteredTasks.map(task => {
                const project = state.projects.find(p => p.id === task.projectId)
                const deadline = getDeadline(task)
                const done = task.status === 'done'
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => onViewTask(task)}
                  >
                    {/* Title */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <button
                          className={cn(
                            'mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                            done
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 hover:border-indigo-400'
                          )}
                          onClick={e => {
                            e.stopPropagation()
                            dispatch({
                              type: 'MOVE_TASK',
                              payload: { id: task.id, status: done ? 'todo' : 'done' },
                            })
                          }}
                        >
                          {done && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className={cn(
                            'text-sm font-medium text-slate-800 truncate max-w-[280px]',
                            done && 'line-through text-slate-400'
                          )}>
                            {task.title}
                          </p>
                          {task.subtasks.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <CheckSquare size={10} />
                              {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[task.status])} />
                        {t.status[task.status]}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    {/* SLA */}
                    <td className="px-4 py-3.5">
                      <SLABadge task={task} showTimer />
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      {deadline
                        ? <span className={cn(
                            deadline.getTime() < Date.now() && !done && 'text-red-500 font-medium'
                          )}>
                            {formatDateTime(task.dueDate, task.dueTime)}
                          </span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>

                    {/* Project */}
                    <td className="px-4 py-3.5">
                      {project && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                          {project.name}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100"
                          onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}
                        >
                          <MoreHorizontal size={14} />
                        </Button>
                        {menuOpenId === task.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-8 z-20 w-36 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => { setMenuOpenId(null); onEditTask(task) }}
                              >
                                <Pencil size={13} /> {t.detail.edit}
                              </button>
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                onClick={() => { setMenuOpenId(null); dispatch({ type: 'DELETE_TASK', payload: task.id }) }}
                              >
                                <Trash2 size={13} /> {t.detail.delete}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredTasks.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          {t.list.tasks(filteredTasks.length)}
          {' · '}
          {t.list.completed(filteredTasks.filter(tk => tk.status === 'done').length)}
        </div>
      )}
    </div>
  )
})

export default ListView
