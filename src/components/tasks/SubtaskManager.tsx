import { useState } from 'react'
import { Check, Trash2, Plus } from 'lucide-react'
import { useT } from '../../i18n'
import type { Subtask } from '../../types'

interface SubtaskManagerProps {
  subtasks: Subtask[]
  onChange: (subtasks: Subtask[]) => void
}

export function SubtaskManager({ subtasks, onChange }: SubtaskManagerProps) {
  const t = useT()
  const [newSubtask, setNewSubtask] = useState('')

  const addSubtask = () => {
    const title = newSubtask.trim()
    if (!title) return
    onChange([...subtasks, { id: crypto.randomUUID(), title, done: false }])
    setNewSubtask('')
  }

  const toggleSubtask = (id: string) =>
    onChange(subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s))

  const removeSubtask = (id: string) =>
    onChange(subtasks.filter(s => s.id !== id))

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.detail.subtasks}</span>
      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map(s => (
            <div key={s.id} className="flex items-center gap-2 group">
              <button type="button" onClick={() => toggleSubtask(s.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  s.done ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'
                }`}>
                {s.done && <Check size={10} className="text-white" strokeWidth={3} />}
              </button>
              <span className={`flex-1 text-sm ${s.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {s.title}
              </span>
              <button type="button" onClick={() => removeSubtask(s.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
          placeholder={t.detail.addSubtask}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
          className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="button" onClick={addSubtask}
          disabled={!newSubtask.trim()}
          className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
