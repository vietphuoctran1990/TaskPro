import { memo, useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, CircleDot, Loader2, Eye, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import TaskCard from './TaskCard'
import Button from '../ui/Button'
import { useT } from '../../i18n'
import type { Task, Status } from '../../types'

interface Column {
  id: Status
  label: string
  color: string
  dotColor: string
}

interface TaskColumnProps {
  column: Column
  tasks: Task[]
  onAddTask: (status: Status) => void
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onFocusTask?: (task: Task) => void
  onRenameColumn?: (status: Status, label: string) => void
}

const COLUMN_STYLES: Record<Status, {
  header: string; badge: string; dot: string; dropBg: string; emptyIcon: React.ElementType; emptyColor: string
}> = {
  todo:        { header: 'text-slate-700 dark:text-slate-300',   badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',    dot: 'bg-slate-400',   dropBg: 'bg-slate-50 dark:bg-slate-800/40',      emptyIcon: CircleDot,    emptyColor: 'text-slate-300' },
  in_progress: { header: 'text-blue-700 dark:text-blue-400',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500',    dropBg: 'bg-blue-50/40 dark:bg-blue-900/10',     emptyIcon: Loader2,      emptyColor: 'text-blue-200' },
  in_review:   { header: 'text-violet-700 dark:text-violet-400',  badge: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',   dot: 'bg-violet-500',  dropBg: 'bg-violet-50/40 dark:bg-violet-900/10', emptyIcon: Eye,          emptyColor: 'text-violet-200' },
  done:        { header: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', dropBg: 'bg-emerald-50/30 dark:bg-emerald-900/10', emptyIcon: CheckCircle2, emptyColor: 'text-emerald-200' },
}

const TaskColumn = memo(function TaskColumn({
  column, tasks, onAddTask, onEditTask, onViewTask, onFocusTask, onRenameColumn,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const t = useT()
  const s = COLUMN_STYLES[column.id]
  const EmptyIcon = s.emptyIcon

  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(column.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEdit = () => {
    setDraftLabel(column.label)
    setEditing(true)
  }

  const commitEdit = () => {
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== column.label) {
      onRenameColumn?.(column.id, trimmed)
    }
    setEditing(false)
  }

  const cancelEdit = () => {
    setDraftLabel(column.label)
    setEditing(false)
  }

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
          {editing ? (
            <input
              ref={inputRef}
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              className={cn(
                'text-sm font-semibold bg-transparent border-b-2 border-indigo-400 outline-none w-full min-w-0',
                s.header
              )}
            />
          ) : (
            <span
              className={cn('text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity truncate', s.header)}
              onDoubleClick={startEdit}
              title="Double-click to rename"
            >
              {column.label}
            </span>
          )}
          <span className={cn('inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold shrink-0', s.badge)}>
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost" size="icon" className="w-7 h-7 shrink-0"
          onClick={() => onAddTask(column.id)}
          aria-label={`Add task to ${column.label}`}
        >
          <Plus size={14} />
        </Button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-col gap-2.5 min-h-[200px] rounded-xl p-2 transition-colors duration-200',
          isOver
            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700'
            : s.dropBg
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id} task={task}
              onEdit={onEditTask} onView={onViewTask} onFocus={onFocusTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
            <EmptyIcon size={24} className={cn('opacity-40', s.emptyColor)} />
            <button
              onClick={() => onAddTask(column.id)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <Plus size={11} /> {t.header.newTask}
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export default TaskColumn
