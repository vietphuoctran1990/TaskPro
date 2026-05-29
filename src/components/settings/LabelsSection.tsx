import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Label } from '../../types'
import { COLORS, ColorPicker, RowActions } from './manageShared'

function LabelRow({ label, taskCount }: { label: Label; taskCount: number }) {
  const { dispatch } = useApp()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(label.name)
  const [color, setColor]     = useState(label.color)
  const [confirm, setConfirm] = useState(false)

  const save = useCallback(() => {
    if (!name.trim()) return
    dispatch({ type: 'UPDATE_LABEL', payload: { ...label, name: name.trim(), color } })
    setEditing(false)
  }, [dispatch, label, name, color])

  const cancel = useCallback(() => {
    setName(label.name); setColor(label.color); setEditing(false)
  }, [label])

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2.5">
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder={t.manage.labelName}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={save}>{t.manage.save}</Button>
          <Button size="sm" variant="ghost" onClick={cancel}>{t.manage.cancel}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
        style={{ backgroundColor: `${label.color}20`, color: label.color }}>
        {label.name}
      </span>
      <span className="flex-1" />
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t.manage.taskCount(taskCount)}</span>
      <RowActions
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirm(true)}
        confirm={confirm}
        onConfirm={() => dispatch({ type: 'DELETE_LABEL', payload: label.id })}
        onCancelConfirm={() => setConfirm(false)}
        confirmLabel={t.manage.confirmDelete}
      />
    </div>
  )
}

function AddLabelForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp()
  const t = useT()
  const [name, setName]   = useState('')
  const [color, setColor] = useState(COLORS[4])

  const submit = () => {
    if (!name.trim()) return
    dispatch({ type: 'ADD_LABEL', payload: { name: name.trim(), color } })
    setName(''); setColor(COLORS[4]); onDone()
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2.5 mt-2">
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder={t.manage.labelName}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>{t.manage.addLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t.manage.cancel}</Button>
      </div>
    </div>
  )
}

export function LabelsSection() {
  const { state } = useApp()
  const t = useT()
  const [adding, setAdding] = useState(false)
  const taskCount = (lId: string) => state.tasks.filter(tk => tk.labels.includes(lId)).length

  return (
    <>
      {state.labels.length === 0 && !adding && (
        <p className="text-sm text-slate-400 text-center py-6">{t.manage.noLabels}</p>
      )}
      <div className="space-y-0.5">
        {state.labels.map(l => (
          <LabelRow key={l.id} label={l} taskCount={taskCount(l.id)} />
        ))}
      </div>
      {adding
        ? <AddLabelForm onDone={() => setAdding(false)} />
        : (
          <button onClick={() => setAdding(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
            <Plus size={14} />{t.manage.addLabel}
          </button>
        )}
    </>
  )
}
