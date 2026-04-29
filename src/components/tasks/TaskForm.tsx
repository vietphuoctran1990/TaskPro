import { useState, useCallback } from 'react'
import { Calendar } from 'lucide-react'
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
}

interface FormData {
  title: string
  description: string
  status: Status
  priority: Priority
  projectId: string
  labels: string[]
  dueDate: string
}

export default function TaskForm({ open, onClose, task, defaultStatus = 'todo' }: TaskFormProps) {
  const { state, dispatch } = useApp()

  const [form, setForm] = useState<FormData>(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? 'medium',
    projectId: task?.projectId ?? (state.projects[0]?.id ?? ''),
    labels: task?.labels ?? [],
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : '',
  }))
  const [errors, setErrors] = useState<{ title?: string }>({})

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'title') setErrors({})
  }, [])

  const toggleLabel = useCallback((id: string) => {
    setForm(prev => ({
      ...prev,
      labels: prev.labels.includes(id)
        ? prev.labels.filter(l => l !== id)
        : [...prev.labels, id],
    }))
  }, [])

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setErrors({ title: 'Title is required' })
      return
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      projectId: form.projectId,
      labels: form.labels,
      dueDate: form.dueDate || null,
      subtasks: task?.subtasks ?? [],
    }
    if (task) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...payload, id: task.id } })
    } else {
      dispatch({ type: 'ADD_TASK', payload })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit Task' : 'New Task'}
      size="md"
    >
      <div className="px-6 py-5 space-y-4">
        <Input
          label="Title"
          id="task-title"
          placeholder="Enter task title…"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          error={errors.title}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <Textarea
          label="Description"
          id="task-desc"
          placeholder="Add more detail (optional)…"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Status"
            id="task-status"
            value={form.status}
            onChange={e => set('status', e.target.value as Status)}
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </Select>

          <Select
            label="Priority"
            id="task-priority"
            value={form.priority}
            onChange={e => set('priority', e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Project"
            id="task-project"
            value={form.projectId}
            onChange={e => set('projectId', e.target.value)}
          >
            {state.projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Due Date
            </label>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="date"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Labels</span>
          <div className="flex flex-wrap gap-1.5">
            {state.labels.map(label => {
              const selected = form.labels.includes(label.id)
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                  style={
                    selected
                      ? { backgroundColor: `${label.color}20`, color: label.color, borderColor: label.color }
                      : { backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#e2e8f0' }
                  }
                >
                  {selected && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />}
                  {label.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {task ? 'Save changes' : 'Create Task'}
        </Button>
      </div>
    </Modal>
  )
}
