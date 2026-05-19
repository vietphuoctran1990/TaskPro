import { useState } from 'react'
import { Check, X } from 'lucide-react'

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
]

interface InlineCreateProps {
  placeholder: string
  submitLabel?: string
  onAdd: (name: string, color: string) => void
  onCancel: () => void
}

export default function InlineCreate({ placeholder, submitLabel = 'Add', onAdd, onCancel }: InlineCreateProps) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, color)
  }

  return (
    <div className="mt-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-900/20 space-y-2.5">
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel() }}
        className="h-8 w-full px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button
            key={c} type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
            style={{ backgroundColor: c, borderColor: color === c ? '#fff' : c, outline: color === c ? `2px solid ${c}` : 'none' }}
          >
            {color === c && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button" onClick={handleAdd}
          className="flex-1 h-7 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
          disabled={!name.trim()}
        >
          {submitLabel}
        </button>
        <button
          type="button" onClick={onCancel} aria-label="Cancel"
          className="h-7 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
