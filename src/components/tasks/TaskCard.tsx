import { memo, useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, CheckCheck, GripVertical, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Repeat, RotateCcw, Timer, Trash2, X } from 'lucide-react'
import { cn, formatDateTime, getDeadline, getSLAStatus } from '../../lib/utils'
import { PriorityBadge, Badge } from '../ui/Badge'
import SLABadge from '../sla/SLABadge'
import Button from '../ui/Button'
import type { Task } from '../../types'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { burstConfetti, haptic } from '../../lib/feedback'

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onView: (task: Task) => void
  onFocus?: (task: Task) => void
}

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  medium: 'border-l-blue-400',
  low:    'border-l-slate-200',
}

const TaskCard = memo(function TaskCard({ task, onEdit, onView, onFocus }: TaskCardProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const labels = state.labels.filter(l => task.labels.includes(l.id))
  const completedSub = task.subtasks.filter(s => s.done).length
  const deadline = getDeadline(task)
  const sla = getSLAStatus(task)

  // Haptic on drag start (mobile)
  useEffect(() => { if (isDragging) haptic(8) }, [isDragging])

  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setMenuOpen(v => !v)
  }

  const handleQuickDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: 'done' } })
    haptic(12)
    if (task.priority === 'urgent') burstConfetti(cardRef.current)
  }

  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    cardRef.current = node
  }

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        'group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-[3px] shadow-sm hover:shadow-md hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer select-none',
        PRIORITY_ACCENT[task.priority],
        isDragging && 'opacity-50 shadow-xl scale-105 z-50',
        task.status === 'done' && 'opacity-60',
        task.pinned && 'ring-1 ring-amber-300 dark:ring-amber-500/60'
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
        <button
          {...attributes} {...listeners}
          aria-label="Reorder task"
          className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </button>
        <div className="flex items-center gap-0.5 ml-auto">
          {/* Quick: mark done / undo done */}
          {task.status !== 'done' ? (
            <button
              onClick={handleQuickDone}
              className="w-6 h-6 flex items-center justify-center rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:bg-emerald-50 active:text-emerald-600 transition-all"
              title={t.status.done}
            >
              <CheckCheck size={13} />
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: 'todo' } }) }}
              className="w-6 h-6 flex items-center justify-center rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:bg-indigo-50 active:text-indigo-600 transition-all"
              title={t.status.todo}
            >
              <RotateCcw size={12} />
            </button>
          )}
          {/* Quick: delete/cancel */}
          <button
            onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_TASK', payload: task.id }) }}
            className="w-6 h-6 flex items-center justify-center rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 active:bg-red-50 active:text-red-600 transition-all"
            title={t.detail.delete}
          >
            <X size={13} />
          </button>
          <div className="relative">
          <Button
            ref={menuBtnRef}
            variant="ghost" size="icon"
            aria-label="More options"
            className="w-6 h-6 opacity-0 group-hover:opacity-100"
            onClick={handleMenuOpen}
          >
            <MoreHorizontal size={13} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="fixed z-50 w-36 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg pop-in"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-t-xl"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(task) }}>
                  <Pencil size={13} /> {t.detail.edit}
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); dispatch({ type: 'TOGGLE_PIN_TASK', payload: task.id }) }}>
                  {task.pinned ? <><PinOff size={13} /> {t.pin.unpin}</> : <><Pin size={13} /> {t.pin.pin}</>}
                </button>
                {onFocus && task.status !== 'done' && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onFocus(task) }}>
                    <Timer size={13} /> {t.pomodoro.focus}
                  </button>
                )}
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-xl"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); dispatch({ type: 'DELETE_TASK', payload: task.id }) }}>
                  <Trash2 size={13} /> {t.detail.delete}
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-3" onClick={() => onView(task)}>
        <div className="flex items-start gap-1.5 mb-2">
          {task.pinned && <Pin size={11} className="text-amber-500 shrink-0 mt-0.5 fill-amber-400/60" />}
          <p className={cn(
            'flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug',
            task.status === 'done' && 'line-through text-slate-400'
          )}>
            {task.title}
          </p>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {labels.map(l => <Badge key={l.id} color={l.color}>{l.name}</Badge>)}
          </div>
        )}

        {/* SLA badge */}
        {sla !== 'none' && (
          <div className="mb-2">
            <SLABadge task={task} showTimer />
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            {task.recurrence && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-100">
                <Repeat size={9} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {task.subtasks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300',
                      completedSub === task.subtasks.length ? 'bg-emerald-500' : 'bg-indigo-400'
                    )}
                    style={{ width: `${task.subtasks.length ? (completedSub / task.subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                <span className={cn('text-xs tabular-nums',
                  completedSub === task.subtasks.length ? 'text-emerald-600' : 'text-slate-400'
                )}>
                  {completedSub}/{task.subtasks.length}
                </span>
              </div>
            )}
            {task.comments.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MessageSquare size={11} />
                {task.comments.length}
              </span>
            )}
            {deadline && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                sla === 'breached' || sla === 'critical' ? 'text-red-500 font-medium' :
                sla === 'at_risk' ? 'text-amber-600' : 'text-slate-400'
              )}>
                <Calendar size={11} />
                {formatDateTime(task.dueDate, task.dueTime)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default TaskCard
