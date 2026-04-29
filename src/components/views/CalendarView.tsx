import { memo, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn, getSLAStatus } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import type { Task } from '../../types'
import Button from '../ui/Button'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SLA_DOT: Record<string, string> = {
  breached: 'bg-red-500',
  critical: 'bg-orange-500',
  at_risk:  'bg-amber-400',
  on_track: 'bg-emerald-500',
  completed:'bg-slate-300',
  none:     'bg-indigo-400',
}

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  medium: 'border-l-blue-400',
  low:    'border-l-slate-300',
}

interface CalendarViewProps {
  onViewTask: (task: Task) => void
  onAddTask: (date: string) => void
}

const CalendarView = memo(function CalendarView({ onViewTask, onAddTask }: CalendarViewProps) {
  const { state } = useApp()
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()
    const cells: { date: Date; current: boolean }[] = []

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), current: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), current: true })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), current: false })
    }
    return cells
  }, [year, month])

  // Map tasks to date strings
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    const source = state.activeProjectId
      ? state.tasks.filter(t => t.projectId === state.activeProjectId)
      : state.tasks
    source.forEach(task => {
      if (task.dueDate) {
        const existing = map.get(task.dueDate) ?? []
        map.set(task.dueDate, [...existing, task])
      }
    })
    return map
  }, [state.tasks, state.activeProjectId])

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()

  const dateKey = (d: Date) => d.toISOString().slice(0, 10)

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // SLA summary counts
  const slaStats = useMemo(() => {
    const tasks = state.activeProjectId
      ? state.tasks.filter(t => t.projectId === state.activeProjectId)
      : state.tasks
    return {
      breached: tasks.filter(t => getSLAStatus(t) === 'breached').length,
      critical: tasks.filter(t => getSLAStatus(t) === 'critical').length,
      at_risk:  tasks.filter(t => getSLAStatus(t) === 'at_risk').length,
    }
  }, [state.tasks, state.activeProjectId])

  return (
    <div className="flex flex-col gap-4">
      {/* SLA summary pills */}
      {(slaStats.breached + slaStats.critical + slaStats.at_risk) > 0 && (
        <div className="flex flex-wrap gap-2">
          {slaStats.breached > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {slaStats.breached} SLA Breached
            </span>
          )}
          {slaStats.critical > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {slaStats.critical} Critical
            </span>
          )}
          {slaStats.at_risk > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {slaStats.at_risk} At Risk
            </span>
          )}
        </div>
      )}

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {days.map((cell, i) => {
            const key = dateKey(cell.date)
            const tasks = tasksByDate.get(key) ?? []
            const todayCell = isToday(cell.date)
            const isPast = cell.date < today && !todayCell

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] border-r border-b border-slate-100 p-1.5 transition-colors',
                  !cell.current && 'bg-slate-50/60',
                  cell.current && 'hover:bg-slate-50/80 cursor-pointer'
                )}
                onClick={() => cell.current && tasks.length === 0 && onAddTask(key)}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                    todayCell
                      ? 'bg-indigo-600 text-white'
                      : !cell.current
                      ? 'text-slate-300'
                      : isPast
                      ? 'text-slate-400'
                      : 'text-slate-700'
                  )}>
                    {cell.date.getDate()}
                  </span>
                  {cell.current && tasks.length === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); onAddTask(key) }}
                      className="opacity-0 hover:opacity-100 text-slate-300 hover:text-indigo-500 transition-opacity group-hover:opacity-100"
                      aria-label="Add task"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-0.5">
                  {tasks.slice(0, 3).map(task => {
                    const sla = getSLAStatus(task)
                    return (
                      <button
                        key={task.id}
                        onClick={e => { e.stopPropagation(); onViewTask(task) }}
                        className={cn(
                          'w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1 border-l-2 transition-colors',
                          'bg-white hover:bg-indigo-50 shadow-sm border border-slate-100',
                          PRIORITY_BORDER[task.priority],
                          task.status === 'done' && 'opacity-50 line-through'
                        )}
                        title={task.title}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', SLA_DOT[sla])} />
                        <span className="truncate text-slate-700 font-medium">{task.title}</span>
                        {task.dueTime && (
                          <span className="shrink-0 text-slate-400">{task.dueTime}</span>
                        )}
                      </button>
                    )
                  })}
                  {tasks.length > 3 && (
                    <button
                      className="w-full text-left px-1.5 py-0.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                      onClick={e => { e.stopPropagation(); onViewTask(tasks[3]) }}
                    >
                      +{tasks.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500">
          {Object.entries({ 'Breached': 'bg-red-500', 'Critical': 'bg-orange-500', 'At Risk': 'bg-amber-400', 'On Track': 'bg-emerald-500' }).map(([label, cls]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', cls)} /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})

export default CalendarView
