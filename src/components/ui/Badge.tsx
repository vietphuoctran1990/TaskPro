import { cn } from '../../lib/utils'
import type { Priority } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  color?: string
}

export function Badge({ children, className, color }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {children}
    </span>
  )
}

const priorityConfig: Record<Priority, { label: string; className: string; dot: string }> = {
  low:    { label: 'Low',    className: 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400', dot: '#94a3b8' },
  medium: { label: 'Medium', className: 'bg-blue-50  dark:bg-blue-900/40  text-blue-700  dark:text-blue-400',  dot: '#3b82f6' },
  high:   { label: 'High',   className: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400', dot: '#f97316' },
  urgent: { label: 'Urgent', className: 'bg-red-50   dark:bg-red-900/40   text-red-700   dark:text-red-400',   dot: '#ef4444' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.className)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}
