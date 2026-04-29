import { useState, useCallback } from 'react'
import { Calendar, Clock, Timer } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import Select from '../ui/Select'
import { useApp } from '../../context/AppContext'
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

const SLA_PRESETS = [
  { label: 'None',       value: '' },
  { label: 'P1 — 4h',   value: '4' },
  { label: 'P2 — 8h',   value: '8' },
  { label: 'P3 — 24h',  value: '24' },
  { label: 'P4 — 72h',  value: '72' },
  { label: 'Custom',     value: 'custom' },
]

export default function TaskForm({ open, onClose, task, defaultStatus = 'todo', defaultDate = '' }: TaskFormProps) {
  const { state, dispatch } = useApp()
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
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return }
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
    <Modal open={open} onClose={onClose} title={task ? 'Edit Task' : 'New Task'} size="lg">
      <div className="px-6 py-5 space-y-4">
        {/* Title */}
        <Input
          label="Title" id="task-title" placeholder="Enter task title…"
          value={form.title} onChange={e => set('title', e.target.value)}
          error={errors.title} autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* Description */}
        <Textarea
          label="Description" id="task-desc"
          placeholder="Add more detail (optional)…"
          value={form.description} onChange={e => set('description', e.target.value)}
          rows={3}
        />

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" id="task-status" value={form.status} onChange={e => set('status', e.target.value as Status)}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </Select>
          <Select label="Priority" id="task-priority" value={form.priority} onChange={e => set('priority', e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>

        {/* Project + Estimated hours */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Project" id="task-project" value={form.projectId} onChange={e => set('projectId', e.target.value)}>
            {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Est. hours</label>
            <div className="relative">
              <Timer size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="number" min="0" step="0.5"
                placeholder="e.g. 4"
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
            <label className="text-sm font-medium text-slate-700">Due Date</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Due Time <span className="text-slate-400 font-normal">(SLA)</span></label>
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
            SLA Window <span className="text-slate-400 font-normal">(max resolution time from creation)</span>
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
                type="number" min="1" placeholder="Hours"
                value={form.slaHours}
                onChange={e => set('slaHours', e.target.value)}
                className="h-9 w-28 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-500">hours</span>
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Labels</span>
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
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {task ? 'Save changes' : 'Create Task'}
        </Button>
      </div>
    </Modal>
  )
}
