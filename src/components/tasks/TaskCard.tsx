import { memo, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, CheckSquare, GripVertical, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn, formatDateTime, getDeadline, getSLAStatus } from '../../lib/utils'
import { PriorityBadge, Badge } from '../ui/Badge'
import SLABadge from '../sla/SLABadge'
import Button from '../ui/Button'
import type { Task } from '../../types'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onView: (task: Task) => void
}

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: 'border-t-red-500',
  high:   'border-t-orange-400',
  medium: 'border-t-blue-400',
  low:    'border-t-slate-200',
}

const TaskCard = memo(function TaskCard({ task, onEdit, onView }: TaskCardProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const labels = state.labels.filter(l => task.labels.includes(l.id))
  const completedSub = task.subtasks.filter(s => s.done).length
  const deadline = getDeadline(task)
  const sla = getSLAStatus(task)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-white rounded-xl border border-slate-200 border-t-2 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer select-none',
        PRIORITY_ACCENT[task.priority],
        isDragging && 'opacity-50 shadow-xl scale-105 z-50',
        task.status === 'done' && 'opacity-60'
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
        <button
          {...attributes} {...listeners}
          className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </button>
        <div className="relative ml-auto">
          <Button
            variant="ghost" size="icon"
            className="w-6 h-6 opacity-0 group-hover:opacity-100"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          >
            <MoreHorizontal size={13} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 w-36 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(task) }}>
                  <Pencil size={13} /> {t.detail.edit}
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); dispatch({ type: 'DELETE_TASK', payload: task.id }) }}>
                  <Trash2 size={13} /> {t.detail.delete}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-3" onClick={() => onView(task)}>
        <p className={cn(
          'text-sm font-medium text-slate-800 leading-snug mb-2',
          task.status === 'done' && 'line-through text-slate-400'
        )}>
          {task.title}
        </p>

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
          <PriorityBadge priority={task.priority} />
          <div className="flex items-center gap-2.5">
            {task.subtasks.length > 0 && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                completedSub === task.subtasks.length ? 'text-emerald-600' : 'text-slate-400'
              )}>
                <CheckSquare size={11} />
                {completedSub}/{task.subtasks.length}
              </span>
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
