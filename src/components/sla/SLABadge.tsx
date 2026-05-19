import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'
import { cn, getDeadline, getSLAStatus, getTimeRemaining } from '../../lib/utils'
import { useT } from '../../i18n'
import { useNow } from '../../hooks/useNow'
import type { Task, SLAStatus } from '../../types'

interface SLABadgeProps {
  task: Task
  showTimer?: boolean
  size?: 'sm' | 'md'
}

export default function SLABadge({ task, showTimer = false, size = 'sm' }: SLABadgeProps) {
  const t = useT()
  const now = useNow()

  const status = getSLAStatus(task)
  const deadline = getDeadline(task)
  const overdue = deadline && deadline.getTime() < now

  const CONFIG: Record<SLAStatus, { label: string; className: string; icon: React.ElementType }> = {
    on_track:  { label: t.sla.on_track,  className: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',  icon: CheckCircle2 },
    at_risk:   { label: t.sla.at_risk,   className: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',         icon: AlertTriangle },
    critical:  { label: t.sla.critical,  className: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',      icon: Zap },
    breached:  { label: t.sla.breached,  className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',               icon: AlertTriangle },
    completed: { label: t.sla.completed, className: 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',         icon: CheckCircle2 },
    none:      { label: t.sla.none,      className: 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700',         icon: Clock },
  }

  const cfg = CONFIG[status]
  const Icon = cfg.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        cfg.className
      )}
    >
      <Icon size={size === 'sm' ? 10 : 12} />
      <span>{cfg.label}</span>
      {showTimer && deadline && status !== 'completed' && status !== 'none' && (
        <span className="opacity-75">
          {overdue ? '+ ' : '− '}
          {getTimeRemaining(deadline)}
        </span>
      )}
    </span>
  )
}
