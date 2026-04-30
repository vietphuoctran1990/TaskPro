import { useState, useCallback } from 'react'
import { Calendar, Clock, Timer } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import Select from '../ui/Select'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import type { Task, Priority, Status } from '../../types'

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
}

export default function TaskForm({ open, onClose, task, defaultStatus = 'todo', defaultDate = '' }: TaskFormProps) {
  const { state, dispatch } = useApp()
  const t = useT()

  const SLA_PRESETS = [
    { label: t.sla.none_preset, value: '' },
    { label: t.sla.p1,         value: '4' },
    { label: t.sla.p2,         value: '8' },
    { label: t.sla.p3,         value: '24' },
    { label: t.sla.p4,         value: '72' },
    { label: t.sla.custom,     value: 'custom' },
  ]

  const [form, setForm] = useState<FormData>(() => ({
    title:          task?.title ?? '',
    description:    task?.description ?? '',
    status:         task?.status ?? defaultStatus,
    priority:       task?.priority ?? 'medium',
    projectId:      task?.projectId ?? (state.projects[0]?.id ?? ''),
    labels:         task?.labels ?? [],
    dueDate:        task?.dueDate ?? defaultDate,
    dueTime:        task?.dueTime ?? '',
    slaHours:       task?.slaHours != null ? String(task.slaHours) : '',
    estimatedHours: task?.estimatedHours != null ? String(task.estimatedHours) : '',
  }))
  const [errors, setErrors] = useState<{ title?: string }>({})
  const [slaPreset, setSlaPreset] = useState(() => {
    if (!task?.slaHours) return ''
    const match = SLA_PRESETS.find(p => p.value === String(task.slaHours))
    return match ? match.value : 'custom'
  })

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

  const handleSubmit = () => {
    if (!form.title.trim()) { setErrors({ title: t.form.titleRequired }); return }
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
      subtasks:       task?.subtasks ?? [],
      comments:       task?.comments ?? [],
    }
    if (task) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...payload, id: task.id } })
    } else {
      dispatch({ type: 'ADD_TASK', payload })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? t.form.editTask : t.form.newTask} size="lg">
      <div className="px-6 py-5 space-y-4">
        {/* Title */}
        <Input
          label={t.form.title} id="task-title" placeholder={t.form.titlePlaceholder}
          value={form.title} onChange={e => set('title', e.target.value)}
          error={errors.title} autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* Description */}
        <Textarea
          label={t.form.description} id="task-desc"
          placeholder={t.form.descPlaceholder}
          value={form.description} onChange={e => set('description', e.target.value)}
          rows={3}
        />

        {/* Status + Priority */}
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

        {/* Project + Estimated hours */}
        <div className="grid grid-cols-2 gap-3">
          <Select label={t.form.project} id="task-project" value={form.projectId} onChange={e => set('projectId', e.target.value)}>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">{t.form.estimatedHours}</label>
            <div className="relative">
              <Timer size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="number" min="0" step="0.5"
                placeholder={t.form.estPlaceholder}
                value={form.estimatedHours}
                onChange={e => set('estimatedHours', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Due date + Due time */}
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
              <button
                key={p.value}
                type="button"
                onClick={() => handleSlaPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  slaPreset === p.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {slaPreset === 'custom' && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number" min="1" placeholder={t.form.hours}
                value={form.slaHours}
                onChange={e => set('slaHours', e.target.value)}
                className="h-9 w-28 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500">{t.form.hours}</span>
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">{t.form.labels}</span>
          <div className="flex flex-wrap gap-1.5">
            {state.labels.map(label => {
              const sel = form.labels.includes(label.id)
              return (
                <button key={label.id} type="button" onClick={() => toggleLabel(label.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                  style={sel
                    ? { backgroundColor: `${label.color}18`, color: label.color, borderColor: label.color }
                    : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#e2e8f0' }
                  }
                >
                  {sel && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />}
                  {label.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
        <Button variant="ghost" onClick={onClose}>{t.form.cancel}</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {task ? t.form.save : t.form.create}
        </Button>
      </div>
    </Modal>
  )
}
