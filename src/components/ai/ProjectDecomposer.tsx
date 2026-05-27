import { useState } from 'react'
import { Sparkles, X, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { todayLocalISO } from '../../lib/dateLocal'

interface DecomposedTask {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedHours: number
  daysFromNow: number
}

interface DecomposedProject {
  projectName: string
  description: string
  tasks: DecomposedTask[]
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function ProjectDecomposer({ open, onClose }: Props) {
  const { state, dispatch } = useApp()
  const isVi = state.language === 'vi'

  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DecomposedProject | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState(false)
  const [showDetails, setShowDetails] = useState<Set<number>>(new Set())

  const reset = () => { setGoal(''); setResult(null); setError(null); setSelectedTasks(new Set()); setDone(false); setShowDetails(new Set()) }

  const handleClose = () => { reset(); onClose() }

  const decompose = async () => {
    if (!goal.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'decompose-project', goal: goal.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as DecomposedProject
      if (!data.tasks?.length) throw new Error('No tasks returned')
      setResult(data)
      setSelectedTasks(new Set(data.tasks.map((_, i) => i)))
    } catch (e) {
      setError(isVi ? 'Không thể phân tích mục tiêu. Thử lại sau.' : 'Failed to decompose goal. Please try again.')
      console.error('[ProjectDecomposer]', e)
    } finally { setLoading(false) }
  }

  const createAll = async () => {
    if (!result) return
    setCreating(true)
    const today = todayLocalISO()
    const firstStatus = state.statuses.find(s => !s.isFinal)?.id ?? 'todo'
    const projectColor = ['#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899','#8b5cf6'][Math.floor(Math.random() * 6)]
    const projectId = crypto.randomUUID()
    dispatch({ type: 'ADD_PROJECT', payload: { id: projectId, name: result.projectName, description: result.description, color: projectColor, notes: '' } })
    result.tasks.forEach((task, i) => {
      if (!selectedTasks.has(i)) return
      const dueDate = task.daysFromNow > 0
        ? new Date(new Date(today).getTime() + task.daysFromNow * 86400000).toISOString().slice(0, 10)
        : undefined
      const safeP = ['low','medium','high','urgent'].includes(task.priority) ? task.priority : 'medium'
      dispatch({
        type: 'ADD_TASK',
        payload: {
          title: task.title,
          description: task.description || '',
          status: firstStatus,
          priority: safeP as 'low' | 'medium' | 'high' | 'urgent',
          projectId,
          labels: [],
          dueDate: dueDate ?? null,
          dueTime: null,
          estimatedHours: task.estimatedHours || null,
          slaHours: null,
          subtasks: [],
          comments: [],
          pinned: false,
          recurrence: null,
          isNote: false,
        },
      })
    })
    setDone(true)
    setCreating(false)
  }

  const toggleTask = (i: number) => setSelectedTasks(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i); else next.add(i)
    return next
  })

  const toggleDetails = (i: number) => setShowDetails(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i); else next.add(i)
    return next
  })

  const PRIORITY_COLOR: Record<string, string> = { urgent: 'text-red-500', high: 'text-orange-500', medium: 'text-blue-500', low: 'text-slate-400' }

  return (
    <Modal open={open} onClose={handleClose} title={isVi ? '🚀 AI Phân tích dự án' : '🚀 AI Project Decomposer'} size="md">
      <div className="px-6 py-5 space-y-4">
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <Check size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {isVi ? `Đã tạo dự án "${result?.projectName}"` : `Created project "${result?.projectName}"`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {isVi ? `${selectedTasks.size} công việc đã được thêm vào dự án.` : `${selectedTasks.size} tasks added to the project.`}
            </p>
            <Button variant="primary" onClick={handleClose}>{isVi ? 'Xem dự án' : 'View project'}</Button>
          </div>
        ) : !result ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isVi ? 'Mô tả mục tiêu dự án của bạn:' : 'Describe your project goal:'}
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder={isVi
                  ? 'VD: Xây dựng website landing page cho sản phẩm mới, ra mắt trong 4 tuần…'
                  : 'E.g.: Build a landing page for our new product, launch in 4 weeks…'}
                value={goal}
                onChange={e => setGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) decompose() }}
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
            <Button variant="primary" onClick={decompose} disabled={!goal.trim() || loading} className="w-full justify-center">
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {isVi ? 'Đang phân tích…' : 'Analysing…'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {isVi ? 'Phân tích & tạo kế hoạch' : 'Decompose into tasks'}
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{result.projectName}</h3>
                {result.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{result.description}</p>}
              </div>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 ml-2 shrink-0"><X size={14} /></button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {result.tasks.map((task, i) => (
                <div key={i} className={cn('rounded-xl border transition-colors', selectedTasks.has(i) ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800')}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button onClick={() => toggleTask(i)}
                      className={cn('shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors', selectedTasks.has(i) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600')}>
                      {selectedTasks.has(i) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-xs font-medium', selectedTasks.has(i) ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 line-through')}>{task.title}</span>
                    </div>
                    <span className={cn('text-[10px] font-semibold shrink-0', PRIORITY_COLOR[task.priority] ?? 'text-slate-400')}>{task.priority}</span>
                    {task.estimatedHours > 0 && <span className="text-[10px] text-slate-400 shrink-0">{task.estimatedHours}h</span>}
                    {task.description && (
                      <button onClick={() => toggleDetails(i)} className="text-slate-400 hover:text-slate-600">
                        {showDetails.has(i) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                  {showDetails.has(i) && task.description && (
                    <p className="px-3 pb-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-1.5">{task.description}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedTasks.size}/{result.tasks.length} {isVi ? 'công việc' : 'tasks'}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>{isVi ? 'Làm lại' : 'Reset'}</Button>
                <Button variant="primary" size="sm" onClick={createAll} disabled={selectedTasks.size === 0 || creating}>
                  {creating ? (
                    <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <><Plus size={13} />{isVi ? 'Tạo dự án' : 'Create project'}</>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
