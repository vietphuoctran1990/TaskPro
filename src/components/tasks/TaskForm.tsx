import { useState, useCallback, useEffect, useRef } from 'react'
import { Calendar, Clock, Timer, Repeat, Plus, Check, Trash2, Sparkles, X } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import InlineCreate from '../ui/InlineCreate'
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
    status:              task?.status         ?? defaultStatus ?? (state.statuses[0]?.id ?? 'todo'),
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
  const [aiSuggestion,  setAISuggestion]  = useState<{ description: string; priority: string; estimatedHours: number | null; subtasks: string[] } | null>(null)
  const [aiLoading,     setAILoading]     = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Smart fill: debounce on title change
  useEffect(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    if (!task && form.title.trim().length >= 8) {
      aiTimerRef.current = setTimeout(async () => {
        setAILoading(true)
        try {
          const res = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'smartfill', title: form.title.trim() }),
          })
          if (res.ok) {
            const data = await res.json()
            setAISuggestion(data)
          }
        } catch { /* ignore */ }
        finally { setAILoading(false) }
      }, 900)
    } else {
      setAISuggestion(null)
    }
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title])

  const applyAISuggestion = () => {
    if (!aiSuggestion) return
    if (aiSuggestion.description && !form.description) set('description', aiSuggestion.description)
    if (aiSuggestion.priority) set('priority', aiSuggestion.priority as FormData['priority'])
    if (aiSuggestion.estimatedHours) set('estimatedHours', String(aiSuggestion.estimatedHours))
    if (aiSuggestion.subtasks?.length) {
      const newSubs = aiSuggestion.subtasks.map(t => ({ id: crypto.randomUUID(), title: t, done: false }))
      setForm(prev => ({ ...prev, subtasks: [...prev.subtasks, ...newSubs] }))
    }
    setAISuggestion(null)
  }

  useEffect(() => {
    if (!open) return
    setForm(buildForm())
    setErrors({})
    setSlaPreset(buildSlaPreset())
    setAddingProject(false)
    setAddingLabel(false)
    setNewSubtask('')
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
      comments:       task?.comments ?? [],
      recurrence,
      isNote:         false,
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
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose}>{t.form.cancel}</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {task ? t.form.save : t.form.create}
          </Button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div>
          <Input
            label={t.form.title} id="task-title" placeholder={t.form.titlePlaceholder}
            value={form.title} onChange={e => set('title', e.target.value)}
            error={errors.title} autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {/* AI Smart Fill suggestion */}
          {!task && (aiLoading || aiSuggestion) && (
            <div className="mt-2 rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-900/20 px-3 py-2.5 text-xs">
              {aiLoading ? (
                <div className="flex items-center gap-1.5 text-violet-500 dark:text-violet-400">
                  <Sparkles size={12} className="animate-pulse" />
                  <span>AI đang gợi ý…</span>
                </div>
              ) : aiSuggestion && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
                      <Sparkles size={12} /> Gợi ý từ AI
                    </span>
                    <button onClick={() => setAISuggestion(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="space-y-1 text-slate-600 dark:text-slate-400">
                    {aiSuggestion.description && (
                      <p><span className="font-medium text-slate-700 dark:text-slate-300">Mô tả:</span> {aiSuggestion.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestion.priority && (
                        <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                          Ưu tiên: <strong>{aiSuggestion.priority}</strong>
                        </span>
                      )}
                      {aiSuggestion.estimatedHours && (
                        <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                          ~{aiSuggestion.estimatedHours}h
                        </span>
                      )}
                    </div>
                    {aiSuggestion.subtasks?.length > 0 && (
                      <p><span className="font-medium text-slate-700 dark:text-slate-300">Subtasks:</span> {aiSuggestion.subtasks.join(' · ')}</p>
                    )}
                  </div>
                  <button
                    onClick={applyAISuggestion}
                    className="mt-2 w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
                  >
                    Áp dụng gợi ý
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.detail.subtasks}</span>
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
                  <span className={`flex-1 text-sm ${s.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
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
              className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <Select label={t.form.status} id="task-status" value={form.status} onChange={e => set('status', e.target.value)}>
            {state.statuses
              .slice().sort((a, b) => a.order - b.order)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || (t.status as Record<string, string>)[s.id] || s.id}
                </option>
              ))}
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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.form.project}</label>
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
              className="h-9 w-full px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {addingProject && (
              <InlineCreate
                placeholder={t.manage.projectName}
                submitLabel={t.manage.save}
                onAdd={handleAddProject}
                onCancel={() => setAddingProject(false)}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.form.estimatedHours}</label>
            <div className="relative">
              <Timer size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="number" min="0" step="0.5" placeholder={t.form.estPlaceholder}
                value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.form.dueDate}</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.form.dueTime} <span className="text-slate-400 dark:text-slate-500 font-normal">{t.form.slaTimeHint}</span></label>
            <div className="relative">
              <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="time" value={form.dueTime} onChange={e => set('dueTime', e.target.value)}
                className="h-9 w-full pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* SLA window */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t.form.slaWindow} <span className="text-slate-400 dark:text-slate-500 font-normal">{t.form.slaWindowHint}</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {SLA_PRESETS.map(p => (
              <button key={p.value} type="button" onClick={() => handleSlaPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  slaPreset === p.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {slaPreset === 'custom' && (
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min="1" placeholder={t.form.hours}
                value={form.slaHours} onChange={e => set('slaHours', e.target.value)}
                className="h-9 w-28 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-sm text-slate-500 dark:text-slate-400">{t.form.hours}</span>
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Repeat size={13} className="text-slate-400 dark:text-slate-500" /> {t.recurrence.title}
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['', 'daily', 'weekly', 'monthly'] as const).map(type => (
              <button key={type} type="button"
                onClick={() => set('recurrenceType', type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.recurrenceType === type
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:text-indigo-600'
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
              <span className="text-sm text-slate-500 dark:text-slate-400">{t.recurrence.every}</span>
              <input type="number" min="1" max="99"
                value={form.recurrenceInterval} onChange={e => set('recurrenceInterval', e.target.value)}
                className="h-9 w-20 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-sm text-slate-500 dark:text-slate-400">{recurrenceUnitLabel}</span>
              <span className="text-slate-300">·</span>
              <label className="text-sm text-slate-500 dark:text-slate-400">{t.recurrence.endDate}</label>
              <input type="date" value={form.recurrenceEndDate} onChange={e => set('recurrenceEndDate', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.form.labels}</span>
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
              submitLabel={t.manage.save}
              onAdd={handleAddLabel}
              onCancel={() => setAddingLabel(false)}
            />
          )}
        </div>

      </div>
    </Modal>
  )
}
