import { useState, useCallback } from 'react'
import { Pencil, Trash2, Plus, X, Check, FolderOpen, Tag } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Project, Label } from '../../types'

const COLORS = [
  '#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899',
  '#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4',
  '#84cc16','#e11d48','#7c3aed','#0891b2','#d97706',
]

interface ManageModalProps {
  open: boolean
  onClose: () => void
  initialTab?: 'projects' | 'labels'
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
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder={t.manage.projectName}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder={t.manage.description}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 group">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
        {project.description && <p className="text-xs text-slate-400 truncate">{project.description}</p>}
      </div>
      <span className="text-xs text-slate-400 shrink-0">{t.manage.taskCount(taskCount)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Pencil size={13} />
        </button>
        {confirm ? (
          <div className="flex items-center gap-1">
            <button onClick={() => dispatch({ type: 'DELETE_PROJECT', payload: project.id })}
              className="p-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-medium px-2">
              {t.manage.confirmDelete}
            </button>
            <button onClick={() => setConfirm(false)}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>
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
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder={t.manage.labelName}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 group">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
        style={{ backgroundColor: `${label.color}20`, color: label.color }}>
        {label.name}
      </span>
      <span className="flex-1" />
      <span className="text-xs text-slate-400 shrink-0">{t.manage.taskCount(taskCount)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Pencil size={13} />
        </button>
        {confirm ? (
          <div className="flex items-center gap-1">
            <button onClick={() => dispatch({ type: 'DELETE_LABEL', payload: label.id })}
              className="p-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-medium px-2">
              {t.manage.confirmDelete}
            </button>
            <button onClick={() => setConfirm(false)}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>
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
    <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-2.5 mt-2">
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder={t.manage.projectName}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <input
        value={desc} onChange={e => setDesc(e.target.value)}
        placeholder={t.manage.description}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-2.5 mt-2">
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder={t.manage.labelName}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>{t.manage.addLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{t.manage.cancel}</Button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ManageModal({ open, onClose, initialTab = 'projects' }: ManageModalProps) {
  const { state } = useApp()
  const t = useT()
  const [tab, setTab]               = useState<'projects' | 'labels'>(initialTab)
  const [addingProject, setAddingProject] = useState(false)
  const [addingLabel, setAddingLabel]     = useState(false)

  const projectTaskCount = (pId: string) => state.tasks.filter(tk => tk.projectId === pId).length
  const labelTaskCount   = (lId: string) => state.tasks.filter(tk => tk.labels.includes(lId)).length

  return (
    <Modal open={open} onClose={onClose} size="md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{t.manage.title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6">
        <button
          onClick={() => { setTab('projects'); setAddingProject(false) }}
          className={cn('flex items-center gap-1.5 py-3 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'projects'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700')}>
          <FolderOpen size={14} />{t.manage.projects}
          <span className="ml-1 text-xs text-slate-400">({state.projects.length})</span>
        </button>
        <button
          onClick={() => { setTab('labels'); setAddingLabel(false) }}
          className={cn('flex items-center gap-1.5 py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'labels'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700')}>
          <Tag size={14} />{t.manage.labels}
          <span className="ml-1 text-xs text-slate-400">({state.labels.length})</span>
        </button>
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
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
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
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                  <Plus size={14} />{t.manage.addLabel}
                </button>
              )}
          </>
        )}
      </div>
    </Modal>
  )
}
