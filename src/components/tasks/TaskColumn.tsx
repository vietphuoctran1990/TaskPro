import { memo, useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import TaskCard from './TaskCard'
import Button from '../ui/Button'
import { useT } from '../../i18n'
import type { Task } from '../../types'

export interface ColumnDef {
  id: string
  label: string
  color: string      // hex
  isFinal: boolean
}

interface TaskColumnProps {
  column: ColumnDef
  tasks: Task[]
  onAddTask: (statusId: string) => void
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onFocusTask?: (task: Task) => void
  onRenameColumn?: (statusId: string, label: string) => void
}

const TaskColumn = memo(function TaskColumn({
  column, tasks, onAddTask, onEditTask, onViewTask, onFocusTask, onRenameColumn,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const t = useT()

  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(column.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startEdit = () => { setDraftLabel(column.label); setEditing(true) }
  const commitEdit = () => {
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== column.label) onRenameColumn?.(column.id, trimmed)
    setEditing(false)
  }
  const cancelEdit = () => { setDraftLabel(column.label); setEditing(false) }

  // Derive subtle tints from the column color
  const dot = { backgroundColor: column.color }
  const badge = { backgroundColor: `${column.color}22`, color: column.color }
  const dropBg = isOver
    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700'
    : 'bg-slate-100/60 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/40'

  const EmptyIcon = column.isFinal ? CheckCircle2 : Plus

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={dot} />
          {editing ? (
            <input
              ref={inputRef}
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
              className="text-sm font-semibold bg-transparent border-b-2 border-indigo-400 outline-none w-full min-w-0 text-slate-700 dark:text-slate-200"
            />
          ) : (
            <span
              className="text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity truncate text-slate-700 dark:text-slate-200"
              onDoubleClick={startEdit}
              title="Double-click to rename"
            >
              {column.label}
            </span>
          )}
          <span
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold shrink-0"
            style={badge}
          >
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
          dropBg
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
            <EmptyIcon size={24} className="opacity-25 text-slate-400" />
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
