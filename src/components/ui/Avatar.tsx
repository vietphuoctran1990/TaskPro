import { cn } from '../../lib/utils'

interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md'
  className?: string
}

export default function Avatar({ name, color = '#6366f1', size = 'sm', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0',
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm',
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
