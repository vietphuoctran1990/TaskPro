import { Check, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export const COLORS = [
  '#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899',
  '#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4',
  '#84cc16','#e11d48','#7c3aed','#0891b2','#d97706',
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map(c => (
        <button
          key={c} type="button"
          className={cn('w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center',
            value === c && 'ring-2 ring-offset-1 ring-slate-500')}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        >
          {value === c && <Check size={12} className="text-white" />}
        </button>
      ))}
    </div>
  )
}

export function RowActions({
  onEdit, onDelete, confirm, onConfirm, onCancelConfirm, confirmLabel, canDelete = true,
}: {
  onEdit: () => void; onDelete: () => void; confirm: boolean
  onConfirm: () => void; onCancelConfirm: () => void
  confirmLabel: string; canDelete?: boolean
}) {
  return (
    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit}
        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
        <Pencil size={13} />
      </button>
      {canDelete && (confirm ? (
        <div className="flex items-center gap-1">
          <button onClick={onConfirm}
            className="p-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs font-medium px-2">
            {confirmLabel}
          </button>
          <button onClick={onCancelConfirm}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={13} />
          </button>
        </div>
      ) : (
        <button onClick={onDelete}
          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
          <Trash2 size={13} />
        </button>
      ))}
    </div>
  )
}
