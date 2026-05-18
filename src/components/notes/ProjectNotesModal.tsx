import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, X, Plus, Trash2, Pencil, Check, StickyNote, FileText } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import type { Project } from '../../types'

interface Props {
  project: Project | null
  onClose: () => void
}

// ── Note item (inline edit) ────────────────────────────────────────────────
function NoteItem({
  id, title: initTitle, description: initDesc,
  onSave, onDelete,
}: {
  id: string; title: string; description: string
  onSave: (id: string, title: string, desc: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(initTitle)
  const [desc,  setDesc]      = useState(initDesc)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) titleRef.current?.focus() }, [editing])

  const commit = () => {
    if (!title.trim()) return
    onSave(id, title.trim(), desc.trim())
    setEditing(false)
  }

  const cancel = () => {
    setTitle(initTitle); setDesc(initDesc); setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2">
        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          placeholder="Tiêu đề ghi chú…"
          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Nội dung (tuỳ chọn)…"
          rows={3}
          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <button
            onClick={commit}
            disabled={!title.trim()}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            <Check size={11} /> Lưu
          </button>
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <StickyNote size={14} className="mt-0.5 shrink-0 text-indigo-400 dark:text-indigo-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{initTitle}</p>
        {initDesc && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">{initDesc}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(id)}
          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Add note form ──────────────────────────────────────────────────────────
function AddNoteForm({ onAdd, onCancel }: { onAdd: (title: string, desc: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [desc,  setDesc]  = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const submit = () => {
    if (!title.trim()) return
    onAdd(title.trim(), desc.trim())
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 p-3 space-y-2 mb-2">
      <input
        ref={titleRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Tiêu đề ghi chú…"
        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Nội dung (tuỳ chọn)…"
        rows={3}
        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          <Check size={11} /> Thêm
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Hủy
        </button>
      </div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ProjectNotesModal({ project, onClose }: Props) {
  const { state, dispatch } = useApp()
  const [tab, setTab]       = useState<'notes' | 'scratch'>('notes')
  const [adding, setAdding] = useState(false)

  // Scratchpad state
  const [scratchText, setScratchText] = useState('')
  const [saved, setSaved]             = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (project) { setScratchText(project.notes ?? ''); setSaved(true) }
  }, [project?.id])

  const handleScratchChange = (value: string) => {
    setScratchText(value)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!project) return
      dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, notes: value } })
      setSaved(true)
    }, 800)
  }

  const handleScratchSave = () => {
    if (!project) return
    if (timerRef.current) clearTimeout(timerRef.current)
    dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, notes: scratchText } })
    setSaved(true)
  }

  // Note tasks for this project
  const noteItems = project
    ? state.tasks.filter(t => t.isNote && t.projectId === project.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []

  const handleAddNote = useCallback((title: string, desc: string) => {
    if (!project) return
    dispatch({
      type: 'ADD_TASK',
      payload: {
        title, description: desc,
        isNote: true,
        projectId: project.id,
        status: 'todo', priority: 'low',
        labels: [], subtasks: [], comments: [],
        dueDate: null, dueTime: null,
        slaHours: null, estimatedHours: null,
        recurrence: null,
      },
    })
    setAdding(false)
  }, [project, dispatch])

  const handleSaveNote = useCallback((id: string, title: string, desc: string) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, title, description: desc } })
  }, [dispatch])

  const handleDeleteNote = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TASK', payload: id })
  }, [dispatch])

  if (!project) return null

  return (
    <Modal open={!!project} onClose={onClose} size="lg" title={`${project.name} — Ghi chú`}>
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
        <button
          onClick={() => setTab('notes')}
          className={`flex items-center gap-1.5 py-3 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'notes'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <StickyNote size={14} /> Ghi chú
          {noteItems.length > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold flex items-center justify-center">
              {noteItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('scratch')}
          className={`flex items-center gap-1.5 py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'scratch'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={14} /> Scratchpad
        </button>
      </div>

      {/* Notes tab */}
      {tab === 'notes' && (
        <div className="px-4 py-4 flex flex-col gap-1 min-h-[320px] max-h-[60vh] overflow-y-auto">
          {adding ? (
            <AddNoteForm onAdd={handleAddNote} onCancel={() => setAdding(false)} />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 py-2 px-3 mb-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <Plus size={14} /> Thêm ghi chú mới
            </button>
          )}

          {noteItems.length === 0 && !adding && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
              <StickyNote size={32} className="text-slate-200 dark:text-slate-700" />
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chưa có ghi chú nào</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ghi chú sẽ không xuất hiện ở Kanban, Danh sách hay lịch</p>
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {noteItems.map(note => (
              <NoteItem
                key={note.id}
                id={note.id}
                title={note.title}
                description={note.description}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scratchpad tab */}
      {tab === 'scratch' && (
        <div className="px-6 py-4 flex flex-col gap-3">
          <textarea
            autoFocus
            value={scratchText}
            onChange={e => handleScratchChange(e.target.value)}
            placeholder={`Ghi chú, tài liệu, meeting notes cho dự án "${project.name}"…\n\nHỗ trợ Markdown:\n# Tiêu đề\n- Danh sách\n**In đậm** _Nghiêng_`}
            className="w-full min-h-[360px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs transition-colors ${saved ? 'text-emerald-500' : 'text-slate-400'}`}>
              {saved ? '✓ Đã lưu' : 'Đang soạn…'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={12} /> Đóng
              </button>
              <button
                onClick={handleScratchSave}
                disabled={saved}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Save size={12} /> Lưu ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
