import { useState, useCallback } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import {
  DndContext, type DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { StatusDef } from '../../types'
import { ColorPicker, RowActions } from './manageShared'

function StatusRow({ def, otherStatuses }: { def: StatusDef; otherStatuses: StatusDef[] }) {
  const { dispatch, state } = useApp()
  const t = useT()
  const i18nStatus = t.status as Record<string, string>
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(def.name)
  const [color, setColor]     = useState(def.color)
  const [isFinal, setIsFinal] = useState(def.isFinal)
  const [wip, setWip]         = useState(def.wipLimit != null ? String(def.wipLimit) : '')
  const [confirm, setConfirm] = useState(false)
  const [moveTo, setMoveTo]   = useState(otherStatuses[0]?.id ?? '')

  const taskCount = state.tasks.filter(tk => tk.status === def.id).length
  const displayName = def.name || i18nStatus[def.id] || def.id

  const save = useCallback(() => {
    const parsed = parseInt(wip, 10)
    const wipLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    dispatch({ type: 'UPDATE_STATUS', payload: { ...def, name, color, isFinal, wipLimit } })
    setEditing(false)
  }, [dispatch, def, name, color, isFinal, wip])

  const cancel = useCallback(() => {
    setName(def.name); setColor(def.color); setIsFinal(def.isFinal)
    setWip(def.wipLimit != null ? String(def.wipLimit) : ''); setEditing(false)
  }, [def])

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder={def.isBuiltin ? (i18nStatus[def.id] || def.id) : t.manage.statusName}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isFinal} onChange={e => setIsFinal(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-sm text-slate-700 dark:text-slate-300">{t.manage.isFinal}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700 dark:text-slate-300 shrink-0">{t.manage.wipLimit}</span>
          <input
            type="number" min={0} value={wip} onChange={e => setWip(e.target.value)}
            placeholder={t.manage.wipNone}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="w-20 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400 dark:text-slate-500">{t.manage.wipHint}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={save}>{t.manage.save}</Button>
          <Button size="sm" variant="ghost" onClick={cancel}>{t.manage.cancel}</Button>
        </div>
      </div>
    )
  }

  if (confirm) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">{displayName}</span>
        {taskCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 shrink-0">
            <span className="whitespace-nowrap">{t.manage.moveTasksTo}</span>
            <select value={moveTo} onChange={e => setMoveTo(e.target.value)}
              className="h-6 px-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {otherStatuses.map(s => (
                <option key={s.id} value={s.id}>{s.name || i18nStatus[s.id] || s.id}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { dispatch({ type: 'DELETE_STATUS', payload: { id: def.id, moveTo } }); setConfirm(false) }}
            className="px-2 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
            {t.manage.confirmDelete}
          </button>
          <button onClick={() => setConfirm(false)}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: def.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{displayName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {def.isFinal && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              ✓ Final
            </span>
          )}
          {def.wipLimit != null && def.wipLimit > 0 && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              WIP {def.wipLimit}
            </span>
          )}
          {def.isBuiltin && (
            <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
              {t.manage.builtin}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t.manage.taskCount(taskCount)}</span>
      <RowActions
        onEdit={() => setEditing(true)}
        onDelete={() => { setMoveTo(otherStatuses[0]?.id ?? ''); setConfirm(true) }}
        confirm={false}
        onConfirm={() => {}}
        onCancelConfirm={() => {}}
        confirmLabel=""
        canDelete={!def.isBuiltin}
      />
    </div>
  )
}

function SortableStatusRow({ def, otherStatuses }: { def: StatusDef; otherStatuses: StatusDef[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-0.5"
    >
      <button
        {...attributes} {...listeners}
        tabIndex={-1}
        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        aria-label="Kéo để sắp xếp"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <StatusRow def={def} otherStatuses={otherStatuses} />
      </div>
    </div>
  )
}

function AddStatusForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp()
  const t = useT()
  const [name, setName]       = useState('')
  const [color, setColor]     = useState('#6366f1')
  const [isFinal, setIsFinal] = useState(false)
  const [wip, setWip]         = useState('')

  const submit = () => {
    if (!name.trim()) return
    const parsed = parseInt(wip, 10)
    const wipLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    dispatch({ type: 'ADD_STATUS', payload: { name: name.trim(), color, isFinal, order: 99, wipLimit } })
    setName(''); setColor('#6366f1'); setIsFinal(false); setWip(''); onDone()
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2.5 mt-2">
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder={t.manage.statusName}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={isFinal} onChange={e => setIsFinal(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        <span className="text-sm text-slate-700 dark:text-slate-300">{t.manage.isFinal}</span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700 dark:text-slate-300 shrink-0">{t.manage.wipLimit}</span>
        <input
          type="number" min={0} value={wip} onChange={e => setWip(e.target.value)}
          placeholder={t.manage.wipNone}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
          className="w-20 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-400 dark:text-slate-500">{t.manage.wipHint}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>{t.manage.addStatus}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t.manage.cancel}</Button>
      </div>
    </div>
  )
}

export function StatusesSection() {
  const { state, dispatch } = useApp()
  const t = useT()
  const [adding, setAdding] = useState(false)

  const sortedStatuses = [...state.statuses].sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = sortedStatuses.findIndex(s => s.id === active.id)
    const newIndex = sortedStatuses.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sortedStatuses, oldIndex, newIndex)
    dispatch({ type: 'REORDER_STATUSES', payload: reordered.map(s => s.id) })
  }, [sortedStatuses, dispatch])

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedStatuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {sortedStatuses.map(s => (
              <SortableStatusRow key={s.id} def={s} otherStatuses={sortedStatuses.filter(o => o.id !== s.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {adding
        ? <AddStatusForm onDone={() => setAdding(false)} />
        : (
          <button onClick={() => setAdding(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
            <Plus size={14} />{t.manage.addStatus}
          </button>
        )}
    </>
  )
}
