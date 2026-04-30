import { memo, useMemo } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Clock, TrendingUp, BarChart3 } from 'lucide-react'
import { cn, getDeadline, getSLAStatus, getTimeRemaining } from '../../lib/utils'
import SLABadge from '../sla/SLABadge'
import { PriorityBadge } from '../ui/Badge'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Task } from '../../types'
import Button from '../ui/Button'

interface DashboardViewProps {
  onViewTask: (task: Task) => void
  onAddTask: () => void
}

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: number | string; sub?: string
  color: 'indigo' | 'blue' | 'emerald' | 'red'
  icon: React.ReactNode
}) {
  const colors = {
    indigo:  'bg-indigo-50 text-indigo-600',
    blue:    'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colors[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const DashboardView = memo(function DashboardView({ onViewTask, onAddTask }: DashboardViewProps) {
  const { state, filteredTasks } = useApp()
  const t = useT()

  const today = new Date().toISOString().slice(0, 10)

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total       = filteredTasks.length
    const inProgress  = filteredTasks.filter(t => t.status === 'in_progress').length
    const doneTotal   = filteredTasks.filter(t => t.status === 'done').length
    const doneToday   = filteredTasks.filter(t => t.status === 'done' && t.updatedAt.slice(0, 10) === today).length
    const breached    = filteredTasks.filter(t => getSLAStatus(t) === 'breached').length
    return { total, inProgress, doneTotal, doneToday, breached }
  }, [filteredTasks, today])

  // ── SLA health ───────────────────────────────────────────────────────────
  const slaHealth = useMemo(() => {
    const nonDone = filteredTasks.filter(t => t.status !== 'done')
    if (!nonDone.length) return { pct: 100, onTrack: 0, atRisk: 0, critical: 0, breached: 0 }
    const onTrack  = nonDone.filter(t => getSLAStatus(t) === 'on_track').length
    const atRisk   = nonDone.filter(t => getSLAStatus(t) === 'at_risk').length
    const critical = nonDone.filter(t => getSLAStatus(t) === 'critical').length
    const breached = nonDone.filter(t => getSLAStatus(t) === 'breached').length
    return { pct: Math.round((onTrack / nonDone.length) * 100), onTrack, atRisk, critical, breached }
  }, [filteredTasks])

  // ── Weekly activity (last 7 days) ─────────────────────────────────────────
  const weekData = useMemo(() => {
    const locale = state.language === 'vi' ? 'vi-VN' : 'en-US'
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dayStr = d.toISOString().slice(0, 10)
      const count  = filteredTasks.filter(t => t.status === 'done' && t.updatedAt.slice(0, 10) === dayStr).length
      const label  = d.toLocaleDateString(locale, { weekday: 'short' })
      const isToday = dayStr === today
      return { label, count, isToday }
    })
  }, [filteredTasks, state.language, today])
  const maxWeek = Math.max(...weekData.map(d => d.count), 1)

  // ── Upcoming deadlines ───────────────────────────────────────────────────
  const upcoming = useMemo(() =>
    filteredTasks
      .filter(t => t.status !== 'done' && getDeadline(t))
      .sort((a, b) => getDeadline(a)!.getTime() - getDeadline(b)!.getTime())
      .slice(0, 6),
    [filteredTasks]
  )

  // ── Project breakdown ────────────────────────────────────────────────────
  const projectStats = useMemo(() =>
    state.projects
      .map(p => {
        const tasks = filteredTasks.filter(t => t.projectId === p.id)
        const done  = tasks.filter(t => t.status === 'done').length
        return { project: p, total: tasks.length, done }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total),
    [state.projects, filteredTasks]
  )

  const healthColor =
    slaHealth.pct >= 80 ? 'text-emerald-600' :
    slaHealth.pct >= 50 ? 'text-amber-600' : 'text-red-600'

  const healthBarColor =
    slaHealth.pct >= 80 ? 'bg-emerald-500' :
    slaHealth.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-4 pb-4">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t.dashboard.totalTasks}      value={stats.total}      sub={t.dashboard.done(stats.doneTotal)}      color="indigo"  icon={<BarChart3 size={20} />} />
        <StatCard label={t.dashboard.inProgress}      value={stats.inProgress}                                               color="blue"    icon={<TrendingUp size={20} />} />
        <StatCard label={t.dashboard.completedToday}  value={stats.doneToday}                                               color="emerald" icon={<CheckCircle2 size={20} />} />
        <StatCard label={t.dashboard.slaBreached}     value={stats.breached}                                                color="red"     icon={<AlertTriangle size={20} />} />
      </div>

      {/* ── Weekly activity + SLA health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly bar chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">{t.dashboard.weeklyActivity}</h3>
          <div className="flex items-end gap-2 h-28">
            {weekData.map(({ label, count, isToday }, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600 min-h-[1rem]">
                  {count > 0 ? count : ''}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-all',
                      isToday ? 'bg-indigo-500' : 'bg-indigo-200',
                      count === 0 && 'bg-slate-100'
                    )}
                    style={{ height: `${Math.max((count / maxWeek) * 72, count > 0 ? 8 : 4)}px` }}
                  />
                </div>
                <span className={cn('text-xs', isToday ? 'text-indigo-600 font-semibold' : 'text-slate-400')}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SLA health */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">{t.dashboard.slaHealth}</h3>
          <div className="flex items-center gap-5 mb-4">
            <div className={cn('text-5xl font-bold tabular-nums', healthColor)}>
              {slaHealth.pct}%
            </div>
            <div className="flex-1">
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className={cn('h-full rounded-full transition-all', healthBarColor)}
                  style={{ width: `${slaHealth.pct}%` }} />
              </div>
              <p className="text-xs text-slate-400">
                {slaHealth.onTrack} {t.dashboard.onTrack} ·{' '}
                {slaHealth.atRisk} {t.dashboard.atRisk} ·{' '}
                {slaHealth.critical} {t.dashboard.critical}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t.dashboard.onTrack,  value: slaHealth.onTrack,  cls: 'bg-emerald-50 text-emerald-700' },
              { label: t.dashboard.atRisk,   value: slaHealth.atRisk,   cls: 'bg-amber-50 text-amber-700' },
              { label: t.dashboard.critical, value: slaHealth.critical, cls: 'bg-orange-50 text-orange-700' },
              { label: t.dashboard.slaBreached, value: slaHealth.breached, cls: 'bg-red-50 text-red-700' },
            ].map(({ label, value, cls }) => (
              <div key={label} className={cn('flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium', cls)}>
                <span>{label}</span>
                <span className="font-bold text-sm">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Upcoming deadlines + project breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming deadlines */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              {t.dashboard.upcomingDeadlines}
            </h3>
            <Button variant="ghost" size="sm" onClick={onAddTask}>+ {t.header.newTask}</Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <p className="text-xs">{t.dashboard.noDeadlines}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcoming.map(task => {
                const deadline = getDeadline(task)!
                const overdue  = deadline.getTime() < Date.now()
                return (
                  <button
                    key={task.id}
                    className="w-full flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => onViewTask(task)}
                  >
                    <div className={cn(
                      'mt-1 w-2 h-2 rounded-full shrink-0',
                      overdue ? 'bg-red-500' : getSLAStatus(task) === 'critical' ? 'bg-orange-500' : 'bg-amber-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
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

        {/* Project breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">{t.dashboard.projectBreakdown}</h3>
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
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {done}/{total} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
    </div>
  )
})

export default DashboardView
