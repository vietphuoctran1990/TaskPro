import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import TaskColumn, { type ColumnDef } from './TaskColumn'
import TaskCard from './TaskCard'
import type { Task } from '../../types'

interface TaskBoardProps {
  onAddTask: (statusId: string) => void
  onEditTask: (task: Task) => void
  onViewTask: (task: Task) => void
  onFocusTask?: (task: Task) => void
}

export default function TaskBoard({ onAddTask, onEditTask, onViewTask, onFocusTask }: TaskBoardProps) {
  const { state, filteredTasks, dispatch } = useApp()
  const t = useT()

  const i18nStatus = t.status as Record<string, string>

  const COLUMNS = useMemo((): ColumnDef[] =>
    [...state.statuses]
      .sort((a, b) => a.order - b.order)
      .map(s => ({
        id: s.id,
        label: s.name || i18nStatus[s.id] || s.id,
        color: s.color,
        isFinal: s.isFinal,
        wipLimit: s.wipLimit ?? null,
      })),
  [state.statuses, i18nStatus])

  const handleRenameColumn = useCallback((statusId: string, label: string) => {
    const def = state.statuses.find(s => s.id === statusId)
    if (def) dispatch({ type: 'UPDATE_STATUS', payload: { ...def, name: label } })
  }, [dispatch, state.statuses])
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {}
    COLUMNS.forEach(c => { map[c.id] = [] })
    filteredTasks.forEach(task => {
      if (map[task.status] !== undefined) map[task.status].push(task)
      // tasks with obsolete/unknown status silently go to first column
      else if (COLUMNS.length > 0) map[COLUMNS[0].id].push(task)
    })
    return map
  }, [filteredTasks, COLUMNS])

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const task = filteredTasks.find(t => t.id === active.id)
      setActiveTask(task ?? null)
    },
    [filteredTasks]
  )

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return
      const activeId = active.id as string
      const overId = over.id as string

      const activeTask = filteredTasks.find(t => t.id === activeId)
      if (!activeTask) return

      // Check if dropped on a column
      const overColumn = COLUMNS.find(c => c.id === overId)
      if (overColumn && activeTask.status !== overColumn.id) {
        dispatch({ type: 'MOVE_TASK', payload: { id: activeId, status: overColumn.id } })
      }
    },
    [filteredTasks, dispatch, COLUMNS]
  )

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveTask(null)
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string
      if (activeId === overId) return

      const activeTask = filteredTasks.find(t => t.id === activeId)
      const overTask = filteredTasks.find(t => t.id === overId)

      if (!activeTask) return

      if (overTask && activeTask.status === overTask.status) {
        // Reorder within same column
        const columnTasks = tasksByStatus[activeTask.status]
        const oldIndex = columnTasks.findIndex(t => t.id === activeId)
        const newIndex = columnTasks.findIndex(t => t.id === overId)
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex)
          // Merge into full state.tasks to preserve tasks hidden by active filters
          const reorderedIdSet = new Set(reordered.map(t => t.id))
          const outsideTasks = state.tasks.filter(t => !reorderedIdSet.has(t.id))
          dispatch({ type: 'REORDER_TASKS', payload: [...outsideTasks, ...reordered] })
        }
      } else if (overTask && activeTask.status !== overTask.status) {
        dispatch({ type: 'MOVE_TASK', payload: { id: activeId, status: overTask.status } })
      }
    },
    [filteredTasks, tasksByStatus, dispatch]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory sm:snap-none scroll-px-4">

        {COLUMNS.map(col => (
          <TaskColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus[col.id]}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onViewTask={onViewTask}
            onFocusTask={onFocusTask}
            onRenameColumn={handleRenameColumn}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90">
            <TaskCard
              task={activeTask}
              onEdit={() => {}}
              onView={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
