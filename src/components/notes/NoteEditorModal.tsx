import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import type { Note } from '../../types'

interface NoteEditorModalProps {
  open: boolean
  note: Note | null  // null = new note
  onClose: () => void
  defaultFolderId?: string
}

export default function NoteEditorModal({ open, note, onClose, defaultFolderId = '' }: NoteEditorModalProps) {
  const { state, dispatch } = useApp()

  // Local editable state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [folderId, setFolderId] = useState(defaultFolderId)
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saved'>('idle')

  // The note id we're currently editing (created on first open if null)
  const editingIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNewRef = useRef(false)

  // Initialise local state when modal opens
  useEffect(() => {
    if (!open) return
    if (note) {
      editingIdRef.current = note.id
      setTitle(note.title)
      setContent(note.content)
      setFolderId(note.folderId)
      isNewRef.current = false
      setSaveStatus('idle')
    } else {
      // Will create note on first keystroke
      editingIdRef.current = null
      setTitle('')
      setContent('')
      setFolderId(defaultFolderId)
      isNewRef.current = true
      setSaveStatus('idle')
    }
  }, [open, note, defaultFolderId])

  // Auto-save logic
  const scheduleSave = useCallback((nextTitle: string, nextContent: string, nextFolderId: string) => {
    setSaveStatus('dirty')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const now = new Date().toISOString()
      if (editingIdRef.current) {
        dispatch({
          type: 'UPDATE_NOTE',
          payload: { id: editingIdRef.current, title: nextTitle, content: nextContent, folderId: nextFolderId },
        })
      } else {
        // Create new note, capture id via ADD_NOTE
        // We'll store the id via a workaround: generate locally before dispatch
        const id = crypto.randomUUID ? crypto.randomUUID() : `note_${now}`
        editingIdRef.current = id
        dispatch({
          type: 'ADD_NOTE',
          payload: {
            title: nextTitle,
            content: nextContent,
            folderId: nextFolderId,
            pinned: false,
          },
        })
        // After dispatch the reducer sets a generated id; we can't predict it.
        // So instead we embed the id into the ADD_NOTE payload pattern by not
        // using a custom id — just mark that we've dispatched and pick up the
        // most-recently-created note for future updates.
        // Mark as "need to find id" on next update
        editingIdRef.current = '__pending__'
      }
      setSaveStatus('saved')
    }, 600)
  }, [dispatch])

  // When we're in __pending__ state, find the newest note to get its id
  const resolvePendingId = useCallback(() => {
    if (editingIdRef.current === '__pending__' && state.notes.length > 0) {
      const newest = [...state.notes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
      editingIdRef.current = newest.id
    }
  }, [state.notes])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    resolvePendingId()
    scheduleSave(val, content, folderId)
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    resolvePendingId()
    scheduleSave(title, val, folderId)
  }

  const handleFolderChange = (newFolderId: string) => {
    setFolderId(newFolderId)
    setFolderDropdownOpen(false)
    resolvePendingId()
    scheduleSave(title, content, newFolderId)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  const currentFolderName = folderId
    ? (state.noteFolders.find(f => f.id === folderId)?.name ?? 'Không có thư mục')
    : 'Không có thư mục'

  const footer = (
    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <span className={cn(
        'text-xs flex items-center gap-1.5 transition-colors',
        saveStatus === 'saved' ? 'text-emerald-600 dark:text-emerald-400' :
        saveStatus === 'dirty' ? 'text-amber-500 dark:text-amber-400' :
        'text-slate-400 dark:text-slate-500'
      )}>
        {saveStatus === 'saved' && <><Check size={12} /> Đã lưu</>}
        {saveStatus === 'dirty' && 'Đang soạn…'}
        {saveStatus === 'idle' && ''}
      </span>
      <Button variant="ghost" size="sm" onClick={onClose}>
        <X size={14} /> Đóng
      </Button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} size="lg" footer={footer}>
      <div className="flex flex-col h-full">
        {/* Title input */}
        <div className="px-6 pt-6 pb-2">
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Tiêu đề ghi chú…"
            className="w-full text-lg font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />
        </div>

        {/* Folder selector */}
        <div className="px-6 pb-3 relative">
          <button
            type="button"
            onClick={() => setFolderDropdownOpen(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              folderId
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600'
            )}
          >
            {folderId && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: state.noteFolders.find(f => f.id === folderId)?.color ?? '#6366f1' }}
              />
            )}
            {currentFolderName}
            <ChevronDown size={11} className={cn('transition-transform', folderDropdownOpen && 'rotate-180')} />
          </button>

          {folderDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFolderDropdownOpen(false)} />
              <div className="absolute left-6 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleFolderChange('')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    !folderId ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  )}
                >
                  Không có thư mục
                </button>
                {state.noteFolders.map(folder => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleFolderChange(folder.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      folderId === folder.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: folder.color }} />
                    {folder.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 dark:border-slate-700 mx-6" />

        {/* Content textarea */}
        <div className="flex-1 px-6 py-4">
          <textarea
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Viết ghi chú của bạn…"
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  )
}
