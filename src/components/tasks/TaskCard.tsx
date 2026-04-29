import { memo, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  CheckSquare,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn, formatDate, isOverdue, isDueSoon } from '../../lib/utils'
import { PriorityBadge, Badge } from '../ui/Badge'
import Button from '../ui/Button'
import type { Task } from '../../types'
import { useApp } from '../../context/AppContext'

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onView: (task: Task) => void
}

const TaskCard = memo(function TaskCard({ task, onEdit, onView }: TaskCardProps) {
  const { state, dispatch } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const labels = state.labels.filter(l => task.labels.includes(l.id))
  const completedSubtasks = task.subtasks.filter(s => s.done).length
  const totalSubtasks = task.subtasks.length

  const dueDateClass = isOverdue(task.dueDate)
    ? 'text-red-500'
    : isDueSoon(task.dueDate)
    ? 'text-amber-500'
    : 'text-slate-400 dark:text-slate-500'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none',
        isDragging && 'opacity-50 shadow-xl scale-105 z-50',
        task.status === 'done' && 'opacity-70'
      )}
    >
      {/* Drag handle + menu row */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded"
          aria-label="Drag task"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>

        <div className="relative ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 opacity-0 group-hover:opacity-100"
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            aria-label="Task options"
          >
            <MoreHorizontal size={14} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-20 w-40 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(task) }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  onClick={e => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    dispatch({ type: 'DELETE_TASK', payload: task.id })
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 pb-3" onClick={() => onView(task)}>
        <p
          className={cn(
            'text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug mb-2',
            task.status === 'done' && 'line-through text-slate-400 dark:text-slate-500'
          )}
        >
          {task.title}
        </p>

        {task.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 mb-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {labels.map(label => (
              <Badge key={label.id} color={label.color}>{label.name}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <PriorityBadge priority={task.priority} />

          <div className="flex items-center gap-2">
            {totalSubtasks > 0 && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                completedSubtasks === totalSubtasks
                  ? 'text-emerald-500'
                  : 'text-slate-400 dark:text-slate-500'
              )}>
                <CheckSquare size={12} />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}

            {task.dueDate && (
              <span className={cn('flex items-center gap-1 text-xs', dueDateClass)}>
                <Calendar size={12} />
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default TaskCard
