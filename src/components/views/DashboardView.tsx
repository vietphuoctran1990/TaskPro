import { memo, useMemo } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Clock, FileText, StickyNote, TrendingUp, BarChart3 } from 'lucide-react'
import { cn, getDeadline, getSLAStatus, getTimeRemaining } from '../../lib/utils'
import { localISO, todayLocalISO } from '../../lib/dateLocal'
import SLABadge from '../sla/SLABadge'
import { PriorityBadge } from '../ui/Badge'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Note, Task } from '../../types'
import type { Translations } from '../../i18n/types'
import Button from '../ui/Button'

interface DashboardViewProps {
  onViewTask: (task: Task) => void
  onAddTask: () => void
  onViewNote?: (note: Note) => void
}

function DonutChart({ pct, color, darkMode }: { pct: number; color: string; darkMode?: boolean }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const trackColor = darkMode ? '#334155' : '#f1f5f9'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke={trackColor} strokeWidth="9" />
      <circle
        cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="44" y="48" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  )
}

function StatCard({
  label, value, sub, gradient, iconBg, icon,
}: {
  label: string; value: number | string; sub?: string
  gradient: string; iconBg: string; icon: React.ReactNode
}) {
  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-4', gradient)}>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function WeeklyTrend({ tasks, finalStatusIds, t }: { tasks: Task[]; finalStatusIds: ReadonlySet<string>; language?: string; t: Translations }) {
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (3 - i) * 7)
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
    const startStr = localISO(weekStart)
    const endStr   = localISO(weekEnd)
    const done  = tasks.filter(t => finalStatusIds.has(t.status) && t.updatedAt.slice(0, 10) >= startStr && t.updatedAt.slice(0, 10) <= endStr).length
    const total = tasks.filter(t => t.createdAt.slice(0, 10) >= startStr && t.createdAt.slice(0, 10) <= endStr).length
    const label = t.dashboard.week(i + 1)
    const isCurrent = i === 3
    return { label, done, total, isCurrent }
  })
  const maxDone = Math.max(...weeks.map(w => w.done), 1)
  return (
    <div className="space-y-3">
      {weeks.map(({ label, done, total, isCurrent }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn('text-xs font-medium', isCurrent ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400')}>{label}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{done} {t.dashboard.done(done)} / {total} {t.dashboard.tasks(total)}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(done / maxDone) * 100}%`,
                background: isCurrent ? 'linear-gradient(to right, #6366f1, #8b5cf6)' : 'linear-gradient(to right, #a5b4fc, #c4b5fd)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const PRIORITY_META = [
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
  { key: 'high',   label: 'High',   color: '#f97316' },
  { key: 'medium', label: 'Medium', color: '#3b82f6' },
  { key: 'low',    label: 'Low',    color: '#94a3b8' },
] as const

function PriorityBreakdown({ tasks, finalStatusIds }: { tasks: Task[]; finalStatusIds: ReadonlySet<string> }) {
  return (
    <div className="space-y-3">
      {PRIORITY_META.map(({ key, label, color }) => {
        const all  = tasks.filter(t => t.priority === key)
        const done = all.filter(t => finalStatusIds.has(t.status)).length
        const pct  = all.length ? Math.round((done / all.length) * 100) : 0
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{done}/{all.length} · {pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DashboardView = memo(function DashboardView({ onViewTask, onAddTask, onViewNote }: DashboardViewProps) {
  const { state, filteredTasks, finalStatusIds } = useApp()
  const t = useT()

  const today = todayLocalISO()

  const stats = useMemo(() => {
    const total      = filteredTasks.length
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length
    const doneTotal  = filteredTasks.filter(t => finalStatusIds.has(t.status)).length
    const doneToday  = filteredTasks.filter(t => finalStatusIds.has(t.status) && t.updatedAt.slice(0, 10) === today).length
    const breached   = filteredTasks.filter(t => getSLAStatus(t, finalStatusIds) === 'breached').length
    return { total, inProgress, doneTotal, doneToday, breached }
  }, [filteredTasks, finalStatusIds, today])

  const slaHealth = useMemo(() => {
    const nonDone = filteredTasks.filter(t => !finalStatusIds.has(t.status))
    if (!nonDone.length) return { pct: 100, onTrack: 0, atRisk: 0, critical: 0, breached: 0 }
    const onTrack  = nonDone.filter(t => getSLAStatus(t, finalStatusIds) === 'on_track').length
    const atRisk   = nonDone.filter(t => getSLAStatus(t, finalStatusIds) === 'at_risk').length
    const critical = nonDone.filter(t => getSLAStatus(t, finalStatusIds) === 'critical').length
    const breached = nonDone.filter(t => getSLAStatus(t, finalStatusIds) === 'breached').length
    return { pct: Math.round((onTrack / nonDone.length) * 100), onTrack, atRisk, critical, breached }
  }, [filteredTasks, finalStatusIds])

  const noteStats = useMemo(() => {
    const total   = state.notes.length
    const todayN  = state.notes.filter(n => n.updatedAt.slice(0, 10) === today).length
    const folders = state.noteFolders.length
    return { total, todayN, folders }
  }, [state.notes, state.noteFolders, today])

  const recentNotes = useMemo(() =>
    [...state.notes]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 4),
    [state.notes]
  )

  const weekData = useMemo(() => {
    const locale = state.language === 'vi' ? 'vi-VN' : 'en-US'
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dayStr = localISO(d)
      const count  = filteredTasks.filter(t => finalStatusIds.has(t.status) && t.updatedAt.slice(0, 10) === dayStr).length
      const label  = d.toLocaleDateString(locale, { weekday: 'short' })
      const isToday = dayStr === today
      return { label, count, isToday }
    })
  }, [filteredTasks, finalStatusIds, state.language, today])
  const maxWeek = Math.max(...weekData.map(d => d.count), 1)

  const upcoming = useMemo(() =>
    filteredTasks
      .filter(t => !finalStatusIds.has(t.status) && getDeadline(t))
      .sort((a, b) => getDeadline(a)!.getTime() - getDeadline(b)!.getTime())
      .slice(0, 6),
    [filteredTasks, finalStatusIds]
  )

  const projectStats = useMemo(() =>
    state.projects
      .map(p => {
        const tasks = filteredTasks.filter(t => t.projectId === p.id)
        const done  = tasks.filter(t => finalStatusIds.has(t.status)).length
        return { project: p, total: tasks.length, done }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total),
    [state.projects, filteredTasks, finalStatusIds]
  )

  const donutColor =
    slaHealth.pct >= 80 ? '#10b981' :
    slaHealth.pct >= 50 ? '#f59e0b' : '#ef4444'

  const isDark = state.darkMode

  return (
    <div className="space-y-4 pb-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t.dashboard.totalTasks} value={stats.total} sub={t.dashboard.done(stats.doneTotal)}
          gradient="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border-indigo-100 dark:border-indigo-800"
          iconBg="bg-gradient-to-br from-indigo-500 to-violet-600"
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          label={t.dashboard.inProgress} value={stats.inProgress}
          gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-100 dark:border-blue-800"
          iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label={t.dashboard.completedToday} value={stats.doneToday}
          gradient="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-100 dark:border-emerald-800"
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-500"
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard
          label={t.dashboard.slaBreached} value={stats.breached}
          gradient="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
          iconBg="bg-gradient-to-br from-red-500 to-orange-500"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      {/* Notes overview */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shrink-0">
              <StickyNote size={15} />
            </div>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t.dashboard.notesSection}</h3>
          </div>
          {recentNotes.length > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">{t.dashboard.recentNotes}</span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 3 mini-stats */}
          <div className="grid grid-cols-3 gap-3 sm:w-56 shrink-0">
            {[
              { label: t.dashboard.totalNotes,   value: noteStats.total   },
              { label: t.dashboard.notesToday,   value: noteStats.todayN  },
              { label: t.dashboard.notesFolders, value: noteStats.folders },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/70 dark:bg-slate-800/50 rounded-xl p-2.5 text-center">
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 leading-none">{value}</p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-500 mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>
          {/* Recent notes list */}
          {recentNotes.length > 0 ? (
            <div className="flex-1 min-w-0 space-y-1.5">
              {recentNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => onViewNote?.(note)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/50 text-left transition-colors',
                    onViewNote ? 'hover:bg-white dark:hover:bg-slate-700/80 cursor-pointer' : 'cursor-default'
                  )}
                >
                  <FileText size={12} className="text-amber-500 shrink-0" />
                  <span className="flex-1 text-xs font-medium text-amber-800 dark:text-amber-300 truncate">
                    {note.title || t.dashboard.untitledNote}
                  </span>
                  <span className="text-[10px] text-amber-500/70 dark:text-amber-600 shrink-0">
                    {note.updatedAt.slice(5, 10).replace('-', '/')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-3">
              <p className="text-xs text-amber-500/70 dark:text-amber-600">
                {state.language === 'vi' ? 'Chưa có ghi chú nào' : 'No notes yet'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly activity + SLA health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly bar chart with gradient bars */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t.dashboard.weeklyActivity}</h3>
          <div className="flex items-end gap-2 h-28">
            {weekData.map(({ label, count, isToday }, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600 min-h-[1rem]">
                  {count > 0 ? count : ''}
                </span>
                <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: '72px' }}>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max((count / maxWeek) * 72, count > 0 ? 8 : 4)}px`,
                      background: count === 0
                        ? (isDark ? '#334155' : '#f1f5f9')
                        : isToday
                          ? 'linear-gradient(to top, #6366f1, #8b5cf6)'
                          : 'linear-gradient(to top, #a5b4fc, #c4b5fd)',
                    }}
                  />
                </div>
                <span className={cn('text-xs', isToday ? 'text-indigo-600 font-semibold' : 'text-slate-400')}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SLA health with donut chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t.dashboard.slaHealth}</h3>
          <div className="flex items-center gap-5 mb-3">
            <DonutChart pct={slaHealth.pct} color={donutColor} darkMode={isDark} />
            <div className="flex-1 space-y-1.5">
              {[
                { label: t.dashboard.onTrack,     value: slaHealth.onTrack,  cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' },
                { label: t.dashboard.atRisk,      value: slaHealth.atRisk,   cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
                { label: t.dashboard.critical,    value: slaHealth.critical, cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
                { label: t.dashboard.slaBreached, value: slaHealth.breached, cls: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className={cn('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium', cls)}>
                  <span>{label}</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming deadlines + project breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              {t.dashboard.upcomingDeadlines}
            </h3>
            <Button variant="ghost" size="sm" onClick={onAddTask}>+ {t.header.newTask}</Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-xs">{t.dashboard.noDeadlines}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {upcoming.map(task => {
                const deadline = getDeadline(task)!
                const overdue  = deadline.getTime() < Date.now()
                return (
                  <button
                    key={task.id}
                    className="w-full flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                    onClick={() => onViewTask(task)}
                  >
                    <div className={cn(
                      'mt-1 w-2 h-2 rounded-full shrink-0',
                      overdue ? 'bg-red-500' : getSLAStatus(task, finalStatusIds) === 'critical' ? 'bg-orange-500' : 'bg-amber-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <PriorityBadge priority={task.priority} />
                        <span className={cn('text-xs', overdue ? 'text-red-600 font-medium' : 'text-slate-400')}>
                          <Calendar size={10} className="inline mr-0.5" />
                          {overdue ? '+' : ''}{getTimeRemaining(deadline)}
                        </span>
                      </div>
                    </div>
                    <SLABadge task={task} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.dashboard.projectBreakdown}</h3>
          </div>
          {projectStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">{t.list.noTasks}</div>
          ) : (
            <div className="px-5 py-3 space-y-3">
              {projectStats.map(({ project, total, done }) => {
                const pct = total ? Math.round((done / total) * 100) : 0
                return (
                  <div key={project.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{done}/{total} · {pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: project.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      {/* ── Reports ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 4-week trend */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t.dashboard.monthlyTrend}</h3>
          <WeeklyTrend tasks={filteredTasks} finalStatusIds={finalStatusIds} language={state.language} t={t} />
        </div>
        {/* Priority breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{t.dashboard.byPriority}</h3>
          <PriorityBreakdown tasks={filteredTasks} finalStatusIds={finalStatusIds} />
        </div>
      </div>
    </div>
  )
})

export default DashboardView
