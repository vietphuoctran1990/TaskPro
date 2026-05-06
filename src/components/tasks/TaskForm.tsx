import { useState, useCallback, useEffect } from 'react'
import { Calendar, Clock, Timer, Repeat, Plus, Check, X, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import Select from '../ui/Select'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { useToast } from '../../context/ToastContext'
import type { Task, Priority, Status, Recurrence, Subtask } from '../../types'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultStatus?: Status
  defaultDate?: string
}

interface FormData {
  title: string
  description: string
  status: Status
  priority: Priority
  projectId: string
  labels: string[]
  dueDate: string
  dueTime: string
  slaHours: string
  estimatedHours: string
  recurrenceType: '' | 'daily' | 'weekly' | 'monthly'
  recurrenceInterval: string
  recurrenceEndDate: string
  subtasks: Subtask[]
  links: string[]
}

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
]

function InlineCreate({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string
  onAdd: (name: string, color: string) => void
  onCancel: () => void
}) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, color)
  }

  return (
    <div className="mt-2 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2.5">
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel() }}
        className="h-8 w-full px-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button
            key={c} type="button"
            onClick={() => setColor(c)}
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
          Thêm
        </button>
        <button
          type="button" onClick={onCancel}
          className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

export default function TaskForm({ open, onClose, task, defaultStatus = 'todo', defaultDate = '' }: TaskFormProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const { toast } = useToast()

  const SLA_PRESETS = [
    { label: t.sla.none_preset, value: '' },
    { label: t.sla.p1,         value: '4' },
    { label: t.sla.p2,         value: '8' },
    { label: t.sla.p3,         value: '24' },
    { label: t.sla.p4,         value: '72' },
    { label: t.sla.custom,     value: 'custom' },
  ]

  const buildForm = useCallback((): FormData => ({
    title:               task?.title          ?? '',
    description:         task?.description    ?? '',
    status:              task?.status         ?? defaultStatus,
    priority:            task?.priority       ?? 'medium',
    projectId:           task?.projectId      ?? (state.projects[0]?.id ?? ''),
    labels:              task?.labels         ?? [],
    dueDate:             task?.dueDate        ?? defaultDate,
    dueTime:             task?.dueTime        ?? '',
    slaHours:            task?.slaHours       != null ? String(task.slaHours) : '',
    estimatedHours:      task?.estimatedHours != null ? String(task.estimatedHours) : '',
    recurrenceType:      task?.recurrence?.type     ?? '',
    recurrenceInterval:  task?.recurrence?.interval ? String(task.recurrence.interval) : '1',
    recurrenceEndDate:   task?.recurrence?.endDate  ?? '',
    subtasks:            task?.subtasks ?? [],
    links:               task?.links ?? [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [task, defaultStatus, defaultDate, state.projects])

  const buildSlaPreset = useCallback(() => {
    if (!task?.slaHours) return ''
    return (['4', '8', '24', '72'].includes(String(task.slaHours)) ? String(task.slaHours) : 'custom')
  }, [task])

  const [form, setForm] = useState<FormData>(buildForm)
  const [errors, setErrors] = useState<{ title?: string }>({})
  const [slaPreset, setSlaPreset] = useState(buildSlaPreset)
  const [addingProject, setAddingProject] = useState(false)
  const [addingLabel,   setAddingLabel]   = useState(false)
  const [newSubtask,    setNewSubtask]    = useState('')
  const [newLink,       setNewLink]       = useState('')

  useEffect(() => {
    if (!open) return
    setForm(buildForm())
    setErrors({})
    setSlaPreset(buildSlaPreset())
    setAddingProject(false)
    setAddingLabel(false)
    setNewSubtask('')
    setNewLink('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task])

  const addSubtask = () => {
    const title = newSubtask.trim()
    if (!title) return
    const sub: Subtask = { id: crypto.randomUUID(), title, done: false }
    setForm(prev => ({ ...prev, subtasks: [...prev.subtasks, sub] }))
    setNewSubtask('')
  }
  const removeSubtask = (id: string) =>
    setForm(prev => ({ ...prev, subtasks: prev.subtasks.filter(s => s.id !== id) }))
  const toggleSubtask = (id: string) =>
    setForm(prev => ({ ...prev, subtasks: prev.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s) }))

  const addLink = () => {
    const url = newLink.trim()
    if (!url) return
    const full = url.startsWith('http') ? url : `https://${url}`
    setForm(prev => ({ ...prev, links: [...prev.links, full] }))
    setNewLink('')
  }
  const removeLink = (idx: number) =>
    setForm(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== idx) }))

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'title') setErrors({})
  }, [])

  const toggleLabel = useCallback((id: string) => {
    setForm(prev => ({
      ...prev,
      labels: prev.labels.includes(id) ? prev.labels.filter(l => l !== id) : [...prev.labels, id],
    }))
  }, [])

  const handleSlaPreset = (val: string) => {
    setSlaPreset(val)
    if (val !== 'custom') set('slaHours', val)
  }

  const handleAddProject = (name: string, color: string) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD_PROJECT', payload: { id, name, color, description: '', notes: '' } })
    set('projectId', id)
    setAddingProject(false)
  }

  const handleAddLabel = (name: string, color: string) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD_LABEL', payload: { id, name, color } })
    setForm(prev => ({ ...prev, labels: [...prev.labels, id] }))
    setAddingLabel(false)
  }

  const handleSubmit = () => {
    if (!form.title.trim()) { setErrors({ title: t.form.titleRequired }); return }

    let recurrence: Recurrence | null = null
    if (form.recurrenceType) {
      recurrence = {
        type: form.recurrenceType,
        interval: Math.max(1, Number(form.recurrenceInterval) || 1),
        ...(form.recurrenceEndDate ? { endDate: form.recurrenceEndDate } : {}),
      }
    }

    const payload = {
      title:          form.title.trim(),
      description:    form.description.trim(),
      status:         form.status,
      priority:       form.priority,
      projectId:      form.projectId,
      labels:         form.labels,
      dueDate:        form.dueDate || null,
      dueTime:        form.dueTime || null,
      slaHours:       form.slaHours ? Number(form.slaHours) : null,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      subtasks:       form.subtasks,
      links:          form.links,
      comments:       task?.comments ?? [],
      recurrence,
    }
    if (task) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...payload, id: task.id } })
      toast(state.language === 'vi' ? 'Đã cập nhật công việc' : 'Task updated', 'success')
    } else {
      dispatch({ type: 'ADD_TASK', payload })
      toast(state.language === 'vi' ? 'Đã tạo công việc mới' : 'Task created', 'success')
    }
    onClose()
  }

  const recurrenceUnitLabel =
    form.recurrenceType === 'daily'   ? t.recurrence.days :
    form.recurrenceType === 'weekly'  ? t.recurrence.weeks :
    form.recurrenceType === 'monthly' ? t.recurrence.months : ''

  return (
    <Modal
      open={open} onClose={onClose}
      title={task ? t.form.editTask : t.form.newTask}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose}>{t.form.cancel}</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {task ? t.form.save : t.form.create}
          </Button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <Input
          label={t.form.title} id="task-title" placeholder={t.form.titlePlaceholder}
          value={form.title} onChange={e => set('title', e.target.value)}
          error={errors.title} autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* Subtasks */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">{t.detail.subtasks}</span>
          {form.subtasks.length > 0 && (
            <div className="space-y-1">
              {form.subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <button type="button" onClick={() => toggleSubtask(s.id)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      s.done ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'
                    }`}>
                    {s.done && <Check size={10} className="text-white" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
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
              className="flex-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={addSubtask}
              disabled={!newSubtask.trim()}
              className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              <Plus size={13} />
            </button>
          </div>
        </div>

        <Textarea
          label={t.form.description} id="task-desc" placeholder={t.form.descPlaceholder}
          value={form.description} onChange={e => set('description', e.target.value)} rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select label={t.form.status} id="task-status" value={form.status} onChange={e => set('status', e.target.value as Status)}>
            <option value="todo">{t.status.todo}</option>
            <option value="in_progress">{t.status.in_progress}</option>
            <option value="in_review">{t.status.in_review}</option>
            <option value="done">{t.status.done}</option>
          </Select>
          <Select label={t.form.priority} id="task-priority" value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>
            <option value="low">{t.priority.low}</option>
            <option value="medium">{t.priority.medium}</option>
            <option value="high">{t.priority.high}</option>
            <option value="urgent">{t.priority.urgent}</option>
          </Select>
        </div>

        {/* Project row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">{t.form.project}</label>
              <button
                type="button"
                onClick={() => { setAddingProject(v => !v); setAddingLabel(false) }}
                className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus size={12} /> {t.manage.addProject}
              </button>
            </div>
            <select
              id="task-project" value={form.projectId} onChange={e => set('projectId', e.target.value)}
              className="h-9 w-full px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {addingProject && (
              <InlineCreate
                placeholder={t.manage.projectName}
                onAdd={handleAddProject}
                onCancel={() => setAddingProject(false)}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">{t.form.estimatedHours}</label>
            <div className="relative">
              <Timer size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="number" min="0" step="0.5" placeholder={t.form.estPlaceholder}
                value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">{t.form.dueDate}</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">{t.form.dueTime} <span className="text-slate-400 font-normal">{t.form.slaTimeHint}</span></label>
            <div className="relative">
              <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="time" value={form.dueTime} onChange={e => set('dueTime', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* SLA window */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            {t.form.slaWindow} <span className="text-slate-400 font-normal">{t.form.slaWindowHint}</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {SLA_PRESETS.map(p => (
              <button key={p.value} type="button" onClick={() => handleSlaPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  slaPreset === p.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {slaPreset === 'custom' && (
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min="1" placeholder={t.form.hours}
                value={form.slaHours} onChange={e => set('slaHours', e.target.value)}
                className="h-9 w-28 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-sm text-slate-500">{t.form.hours}</span>
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Repeat size={13} className="text-slate-400" /> {t.recurrence.title}
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['', 'daily', 'weekly', 'monthly'] as const).map(type => (
              <button key={type} type="button"
                onClick={() => set('recurrenceType', type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.recurrenceType === type
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {type === ''        ? t.recurrence.none    :
                 type === 'daily'   ? t.recurrence.daily   :
                 type === 'weekly'  ? t.recurrence.weekly  :
                                     t.recurrence.monthly}
              </button>
            ))}
          </div>
          {form.recurrenceType && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-slate-500">{t.recurrence.every}</span>
              <input type="number" min="1" max="99"
                value={form.recurrenceInterval} onChange={e => set('recurrenceInterval', e.target.value)}
                className="h-9 w-20 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-sm text-slate-500">{recurrenceUnitLabel}</span>
              <span className="text-slate-300">·</span>
              <label className="text-sm text-slate-500">{t.recurrence.endDate}</label>
              <input type="date" value={form.recurrenceEndDate} onChange={e => set('recurrenceEndDate', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{t.form.labels}</span>
            <button
              type="button"
              onClick={() => { setAddingLabel(v => !v); setAddingProject(false) }}
              className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={12} /> {t.manage.addLabel}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.labels.map(label => {
              const sel = form.labels.includes(label.id)
              return (
                <button key={label.id} type="button" onClick={() => toggleLabel(label.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                  style={sel
                    ? { backgroundColor: `${label.color}18`, color: label.color, borderColor: label.color }
                    : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#e2e8f0' }}>
                  {sel && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />}
                  {label.name}
                </button>
              )
            })}
          </div>
          {addingLabel && (
            <InlineCreate
              placeholder={t.manage.labelName}
              onAdd={handleAddLabel}
              onCancel={() => setAddingLabel(false)}
            />
          )}
        </div>

        {/* Links */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">{t.form.links}</span>
          {form.links.length > 0 && (
            <div className="space-y-1.5">
              {form.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline truncate"
                    onClick={e => e.stopPropagation()}>
                    {link}
                  </a>
                  <button type="button" onClick={() => removeLink(idx)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="url" value={newLink} onChange={e => setNewLink(e.target.value)}
              placeholder={t.form.linkPlaceholder}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
              className="flex-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="button" onClick={addLink} disabled={!newLink.trim()}
              className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {t.form.addLink}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
