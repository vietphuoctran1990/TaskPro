import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'
import { cn, getDeadline, getSLAStatus, getTimeRemaining } from '../../lib/utils'
import type { Task, SLAStatus } from '../../types'

const CONFIG: Record<SLAStatus, {
  label: string
  className: string
  icon: React.ElementType
}> = {
  on_track:  { label: 'On Track',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200',  icon: CheckCircle2 },
  at_risk:   { label: 'At Risk',   className: 'bg-amber-50 text-amber-700 border-amber-200',         icon: AlertTriangle },
  critical:  { label: 'Critical',  className: 'bg-orange-50 text-orange-700 border-orange-200',      icon: Zap },
  breached:  { label: 'Breached',  className: 'bg-red-50 text-red-700 border-red-200',               icon: AlertTriangle },
  completed: { label: 'Completed', className: 'bg-slate-50 text-slate-500 border-slate-200',         icon: CheckCircle2 },
  none:      { label: 'No SLA',    className: 'bg-slate-50 text-slate-400 border-slate-200',         icon: Clock },
}

interface SLABadgeProps {
  task: Task
  showTimer?: boolean
  size?: 'sm' | 'md'
}

export default function SLABadge({ task, showTimer = false, size = 'sm' }: SLABadgeProps) {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const status = getSLAStatus(task)
  const deadline = getDeadline(task)
  const cfg = CONFIG[status]
  const Icon = cfg.icon
  const overdue = deadline && deadline.getTime() < Date.now()

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
