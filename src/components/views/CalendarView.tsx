import { memo, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pin, Plus, X, Leaf } from 'lucide-react'
import { cn, getSLAStatus } from '../../lib/utils'
import { localISO } from '../../lib/dateLocal'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { getLunarInfo, type LunarInfo } from '../../lib/lunar'
import type { Task } from '../../types'
import Button from '../ui/Button'

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

const DOW_VI = ['CN','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7']

interface CalendarViewProps {
  onViewTask: (task: Task) => void
  onAddTask:  (date: string) => void
}

// ── Lunar day detail panel ────────────────────────────────────────────────────

function LunarPanel({
  date, lunar, tasks, onViewTask, onAddTask, onClose,
}: {
  date: Date
  lunar: LunarInfo
  tasks: Task[]
  onViewTask: (t: Task) => void
  onAddTask:  (d: string) => void
  onClose:    () => void
}) {
  const { state, finalStatusIds } = useApp()
  const isVi = state.language === 'vi'
  const dateKey = localISO(date)
  const dowLabel = DOW_VI[date.getDay()]
  const solarLabel = `${dowLabel}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
  const lunarLabel = `Ngày ${lunar.day} Tháng ${lunar.month}${lunar.leap ? ' (nhuận)' : ''} Năm ${lunar.canChiYear}`

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className={cn(
        'px-5 py-4 flex items-start justify-between',
        lunar.isHoangDao
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10'
          : 'bg-slate-50 dark:bg-slate-800/60',
      )}>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{solarLabel}</p>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{lunarLabel}</p>
          {lunar.tietKhi && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
              <Leaf size={10} />
              {lunar.tietKhi}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Left: Can Chi + Hoàng Đạo */}
        <div className="space-y-4">
          {/* Hoàng Đạo / Hắc Đạo */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Giờ & Thần</p>
            <div className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border',
              lunar.isHoangDao
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600',
            )}>
              <span className={cn('w-2 h-2 rounded-full', lunar.isHoangDao ? 'bg-emerald-500' : 'bg-slate-400')} />
              {lunar.than}
              <span className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full',
                lunar.isHoangDao ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300',
              )}>
                {lunar.isHoangDao ? 'Hoàng Đạo' : 'Hắc Đạo'}
              </span>
            </div>
          </div>

          {/* Can Chi */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Can Chi</p>
            <div className="space-y-1">
              {[
                { label: 'Ngày', value: lunar.canChiDay },
                { label: 'Tháng', value: lunar.canChiMonth },
                { label: 'Năm',   value: lunar.canChiYear },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-slate-400 dark:text-slate-500">{label}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Nên / Kỵ */}
        <div className="space-y-4">
          {lunar.nen.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-2">✓ Nên làm</p>
              <ul className="space-y-1">
                {lunar.nen.map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lunar.ky.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-2">✗ Nên tránh</p>
              <ul className="space-y-1">
                {lunar.ky.map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lunar.nen.length === 0 && lunar.ky.length === 0 && (
            <p className="text-sm text-slate-400 italic">Ngày bình thường, không có kiêng kỵ đặc biệt.</p>
          )}
        </div>
      </div>

      {/* Tasks on this day */}
      {tasks.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            {isVi ? `Công việc ngày này (${tasks.length})` : `Tasks (${tasks.length})`}
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => onViewTask(task)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left bg-slate-50 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', SLA_DOT[getSLAStatus(task, new Set())])} />
                <span className={cn('flex-1 truncate text-slate-700 dark:text-slate-300', finalStatusIds.has(task.status) && 'line-through opacity-50')}>
                  {task.title}
                </span>
                {task.dueTime && <span className="text-xs text-slate-400">{task.dueTime}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
        <Button size="sm" variant="primary" onClick={() => { onAddTask(dateKey); onClose() }}>
          <Plus size={13} /> {isVi ? 'Thêm công việc' : 'Add task'}
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const CalendarView = memo(function CalendarView({ onViewTask, onAddTask }: CalendarViewProps) {
  const { state, dispatch, finalStatusIds } = useApp()
  const t = useT()
  const today  = new Date()
  const [cursor,       setCursor]       = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()

  const days = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev  = new Date(year, month, 0).getDate()
    const cells: { date: Date; current: boolean; lunar: LunarInfo }[] = []

    for (let i = firstDay - 1; i >= 0; i--)
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), current: false, lunar: getLunarInfo(new Date(year, month - 1, daysInPrev - i)) })
    for (let d = 1; d <= daysInMonth; d++)
      cells.push({ date: new Date(year, month, d), current: true, lunar: getLunarInfo(new Date(year, month, d)) })
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++)
      cells.push({ date: new Date(year, month + 1, d), current: false, lunar: getLunarInfo(new Date(year, month + 1, d)) })
    return cells
  }, [year, month])

  // Project-scoped task list, computed once and shared by the date map + SLA stats.
  const projectTasks = useMemo(() =>
    state.activeProjectId
      ? state.tasks.filter(tk => tk.projectId === state.activeProjectId)
      : state.tasks,
    [state.tasks, state.activeProjectId])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    projectTasks.forEach(task => {
      if (task.dueDate) {
        const existing = map.get(task.dueDate)
        if (existing) existing.push(task)
        else map.set(task.dueDate, [task])
      }
    })
    return map
  }, [projectTasks])

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth()    === today.getMonth()    &&
    d.getDate()     === today.getDate()

  const isSelected = (d: Date) =>
    selectedDate !== null &&
    d.getFullYear() === selectedDate.getFullYear() &&
    d.getMonth()    === selectedDate.getMonth()    &&
    d.getDate()     === selectedDate.getDate()

  const dateKey = (d: Date) => localISO(d)

  const monthLabel = `${t.calendar.months[month]} ${year}`

  const slaStats = useMemo(() => {
    let breached = 0, critical = 0, at_risk = 0
    for (const tk of projectTasks) {
      switch (getSLAStatus(tk, finalStatusIds)) {
        case 'breached': breached++; break
        case 'critical': critical++; break
        case 'at_risk':  at_risk++; break
      }
    }
    return { breached, critical, at_risk }
  }, [projectTasks, finalStatusIds])

  const selectedLunar = selectedDate
    ? days.find(c => isSelected(c.date))?.lunar ?? getLunarInfo(selectedDate)
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* SLA summary pills */}
      {(slaStats.breached + slaStats.critical + slaStats.at_risk) > 0 && (
        <div className="flex flex-wrap gap-2">
          {slaStats.breached > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {slaStats.breached} {t.sla.slaBreached}
            </span>
          )}
          {slaStats.critical > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {slaStats.critical} {t.calendar.critical}
            </span>
          )}
          {slaStats.at_risk > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {slaStats.at_risk} {t.calendar.atRisk}
            </span>
          )}
        </div>
      )}

      {/* Calendar card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDate(null) }}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="secondary" size="sm"
              onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(null) }}>
              {t.calendar.today}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDate(null) }}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {t.calendar.days.map(d => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {days.map((cell, i) => {
            const key       = dateKey(cell.date)
            const cellTasks = tasksByDate.get(key) ?? []
            const todayCell = isToday(cell.date)
            const selCell   = isSelected(cell.date)
            const isPast    = cell.date < today && !todayCell
            const { lunar } = cell
            // Lunar first/15th day is visually notable
            const isSpecialLunar = lunar.day === 1 || lunar.day === 15

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[110px] border-r border-b border-slate-100 dark:border-slate-700/50 p-1.5 transition-colors cursor-pointer',
                  !cell.current && 'bg-slate-50/60 dark:bg-slate-800/50',
                  cell.current && !selCell && lunar.isHoangDao && 'hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10',
                  cell.current && !selCell && !lunar.isHoangDao && 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30',
                  selCell && 'bg-indigo-50/60 dark:bg-indigo-900/15 ring-2 ring-inset ring-indigo-300 dark:ring-indigo-600',
                )}
                onClick={() => {
                  if (!cell.current) return
                  if (selCell) { setSelectedDate(null) } else { setSelectedDate(cell.date) }
                }}
              >
                {/* Date number row */}
                <div className="flex items-start justify-between mb-0.5">
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                    todayCell
                      ? 'bg-indigo-600 text-white'
                      : !cell.current
                      ? 'text-slate-300 dark:text-slate-600'
                      : isPast
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-300',
                  )}>
                    {cell.date.getDate()}
                  </span>
                  {cell.current && cellTasks.length === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); onAddTask(key) }}
                      className="opacity-0 hover:opacity-100 text-slate-300 hover:text-indigo-500 transition-opacity"
                      aria-label={state.language === 'vi' ? 'Thêm công việc' : 'Add task'}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Lunar date row */}
                <div className="flex items-center gap-1 mb-1">
                  <span className={cn(
                    'text-[10px] leading-none font-medium',
                    !cell.current       ? 'text-slate-300 dark:text-slate-600'
                    : isSpecialLunar    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : lunar.isHoangDao  ? 'text-emerald-600 dark:text-emerald-500'
                    : 'text-slate-400 dark:text-slate-500',
                  )}>
                    {lunar.day === 1 ? `${lunar.day}/${lunar.month}${lunar.leap ? 'n' : ''}` : lunar.day}
                  </span>
                  {cell.current && (
                    <span className={cn(
                      'w-1 h-1 rounded-full shrink-0',
                      lunar.isHoangDao ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600',
                    )} />
                  )}
                  {cell.current && lunar.tietKhi && (
                    <span className="text-[9px] leading-none text-amber-600 dark:text-amber-400 font-medium truncate">
                      {lunar.tietKhi}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-0.5">
                  {cellTasks.slice(0, 3).map(task => {
                    const sla = getSLAStatus(task, finalStatusIds)
                    return (
                      <div key={task.id} className="relative group/pill">
                        <button
                          onClick={e => { e.stopPropagation(); onViewTask(task) }}
                          className={cn(
                            'w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1 border-l-2 transition-colors',
                            'bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 shadow-sm border border-slate-100 dark:border-slate-600',
                            PRIORITY_BORDER[task.priority],
                            finalStatusIds.has(task.status) && 'opacity-50 line-through',
                          )}
                          title={task.title}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', SLA_DOT[sla])} />
                          <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{task.title}</span>
                          {task.dueTime && (
                            <span className="shrink-0 text-slate-400 dark:text-slate-500">{task.dueTime}</span>
                          )}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_PIN_TASK', payload: task.id }) }}
                          className={cn(
                            'absolute right-0.5 top-0 bottom-0 flex items-center justify-center w-4 rounded transition-all z-10',
                            task.pinned
                              ? 'opacity-100 text-amber-500'
                              : 'opacity-0 group-hover/pill:opacity-100 text-slate-300 hover:text-amber-500',
                          )}
                          title={task.pinned ? t.pin.unpin : t.pin.pin}
                        >
                          <Pin size={8} className={task.pinned ? 'fill-amber-400/60' : ''} />
                        </button>
                      </div>
                    )
                  })}
                  {cellTasks.length > 3 && (
                    <button
                      className="w-full text-left px-1.5 py-0.5 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors"
                      onClick={e => { e.stopPropagation(); onViewTask(cellTasks[3]) }}
                    >
                      {t.calendar.more(cellTasks.length - 3)}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
          {([
            [t.calendar.breached, 'bg-red-500'],
            [t.calendar.critical, 'bg-orange-500'],
            [t.calendar.atRisk,   'bg-amber-400'],
            [t.calendar.onTrack,  'bg-emerald-500'],
          ] as [string, string][]).map(([label, cls]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', cls)} /> {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Hoàng Đạo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Hắc Đạo
          </span>
        </div>
      </div>

      {/* Lunar day detail panel */}
      {selectedDate && selectedLunar && (
        <LunarPanel
          date={selectedDate}
          lunar={selectedLunar}
          tasks={tasksByDate.get(dateKey(selectedDate)) ?? []}
          onViewTask={onViewTask}
          onAddTask={onAddTask}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
})

export default CalendarView
