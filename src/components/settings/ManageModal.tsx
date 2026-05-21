import { useState, useCallback } from 'react'
import { Pencil, Trash2, Plus, X, Check, FolderOpen, Tag, CircleDot, GripVertical } from 'lucide-react'
import {
  DndContext, type DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Project, Label, StatusDef } from '../../types'

const COLORS = [
  '#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899',
  '#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4',
  '#84cc16','#e11d48','#7c3aed','#0891b2','#d97706',
]

interface ManageModalProps {
  open: boolean
  onClose: () => void
  initialTab?: 'projects' | 'labels' | 'statuses'
}

// ── Color picker ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
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

// ── Shared edit/delete action buttons ────────────────────────────────────────
function RowActions({
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

// ── Project row ───────────────────────────────────────────────────────────────
function ProjectRow({ project, taskCount }: { project: Project; taskCount: number }) {
  const { dispatch } = useApp()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(project.name)
  const [desc, setDesc]       = useState(project.description)
  const [color, setColor]     = useState(project.color)
  const [confirm, setConfirm] = useState(false)

  const save = useCallback(() => {
    if (!name.trim()) return
    dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, name: name.trim(), description: desc.trim(), color } })
    setEditing(false)
  }, [dispatch, project, name, desc, color])

  const cancel = useCallback(() => {
    setName(project.name); setDesc(project.description); setColor(project.color)
    setEditing(false)
  }, [project])

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2.5">
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder={t.manage.projectName}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder={t.manage.description}
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
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{project.name}</p>
        {project.description && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{project.description}</p>}
      </div>
      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{t.manage.taskCount(taskCount)}</span>
      <RowActions
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirm(true)}
        confirm={confirm}
        onConfirm={() => dispatch({ type: 'DELETE_PROJECT', payload: project.id })}
        onCancelConfirm={() => setConfirm(false)}
        confirmLabel={t.manage.confirmDelete}
      />
    </div>
  )
}

// ── Label row ─────────────────────────────────────────────────────────────────
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

// ── Add project form ──────────────────────────────────────────────────────────
function AddProjectForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp()
  const t = useT()
  const [name, setName]   = useState('')
  const [desc, setDesc]   = useState('')
  const [color, setColor] = useState(COLORS[0])

  const submit = () => {
    if (!name.trim()) return
    dispatch({ type: 'ADD_PROJECT', payload: { name: name.trim(), description: desc.trim(), color, notes: '' } })
    setName(''); setDesc(''); setColor(COLORS[0]); onDone()
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2.5 mt-2">
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder={t.manage.projectName}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        value={desc} onChange={e => setDesc(e.target.value)}
        placeholder={t.manage.description}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>{t.manage.addProject}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t.manage.cancel}</Button>
      </div>
    </div>
  )
}

// ── Add label form ────────────────────────────────────────────────────────────
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

