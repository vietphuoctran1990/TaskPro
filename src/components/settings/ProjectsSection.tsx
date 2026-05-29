import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Project } from '../../types'
import { COLORS, ColorPicker, RowActions } from './manageShared'

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

export function ProjectsSection() {
  const { state } = useApp()
  const t = useT()
  const [adding, setAdding] = useState(false)
  const taskCount = (pId: string) => state.tasks.filter(tk => tk.projectId === pId).length

  return (
    <>
      {state.projects.length === 0 && !adding && (
        <p className="text-sm text-slate-400 text-center py-6">{t.manage.noProjects}</p>
      )}
      <div className="space-y-0.5">
        {state.projects.map(p => (
          <ProjectRow key={p.id} project={p} taskCount={taskCount(p.id)} />
        ))}
      </div>
      {adding
        ? <AddProjectForm onDone={() => setAdding(false)} />
        : (
          <button onClick={() => setAdding(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
            <Plus size={14} />{t.manage.addProject}
          </button>
        )}
    </>
  )
}
