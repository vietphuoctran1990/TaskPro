import { memo, useState, useRef, useMemo } from 'react'
import {
  ChevronDown, ChevronUp, ChevronsUpDown,
  MoreHorizontal, Pencil, Pin, PinOff, Timer, Trash2, CheckSquare, Calendar, Rows3, X, Check,
} from 'lucide-react'
import { cn, formatDateTime, getDeadline } from '../../lib/utils'
import { PriorityBadge } from '../ui/Badge'
import SLABadge from '../sla/SLABadge'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { useT } from '../../i18n'
import type { SortField, Task, Density } from '../../types'


const DENSITY_ROW_PAD: Record<Density, { card: string; cell: string }> = {
  compact:     { card: 'px-4 py-2',   cell: 'px-4 py-2'    },
  comfortable: { card: 'px-4 py-3',   cell: 'px-4 py-3.5'  },
  spacious:    { card: 'px-4 py-4',   cell: 'px-4 py-5'    },
}

const DensityToggle = memo(function DensityToggle() {
  const { state, dispatch } = useApp()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const opts: Density[] = ['compact', 'comfortable', 'spacious']
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(v => !v)} aria-label={t.density.label}>
        <Rows3 size={13} /> <span className="hidden sm:inline">{t.density[state.density]}</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-36 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden pop-in">
            {opts.map(d => (
              <button
                key={d}
                onClick={() => { dispatch({ type: 'SET_DENSITY', payload: d }); setOpen(false) }}
                className={cn('w-full text-left px-3 py-2 text-sm transition-colors',
                  state.density === d ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                {t.density[d]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

interface ListViewProps {
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onAddTask: () => void
  onFocusTask?: (task: Task) => void
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
        'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap',
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

function TaskMenu({ onEdit, onDelete, onPin, onFocus, pinned }: { onEdit: () => void; onDelete: () => void; onPin: () => void; onFocus?: () => void; pinned?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <Button ref={btnRef} variant="ghost" size="icon" className="w-7 h-7" onClick={handleOpen}>
        <MoreHorizontal size={14} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-36 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden pop-in"
            style={{ top: pos.top, right: pos.right }}
          >
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-xl"
              onClick={() => { setOpen(false); onEdit() }}>
              <Pencil size={13} /> {t.detail.edit}
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              onClick={() => { setOpen(false); onPin() }}>
              {pinned ? <><PinOff size={13} /> {t.pin.unpin}</> : <><Pin size={13} /> {t.pin.pin}</>}
            </button>
            {onFocus && (
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                onClick={() => { setOpen(false); onFocus() }}>
                <Timer size={13} /> {t.pomodoro.focus}
              </button>
            )}
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={() => { setOpen(false); onDelete() }}>
              <Trash2 size={13} /> {t.detail.delete}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const ListView = memo(function ListView({ onEditTask, onViewTask, onAddTask, onFocusTask }: ListViewProps) {
  const { state, dispatch, filteredTasks, finalStatusIds, firstStatusId, finalStatusId } = useApp()
  const { toast } = useToast()
  const t = useT()
  const isVi = state.language === 'vi'

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const statusMap = useMemo(() => new Map(state.statuses.map(s => [s.id, s])), [state.statuses])
  const projectMap = useMemo(() => new Map(state.projects.map(p => [p.id, p])), [state.projects])
  const i18nStatus   = t.status as Record<string, string>

  const getStatusColor = (id: string) => statusMap.get(id)?.color ?? '#94a3b8'
  const getStatusLabel = (id: string) => statusMap.get(id)?.name || i18nStatus[id] || id

  const handleSort = (field: SortField) => {
    dispatch({
      type: 'SET_SORT',
      payload: { field, dir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc' },
    })
  }

  const toggleDone = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: finalStatusIds.has(task.status) ? firstStatusId : finalStatusId } })
  }

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const enterSelectMode = (id?: string) => {
    setSelectMode(true)
    if (id) setSelectedIds(new Set([id]))
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const allVisibleSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedIds.has(t.id))

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredTasks.map(t => t.id)))
  }

  const bulkDelete = () => {
    const snapshots = state.tasks.filter(t => selectedIds.has(t.id))
    selectedIds.forEach(id => dispatch({ type: 'DELETE_TASK', payload: id }))
    const n = snapshots.length
    exitSelectMode()
    if (n > 0) toast({
      message: isVi ? `Đã xóa ${n} công việc` : `Deleted ${n} tasks`,
      type:    'info',
      action:  {
        label:   isVi ? 'Hoàn tác' : 'Undo',
        onClick: () => snapshots.forEach(t => dispatch({ type: 'RESTORE_TASK', payload: t })),
      },
    })
  }

  const bulkMarkDone = () => {
    selectedIds.forEach(id => dispatch({ type: 'MOVE_TASK', payload: { id, status: finalStatusId } }))
    const n = selectedIds.size
    exitSelectMode()
    toast({ message: isVi ? `Đã hoàn thành ${n} công việc` : `Marked ${n} tasks done`, type: 'success' })
  }

  const bulkChangeStatus = (statusId: string) => {
    selectedIds.forEach(id => dispatch({ type: 'MOVE_TASK', payload: { id, status: statusId } }))
    exitSelectMode()
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm py-16 flex flex-col items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-20">
          <rect x="8" y="14" width="48" height="6" rx="3" fill="#6366f1"/>
          <rect x="8" y="26" width="36" height="5" rx="2.5" fill="#6366f1"/>
          <rect x="8" y="37" width="28" height="5" rx="2.5" fill="#6366f1"/>
          <rect x="8" y="48" width="20" height="5" rx="2.5" fill="#6366f1"/>
        </svg>
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t.list.noTasks}</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">{isVi ? 'Tạo công việc đầu tiên để bắt đầu' : 'Create your first task to get started'}</p>
        </div>
        <Button variant="primary" size="sm" onClick={onAddTask}>+ {t.header.newTask}</Button>
      </div>
    )
  }

  const dpad = DENSITY_ROW_PAD[state.density]

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

      {/* Toolbar */}
      {selectMode ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={exitSelectMode} aria-label="Cancel">
              <X size={15} />
            </Button>
            <button onClick={toggleSelectAll}
              className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
              {allVisibleSelected
                ? (isVi ? 'Bỏ chọn tất cả' : 'Deselect all')
                : (isVi ? 'Chọn tất cả' : 'Select all')}
            </button>
            <span className="text-xs text-indigo-700/70 dark:text-indigo-300/70">
              {isVi ? `${selectedIds.size} đã chọn` : `${selectedIds.size} selected`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              onChange={e => { if (e.target.value) { bulkChangeStatus(e.target.value); e.target.value = '' } }}
              disabled={selectedIds.size === 0}
              className="h-7 px-2 rounded-md border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
              defaultValue=""
            >
              <option value="">{isVi ? 'Đổi trạng thái…' : 'Move to…'}</option>
              {[...state.statuses].sort((a, b) => a.order - b.order).map(s => (
                <option key={s.id} value={s.id}>{s.name || i18nStatus[s.id] || s.id}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={bulkMarkDone} disabled={selectedIds.size === 0}
              className="text-emerald-700 dark:text-emerald-300">
              <Check size={13} /> {isVi ? 'Hoàn thành' : 'Done'}
            </Button>
            <Button variant="ghost" size="sm" onClick={bulkDelete} disabled={selectedIds.size === 0}
              className="text-red-600 dark:text-red-400">
              <Trash2 size={13} /> {isVi ? 'Xóa' : 'Delete'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-800/40">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t.list.tasks(filteredTasks.length)}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => enterSelectMode()}>
              <CheckSquare size={13} /> <span className="hidden sm:inline">{isVi ? 'Chọn' : 'Select'}</span>
            </Button>
            <DensityToggle />
          </div>
        </div>
      )}

      {/* ── MOBILE CARD LIST (hidden on md+) ─────────────────────────── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
        {filteredTasks.map(task => {
          const project = projectMap.get(task.projectId)
          const deadline = getDeadline(task)
          const done = finalStatusIds.has(task.status)
          return (
            <div
              key={task.id}
              className={cn(
                dpad.card, 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer',
                selectMode && selectedIds.has(task.id) && 'bg-indigo-50/60 dark:bg-indigo-900/20',
              )}
              onClick={() => selectMode ? toggleSelect(task.id) : onViewTask(task)}
            >
              {/* Row 1: checkbox + title + menu */}
              <div className="flex items-center gap-2.5">
                {selectMode ? (
                  <button
                    className={cn(
                      'shrink-0 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center',
                      selectedIds.has(task.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'
                    )}
                    onClick={e => toggleSelect(task.id, e)}
                  >
                    {selectedIds.has(task.id) && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                ) : (
                <button
                  className={cn(
                    'shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                    done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                  )}
                  onClick={e => toggleDone(task, e)}
                >
                  {done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                )}
                <p className={cn(
                  'flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate',
                  done && 'line-through text-slate-400'
                )}>
                  {task.title}
                </p>
                <TaskMenu
                  onEdit={() => onEditTask(task)}
                  onDelete={() => {
                    const snapshot = task
                    dispatch({ type: 'DELETE_TASK', payload: task.id })
                    toast({ message: isVi ? 'Đã xóa công việc' : 'Task deleted', type: 'info', action: { label: isVi ? 'Hoàn tác' : 'Undo', onClick: () => dispatch({ type: 'RESTORE_TASK', payload: snapshot }) } })
                  }}
                  onPin={() => dispatch({ type: 'TOGGLE_PIN_TASK', payload: task.id })}
                  pinned={task.pinned}
                  onFocus={!finalStatusIds.has(task.status) && onFocusTask ? () => onFocusTask(task) : undefined}
                />
              </div>

              {/* Row 2: badges + meta */}
              <div className="flex items-center flex-wrap gap-1.5 mt-1.5 pl-6">
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(task.status) }} />
                  {getStatusLabel(task.status)}
                </span>
                <PriorityBadge priority={task.priority} />
                <SLABadge task={task} showTimer />
                {deadline && (
                  <span className={cn(
                    'inline-flex items-center gap-1 text-xs',
                    deadline.getTime() < Date.now() && !done ? 'text-red-500 font-medium' : 'text-slate-400'
                  )}>
                    <Calendar size={10} />
                    {formatDateTime(task.dueDate, task.dueTime)}
                  </span>
                )}
                {project && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </span>
                )}
                {task.subtasks.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <CheckSquare size={10} />
                    {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DESKTOP TABLE (hidden on mobile) ─────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {selectMode && (
                <th className="pl-4 py-3 w-8">
                  <button
                    className={cn(
                      'w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                      allVisibleSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400 dark:border-slate-500'
                    )}
                    onClick={toggleSelectAll}
                  >
                    {allVisibleSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                </th>
              )}
              <SortHeader field="title"    label={t.list.task}     currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} className={selectMode ? 'w-80' : 'pl-5 w-80'} />
              <SortHeader field="status"   label={t.list.status}   currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="priority" label={t.list.priority} currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="sla"      label={t.list.sla}      currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <SortHeader field="dueDate"  label={t.list.deadline} currentField={state.sortField} currentDir={state.sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.list.project}</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredTasks.map(task => {
              const project = projectMap.get(task.projectId)
              const deadline = getDeadline(task)
              const done = finalStatusIds.has(task.status)
              const selected = selectedIds.has(task.id)
              return (
                <tr
                  key={task.id}
                  className={cn(
                    'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group',
                    selectMode && selected && 'bg-indigo-50/60 dark:bg-indigo-900/20'
                  )}
                  onClick={() => selectMode ? toggleSelect(task.id) : onViewTask(task)}
                >
                  {selectMode && (
                    <td className="pl-4" onClick={e => e.stopPropagation()}>
                      <button
                        className={cn(
                          'w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                          selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'
                        )}
                        onClick={e => toggleSelect(task.id, e)}
                      >
                        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </button>
                    </td>
                  )}
                  <td className={cn(selectMode ? '' : 'pl-5', dpad.cell)}>
                    <div className="flex items-start gap-2.5">
                      {!selectMode && (
                        <button
                          className={cn(
                            'mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
                            done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                          )}
                          onClick={e => toggleDone(task, e)}
                        >
                          {done && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]', done && 'line-through text-slate-400')}>
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
                  <td className={dpad.cell}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(task.status) }} />
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className={dpad.cell}><PriorityBadge priority={task.priority} /></td>
                  <td className={dpad.cell}><SLABadge task={task} showTimer /></td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                    {deadline
                      ? <span className={cn(deadline.getTime() < Date.now() && !done && 'text-red-500 font-medium')}>
                          {formatDateTime(task.dueDate, task.dueTime)}
                        </span>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className={dpad.cell}>
                    {project && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                    )}
                  </td>
                  <td className={cn('px-3', dpad.cell)} onClick={e => e.stopPropagation()}>
                    <TaskMenu
                      onEdit={() => onEditTask(task)}
                      onDelete={() => {
                        const snapshot = task
                        dispatch({ type: 'DELETE_TASK', payload: task.id })
                        toast({ message: isVi ? 'Đã xóa công việc' : 'Task deleted', type: 'info', action: { label: isVi ? 'Hoàn tác' : 'Undo', onClick: () => dispatch({ type: 'RESTORE_TASK', payload: snapshot }) } })
                      }}
                      onPin={() => dispatch({ type: 'TOGGLE_PIN_TASK', payload: task.id })}
                      pinned={task.pinned}
                      onFocus={!finalStatusIds.has(task.status) && onFocusTask ? () => onFocusTask(task) : undefined}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-400 dark:text-slate-500">
        {t.list.tasks(filteredTasks.length)}
        {' · '}
        {t.list.completed(filteredTasks.filter(tk => finalStatusIds.has(tk.status)).length)}
      </div>
    </div>
  )
})

export default ListView