// ── Status row ────────────────────────────────────────────────────────────────
function StatusRow({ def, otherStatuses }: { def: StatusDef; otherStatuses: StatusDef[] }) {
  const { dispatch, state } = useApp()
  const t = useT()
  const i18nStatus = t.status as Record<string, string>
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(def.name)
  const [color, setColor]     = useState(def.color)
  const [isFinal, setIsFinal] = useState(def.isFinal)
  const [confirm, setConfirm] = useState(false)
  const [moveTo, setMoveTo]   = useState(otherStatuses[0]?.id ?? '')

  const taskCount = state.tasks.filter(tk => tk.status === def.id).length
  const displayName = def.name || i18nStatus[def.id] || def.id

  const save = useCallback(() => {
    dispatch({ type: 'UPDATE_STATUS', payload: { ...def, name, color, isFinal } })
    setEditing(false)
  }, [dispatch, def, name, color, isFinal])

  const cancel = useCallback(() => {
    setName(def.name); setColor(def.color); setIsFinal(def.isFinal); setEditing(false)
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

// ── Sortable status row wrapper ───────────────────────────────────────────────
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

// ── Add status form ───────────────────────────────────────────────────────────
function AddStatusForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp()
  const t = useT()
  const [name, setName]     = useState('')
  const [color, setColor]   = useState(COLORS[0])
  const [isFinal, setIsFinal] = useState(false)

  const submit = () => {
    if (!name.trim()) return
    dispatch({ type: 'ADD_STATUS', payload: { name: name.trim(), color, isFinal, order: 99 } })
    setName(''); setColor(COLORS[0]); setIsFinal(false); onDone()
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
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>{t.manage.addStatus}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t.manage.cancel}</Button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ManageModal({ open, onClose, initialTab = 'projects' }: ManageModalProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [tab, setTab]               = useState<'projects' | 'labels' | 'statuses'>(initialTab)

  const [addingProject, setAddingProject] = useState(false)
  const [addingLabel, setAddingLabel]     = useState(false)
  const [addingStatus, setAddingStatus]   = useState(false)

  const projectTaskCount = (pId: string) => state.tasks.filter(tk => tk.projectId === pId).length
  const labelTaskCount   = (lId: string) => state.tasks.filter(tk => tk.labels.includes(lId)).length

  const sortedStatuses = [...state.statuses].sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const handleStatusDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = sortedStatuses.findIndex(s => s.id === active.id)
    const newIndex = sortedStatuses.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sortedStatuses, oldIndex, newIndex)
    dispatch({ type: 'REORDER_STATUSES', payload: reordered.map(s => s.id) })
  }, [sortedStatuses, dispatch])

  return (
    <Modal open={open} onClose={onClose} size="md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.manage.title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 overflow-x-auto">
        {[
          { key: 'projects', icon: FolderOpen, label: t.manage.projects, count: state.projects.length },
          { key: 'labels',   icon: Tag,        label: t.manage.labels,   count: state.labels.length },
          { key: 'statuses', icon: CircleDot,  label: t.manage.statuses, count: state.statuses.length },
        ].map(({ key, icon: Icon, label, count }) => (
          <button key={key}
            onClick={() => { setTab(key as typeof tab); setAddingProject(false); setAddingLabel(false); setAddingStatus(false) }}
            className={cn('flex items-center gap-1.5 py-3 px-2 mr-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}>
            <Icon size={14} />{label}
            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-3 overflow-y-auto max-h-[60vh]">
        {tab === 'projects' && (
          <>
            {state.projects.length === 0 && !addingProject && (
              <p className="text-sm text-slate-400 text-center py-6">{t.manage.noProjects}</p>
            )}
            <div className="space-y-0.5">
              {state.projects.map(p => (
                <ProjectRow key={p.id} project={p} taskCount={projectTaskCount(p.id)} />
              ))}
            </div>
            {addingProject
              ? <AddProjectForm onDone={() => setAddingProject(false)} />
              : (
                <button onClick={() => setAddingProject(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                  <Plus size={14} />{t.manage.addProject}
                </button>
              )}
          </>
        )}

        {tab === 'labels' && (
          <>
            {state.labels.length === 0 && !addingLabel && (
              <p className="text-sm text-slate-400 text-center py-6">{t.manage.noLabels}</p>
            )}
            <div className="space-y-0.5">
              {state.labels.map(l => (
                <LabelRow key={l.id} label={l} taskCount={labelTaskCount(l.id)} />
              ))}
            </div>
            {addingLabel
              ? <AddLabelForm onDone={() => setAddingLabel(false)} />
              : (
                <button onClick={() => setAddingLabel(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                  <Plus size={14} />{t.manage.addLabel}
                </button>
              )}
          </>
        )}
        {tab === 'statuses' && (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatusDragEnd}>
              <SortableContext items={sortedStatuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {sortedStatuses.map(s => (
                    <SortableStatusRow
                      key={s.id}
                      def={s}
                      otherStatuses={sortedStatuses.filter(o => o.id !== s.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {addingStatus
              ? <AddStatusForm onDone={() => setAddingStatus(false)} />
              : (
                <button onClick={() => setAddingStatus(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                  <Plus size={14} />{t.manage.addStatus}
                </button>
              )}
          </>
        )}
      </div>
    </Modal>
  )
}
