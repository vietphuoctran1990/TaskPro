import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { ChevronDown, Check, X, Copy, Share2 } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  // The note id we're currently editing (created on first open if null)
  const editingIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (note) {
      editingIdRef.current = note.id
      setTitle(note.title)
      setContent(note.content)
      setFolderId(note.folderId)
    } else {
      editingIdRef.current = null
      setTitle('')
      setContent('')
      setFolderId(defaultFolderId)
    }
    setSaveStatus('idle')
  }, [open, note, defaultFolderId])

  const scheduleSave = useCallback((nextTitle: string, nextContent: string, nextFolderId: string) => {
    setSaveStatus('dirty')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (editingIdRef.current) {
        dispatch({
          type: 'UPDATE_NOTE',
          payload: { id: editingIdRef.current, title: nextTitle, content: nextContent, folderId: nextFolderId },
        })
      } else {
        const id = crypto.randomUUID()
        editingIdRef.current = id
        dispatch({
          type: 'ADD_NOTE',
          payload: { id, title: nextTitle, content: nextContent, folderId: nextFolderId, pinned: false },
        })
      }
      setSaveStatus('saved')
    }, 600)
  }, [dispatch])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    scheduleSave(val, content, folderId)
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    scheduleSave(title, val, folderId)
  }

  const handleFolderChange = (newFolderId: string) => {
    setFolderId(newFolderId)
    setFolderDropdownOpen(false)
    scheduleSave(title, content, newFolderId)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  const currentFolder = useMemo(
    () => state.noteFolders.find(f => f.id === folderId) ?? null,
    [folderId, state.noteFolders]
  )
  const currentFolderName = currentFolder?.name ?? 'Không có thư mục'

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleShare = () => copyToClipboard(`${title}\n\n${content}`)

  const handleExportForAI = () => {
    const folder = currentFolderName !== 'Không có thư mục' ? currentFolderName : null
    const date = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const parts = [
      `# ${title || 'Ghi chú không tiêu đề'}`,
      folder ? `Thư mục: ${folder}` : null,
      `Ngày: ${date}`,
      '',
      content || '(trống)',
    ].filter(p => p !== null)
    copyToClipboard(parts.join('\n'))
  }

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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          title="Sao chép ghi chú"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
        <button
          type="button"
          onClick={handleExportForAI}
          title="Xuất để dán vào AI"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
        >
          <Share2 size={13} />
          Xuất cho AI
        </button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={14} /> Đóng
        </Button>
      </div>
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
                style={{ backgroundColor: currentFolder?.color ?? '#6366f1' }}
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
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  )
}
