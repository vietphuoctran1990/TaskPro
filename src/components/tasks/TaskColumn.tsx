import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import TaskCard from './TaskCard'
import Button from '../ui/Button'
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
}

const TaskColumn = memo(function TaskColumn({
  column,
  tasks,
  onAddTask,
  onEditTask,
  onViewTask,
  onFocusTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', column.dotColor)} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {column.label}
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
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
            : 'bg-slate-50 dark:bg-slate-800/40'
        )}
      >
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onView={onViewTask}
              onFocus={onFocusTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => onAddTask(column.id)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <Plus size={12} /> Add task
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export default TaskColumn
