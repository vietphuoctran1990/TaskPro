import { useState, useCallback, useRef } from 'react'
import {
  Calendar, CheckSquare, Clock, MessageSquare,
  Pencil, Plus, Send, Timer, Trash2, X, ExternalLink,
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { PriorityBadge, Badge } from '../ui/Badge'
import SLABadge from '../sla/SLABadge'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import { useToast } from '../../context/ToastContext'
import { cn, formatDateTime, getDeadline, getTimeRemaining } from '../../lib/utils'
import { haptic } from '../../lib/feedback'
import { useNow } from '../../hooks/useNow'
import { googleCalendarUrl } from '../../lib/ical'
import type { Task } from '../../types'

interface TaskDetailProps {
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
  onFocus?: (task: Task) => void
}

export default function TaskDetail({ task, onClose, onEdit, onFocus }: TaskDetailProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const { toast } = useToast()
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const now = useNow()
  const commentRef = useRef<HTMLTextAreaElement>(null)

  const project = task ? state.projects.find(p => p.id === task.projectId) : null
  const labels = task ? state.labels.filter(l => task.labels.includes(l.id)) : []
  const deadline = task ? getDeadline(task) : null
  const completedSub = task?.subtasks.filter(s => s.done).length ?? 0
  const totalSub = task?.subtasks.length ?? 0
  const progress = totalSub ? Math.round((completedSub / totalSub) * 100) : 0

  const handleToggleSub = useCallback((sid: string) => {
    if (!task) return
    const target = task.subtasks.find(s => s.id === sid)
    if (target && !target.done) haptic(6)
    dispatch({
      type: 'UPDATE_TASK',
      payload: { id: task.id, subtasks: task.subtasks.map(s => s.id === sid ? { ...s, done: !s.done } : s) },
    })
  }, [task, dispatch])

  const handleAddSub = useCallback(() => {
    if (!task || !newSubtask.trim()) return
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: task.id,
        subtasks: [...task.subtasks, { id: Math.random().toString(36).slice(2), title: newSubtask.trim(), done: false }],
      },
    })
    setNewSubtask('')
  }, [task, newSubtask, dispatch])

  const handleDeleteSub = useCallback((sid: string) => {
    if (!task) return
    dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, subtasks: task.subtasks.filter(s => s.id !== sid) } })
  }, [task, dispatch])

  const handleAddComment = useCallback(() => {
    if (!task || !newComment.trim()) return
    dispatch({ type: 'ADD_COMMENT', payload: { taskId: task.id, comment: { text: newComment.trim() } } })
    setNewComment('')
  }, [task, newComment, dispatch])

  const handleDelete = useCallback(() => {
    if (!task) return
    const snapshot = task   // capture full task for restore
    dispatch({ type: 'DELETE_TASK', payload: task.id })
    toast({
      message: state.language === 'vi' ? 'Đã xóa công việc' : 'Task deleted',
      type:    'info',
      action:  {
        label:   state.language === 'vi' ? 'Hoàn tác' : 'Undo',
        onClick: () => dispatch({ type: 'RESTORE_TASK', payload: snapshot }),
      },
    })
    onClose()
  }, [task, dispatch, onClose, toast, state.language])

  const statusDefs = state.statuses.slice().sort((a, b) => a.order - b.order)
  const i18nStatus = t.status as Record<string, string>

  return (
    <Modal open={!!task} onClose={onClose} size="lg">
      {task && (
        <>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className={cn(
                'text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug',
                task.status === 'done' && 'line-through text-slate-400'
              )}>
                {task.title}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { onClose(); onEdit(task) }}><Pencil size={14} /></Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={handleDelete}><Trash2 size={14} /></Button>
                <Button variant="ghost" size="icon" onClick={onClose}><X size={14} /></Button>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={task.priority} />
              <SLABadge task={task} showTimer size="md" />
              {project && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </span>
              )}
              {task.estimatedHours && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  <Timer size={11} /> {task.estimatedHours}h {t.detail.estimated}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {/* SLA timeline */}
            {deadline && task.status !== 'done' && (
              <div className="mx-6 mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <Clock size={12} /> {t.detail.slaDeadline}
                  </span>
                  <span className={cn(
                    'font-semibold',
                    deadline.getTime() < now ? 'text-red-600' : 'text-indigo-600'
                  )}>
                    {deadline.getTime() < now
                      ? `${t.detail.overdueBy} ${getTimeRemaining(deadline)}`
                      : `${getTimeRemaining(deadline)} ${t.detail.remaining}`
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar size={11} />
                    {formatDateTime(task.dueDate, task.dueTime)}
                    {task.slaHours && <span className="text-slate-400">· {task.slaHours}h {t.detail.slaWindow}</span>}
                  </div>
                  {task.dueDate && (
                    <a href={googleCalendarUrl(task)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                      <ExternalLink size={10} /> Google Calendar
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="px-6 py-4 space-y-5">
              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t.detail.description}</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Labels */}
              {labels.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t.detail.labels}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map(l => <Badge key={l.id} color={l.color}>{l.name}</Badge>)}
                  </div>
                </div>
              )}

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare size={11} className="text-slate-400 dark:text-slate-500" /> {t.detail.subtasks}
                  </h3>
                  {totalSub > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{completedSub}/{totalSub}</span>
                  )}
                </div>
                {totalSub > 0 && (
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="space-y-1.5 mb-3">
                  {task.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2.5 group/sub">
                      <button
                        onClick={() => handleToggleSub(sub.id)}
                        className={cn(
                          'shrink-0 w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center',
                          sub.done ? 'bg-emerald-500 border-emerald-500 scale-105' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                        )}
                      >
                        {sub.done && (
                          <svg key={sub.id + '-check'} className="w-2.5 h-2.5 text-white check-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={cn('flex-1 text-sm text-slate-700 dark:text-slate-300', sub.done && 'line-through text-slate-400 dark:text-slate-500')}>
                        {sub.title}
                      </span>
                      <button
                        onClick={() => handleDeleteSub(sub.id)}
                        className="opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text" placeholder={t.detail.addSubtask}
                    value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSub()}
                    className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button variant="ghost" size="icon" onClick={handleAddSub} disabled={!newSubtask.trim()}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare size={11} /> {t.detail.comments} {task.comments.length > 0 && `(${task.comments.length})`}
                </h3>
                {task.comments.length > 0 && (
                  <div className="space-y-2.5 mb-3">
                    {task.comments.map(c => (
                      <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-700/50">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{c.text}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(c.createdAt).toLocaleString(state.language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    ref={commentRef}
                    placeholder={t.detail.addComment}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button variant="primary" size="icon" className="self-end" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send size={14} />
                  </Button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t.detail.ctrlEnter}</p>
              </div>
            </div>
          </div>

          {/* Footer — status changer + focus */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">{t.detail.moveTo}</span>
              {statusDefs.map(s => (
                <button
                  key={s.id}
                  onClick={() => dispatch({ type: 'MOVE_TASK', payload: { id: task.id, status: s.id } })}
                  style={task.status === s.id ? { backgroundColor: s.color } : {}}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    task.status === s.id
                      ? 'text-white'
                      : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600'
                  )}
                >
                  {s.name || i18nStatus[s.id] || s.id}
                </button>
              ))}
              {onFocus && task.status !== 'done' && (
                <button
                  onClick={() => { onClose(); onFocus(task) }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <Timer size={11} /> {t.pomodoro.focus}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
