import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import Button from '../ui/Button'
import { useApp } from '../../context/AppContext'
import type { TaskTemplate, Priority } from '../../types'

const empty: Omit<TaskTemplate, 'id'> = {
  name: '', description: '', priority: 'medium',
  estimatedHours: null, slaHours: null, labels: [], subtasks: [],
}

export function TemplatesSection() {
  const { state, dispatch } = useApp()
  const isVi = state.language === 'vi'
  const templates = state.templates ?? []
  const [editing, setEditing] = useState<TaskTemplate | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [form, setForm] = useState<Omit<TaskTemplate, 'id'>>(empty)
  const [subtaskInput, setSubtaskInput] = useState('')

  const openEdit = (tpl: TaskTemplate) => {
    setEditing(tpl)
    setForm({ name: tpl.name, description: tpl.description, priority: tpl.priority, estimatedHours: tpl.estimatedHours, slaHours: tpl.slaHours, labels: tpl.labels, subtasks: tpl.subtasks, isBuiltin: tpl.isBuiltin })
    setSubtaskInput('')
    setAddingNew(false)
  }
  const openNew  = () => { setEditing(null); setForm(empty); setSubtaskInput(''); setAddingNew(true) }
  const cancel   = () => { setEditing(null); setAddingNew(false); setForm(empty) }

  const save = () => {
    if (!form.name.trim()) return
    if (editing) dispatch({ type: 'UPDATE_TEMPLATE', payload: { ...editing, ...form } })
    else dispatch({ type: 'ADD_TEMPLATE', payload: form })
    cancel()
  }

  const addSubtask = () => {
    if (!subtaskInput.trim()) return
    setForm(f => ({ ...f, subtasks: [...f.subtasks, subtaskInput.trim()] }))
    setSubtaskInput('')
  }

  if (editing !== null || addingNew) {
    return (
      <div className="space-y-3">
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder={isVi ? 'Tên mẫu…' : 'Template name…'}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          autoFocus
        />
        <div className="flex gap-2">
          <select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="low">{isVi ? '⚪ Thấp' : '⚪ Low'}</option>
            <option value="medium">{isVi ? '🔵 TB' : '🔵 Medium'}</option>
            <option value="high">{isVi ? '🟠 Cao' : '🟠 High'}</option>
            <option value="urgent">{isVi ? '🔴 Khẩn' : '🔴 Urgent'}</option>
          </select>
          <input
            type="number" min="0" step="0.5"
            className="h-8 w-24 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            placeholder={isVi ? 'Giờ ước tính' : 'Est. hours'}
            value={form.estimatedHours ?? ''}
            onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value ? Number(e.target.value) : null }))}
          />
        </div>
        <textarea
          className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder={isVi ? 'Mô tả mặc định (markdown)…' : 'Default description (markdown)…'}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{isVi ? 'Công việc con mặc định:' : 'Default subtasks:'}</p>
          <div className="space-y-1">
            {form.subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate">{s}</span>
                <button onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, j) => j !== i) }))}
                  className="text-slate-400 hover:text-red-500"><X size={11} /></button>
              </div>
            ))}
            <div className="flex gap-1">
              <input
                className="flex-1 h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                placeholder={isVi ? 'Thêm subtask…' : 'Add subtask…'}
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
              />
              <button onClick={addSubtask} className="px-2 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-xs hover:bg-indigo-200 dark:hover:bg-indigo-800/50">
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="sm" onClick={save}>{isVi ? 'Lưu mẫu' : 'Save template'}</Button>
          <Button variant="ghost" size="sm" onClick={cancel}>{isVi ? 'Hủy' : 'Cancel'}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {templates.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{isVi ? 'Chưa có mẫu nào.' : 'No templates yet.'}</p>
      )}
      {templates.map(tpl => (
        <div key={tpl.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{tpl.name}</p>
            {tpl.subtasks.length > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {tpl.subtasks.length} {isVi ? 'subtask' : 'subtasks'} · {tpl.priority}
              </p>
            )}
          </div>
          {tpl.isBuiltin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{isVi ? 'Mặc định' : 'Built-in'}</span>
          )}
          <button onClick={() => openEdit(tpl)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
            <Pencil size={12} />
          </button>
          {!tpl.isBuiltin && (
            <button onClick={() => dispatch({ type: 'DELETE_TEMPLATE', payload: tpl.id })} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
      <button onClick={openNew}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors mt-2">
        <Plus size={14} />{isVi ? 'Tạo mẫu mới' : 'New template'}
      </button>
    </div>
  )
}
