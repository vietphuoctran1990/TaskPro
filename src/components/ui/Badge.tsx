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

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' },
  medium: { label: 'Medium', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  high: { label: 'High', className: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' },
  urgent: { label: 'Urgent', className: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}
