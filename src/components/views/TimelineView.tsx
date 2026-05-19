import { memo, useMemo, useRef } from 'react'
import { Pin } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Task } from '../../types'

interface TimelineViewProps {
  onViewTask: (task: Task) => void
  onAddTask: () => void
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_W  = 40 // px per day column
const DAYS_BACK = 7
const DAYS_TOTAL = 35 // 7 back + 28 forward

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS)
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS)
}

const TimelineView = memo(function TimelineView({ onViewTask, onAddTask }: TimelineViewProps) {
  const { state, dispatch, filteredTasks, finalStatusIds } = useApp()
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)

  const today      = startOfDay(new Date())
  const rangeStart = addDays(today, -DAYS_BACK)
  const days       = Array.from({ length: DAYS_TOTAL }, (_, i) => addDays(rangeStart, i))

  // Group tasks by project (only tasks with dueDate)
  const projectGroups = useMemo(() => {
    const withDate = filteredTasks.filter(t => t.dueDate)
    return state.projects
      .map(p => ({ project: p, tasks: withDate.filter(t => t.projectId === p.id) }))
      .filter(g => g.tasks.length > 0)
  }, [filteredTasks, state.projects])

  if (projectGroups.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm py-16 flex flex-col items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-20">
          <rect x="4"  y="28" width="24" height="8" rx="4" fill="#6366f1"/>
          <rect x="20" y="16" width="32" height="8" rx="4" fill="#8b5cf6"/>
          <rect x="12" y="40" width="28" height="8" rx="4" fill="#6366f1"/>
        </svg>
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{t.timeline.noTasks}</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">Thêm deadline cho công việc để hiển thị</p>
        </div>
        <button
          onClick={onAddTask}
          className="h-8 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-colors"
        >
          + {t.header.newTask}
        </button>
      </div>
    )
  }

  const todayOffset = DAYS_BACK * DAY_W // px from left to today line

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex">
        {/* Frozen left: project + task names */}
        <div className="shrink-0 w-48 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
          {/* Header placeholder */}
          <div className="h-10 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center px-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.list.task}</span>
          </div>
          {projectGroups.map(({ project, tasks }) => (
            <div key={project.id}>
              {/* Project header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/50">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">{project.name}</span>
              </div>
              {/* Task rows */}
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="h-10 flex items-center gap-1 px-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group/row"
                  onClick={() => onViewTask(task)}
                >
                  <span className={cn(
                    'flex-1 text-sm truncate',
                    finalStatusIds.has(task.status) ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {task.title}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_PIN_TASK', payload: task.id }) }}
                    className={cn(
                      'shrink-0 w-5 h-5 flex items-center justify-center rounded transition-all',
                      task.pinned
                        ? 'opacity-100 text-amber-500'
                        : 'opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-amber-500'
                    )}
                    title={task.pinned ? t.pin.unpin : t.pin.pin}
                  >
                    <Pin size={10} className={task.pinned ? 'fill-amber-400/60' : ''} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div style={{ width: DAYS_TOTAL * DAY_W, position: 'relative' }}>
            {/* Day headers */}
            <div className="flex h-10 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
              {days.map((d, i) => {
                const isToday  = d.getTime() === today.getTime()
                const isSunday = d.getDay() === 0
                const isSat    = d.getDay() === 6
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-none flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700/50 text-center',
                      isToday && 'bg-indigo-50 dark:bg-indigo-900/20',
                      (isSunday || isSat) && !isToday && 'bg-slate-100/60 dark:bg-slate-700/20'
                    )}
                    style={{ width: DAY_W }}
                  >
                    <span className={cn('text-[10px] font-medium leading-none',
                      isToday ? 'text-indigo-600' : 'text-slate-400 dark:text-slate-500'
                    )}>
                      {d.toLocaleDateString(state.language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'narrow' })}
                    </span>
                    <span className={cn(
                      'text-xs font-bold leading-none mt-0.5',
                      isToday ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-400'
                    )}>
                      {d.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Today vertical line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-indigo-400 z-20 pointer-events-none"
              style={{ left: todayOffset + DAY_W / 2 }}
            />

            {/* Task bars */}
            {projectGroups.map(({ project, tasks }) => (
              <div key={project.id}>
                {/* Project header row */}
                <div className="flex border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80" style={{ height: 33 }}>
                  {days.map((d, i) => (
                    <div key={i} className={cn(
                      'flex-none border-r border-slate-100 dark:border-slate-700/50',
                      (d.getDay() === 0 || d.getDay() === 6) && 'bg-slate-100/60 dark:bg-slate-700/20'
                    )} style={{ width: DAY_W }} />
                  ))}
                </div>
                {/* Task bar rows */}
                {tasks.map(task => {
                  const due = task.dueDate ? new Date(task.dueDate) : null
                  const created = new Date(task.createdAt)
                  if (!due) return null

                  const startDay = Math.max(0, daysBetween(created, rangeStart))
                  const endDay   = Math.min(DAYS_TOTAL - 1, daysBetween(due, rangeStart))
                  const barLeft  = startDay * DAY_W
                  const barWidth = Math.max(DAY_W, (endDay - startDay + 1) * DAY_W)
                  const isDone    = finalStatusIds.has(task.status)
                  const isOverdue = due < today && !isDone

                  return (
                    <div
                      key={task.id}
                      className="relative flex border-b border-slate-50 dark:border-slate-700/30"
                      style={{ height: 40 }}
                    >
                      {/* Background grid cells */}
                      {days.map((d, i) => (
                        <div key={i} className={cn(
                          'flex-none border-r border-slate-50 dark:border-slate-700/30',
                          (d.getDay() === 0 || d.getDay() === 6) && 'bg-slate-50/80 dark:bg-slate-700/10'
                        )} style={{ width: DAY_W }} />
                      ))}
                      {/* Bar */}
                      <div
                        className="absolute top-2 bottom-2 rounded-full flex items-center px-2.5 cursor-pointer transition-all hover:brightness-95 hover:shadow-sm overflow-hidden"
                        style={{
                          left: barLeft,
                          width: barWidth,
                          background: isDone
                            ? '#d1d5db'
                            : isOverdue
                              ? 'linear-gradient(to right, #ef4444, #f97316)'
                              : `linear-gradient(to right, ${project.color}cc, ${project.color})`,
                        }}
                        onClick={() => onViewTask(task)}
                        title={task.title}
                      >
                        <span className={cn(
                          'text-xs font-medium truncate',
                          isDone ? 'text-slate-500' : 'text-white'
                        )}>
                          {task.title}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-indigo-500 inline-block" />
          {t.list.task}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-400 inline-block" />
          Quá hạn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-slate-300 inline-block" />
          {t.status.done}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="w-px h-3 bg-indigo-400 inline-block" />
          {t.timeline.today}
        </span>
      </div>
    </div>
  )
})

export default TimelineView
