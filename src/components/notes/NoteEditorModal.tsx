import { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  ChevronDown, Check, X, Copy, Share2,
  Bold, Italic, Minus, ImagePlus, Eye, Pencil, List,
} from 'lucide-react'
import { cn, formatRelativeTime } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import type { Note } from '../../types'

// ── Simple markdown renderer (no deps) ────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function parseInline(line: string): string {
  // Temporarily replace image tokens to protect src from HTML-escaping
  const imgs: string[] = []
  const withPh = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const i = imgs.length
    imgs.push(`<img src="${src}" alt="${esc(alt)}" class="inline max-h-40 rounded my-1 align-middle" />`)
    return `\x00IMG${i}\x00`
  })
  let r = esc(withPh)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')
  imgs.forEach((html, i) => { r = r.split(`\x00IMG${i}\x00`).join(html) })
  return r
}

function renderMd(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false
  const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false } }

  for (const raw of lines) {
    // Block image (full line)
    const imgM = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgM) {
      flushUl()
      out.push(`<img src="${imgM[2]}" alt="${esc(imgM[1])}" class="max-w-full rounded-xl my-3 block shadow-sm" style="max-height:480px;object-fit:contain" />`)
      continue
    }
    const h1 = raw.match(/^# (.+)/)
    if (h1) { flushUl(); out.push(`<h1 class="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-slate-100">${parseInline(h1[1])}</h1>`); continue }
    const h2 = raw.match(/^## (.+)/)
    if (h2) { flushUl(); out.push(`<h2 class="text-lg font-semibold mt-4 mb-1 text-slate-800 dark:text-slate-200">${parseInline(h2[1])}</h2>`); continue }
    const h3 = raw.match(/^### (.+)/)
    if (h3) { flushUl(); out.push(`<h3 class="text-[15px] font-semibold mt-3 mb-0.5 text-slate-700 dark:text-slate-300">${parseInline(h3[1])}</h3>`); continue }
    if (raw === '---') { flushUl(); out.push('<hr class="my-4 border-slate-200 dark:border-slate-700" />'); continue }
    const li = raw.match(/^[-*] (.+)/)
    if (li) {
      if (!inUl) { out.push('<ul class="my-1.5 pl-5 space-y-0.5">'); inUl = true }
      out.push(`<li class="list-disc text-slate-700 dark:text-slate-300">${parseInline(li[1])}</li>`)
      continue
    }
    flushUl()
    if (raw.trim() === '') { out.push('<div class="h-3"></div>'); continue }
    out.push(`<p class="leading-relaxed text-slate-700 dark:text-slate-300">${parseInline(raw)}</p>`)
  }

  flushUl()
  return out.join('\n')
}

// ── Image compression (canvas, max 1200px, JPEG 82%) ──────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
    img.src = url
  })
}

// ── Toolbar button ─────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      {children}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface NoteEditorModalProps {
  open: boolean
  note: Note | null
  onClose: () => void
  defaultFolderId?: string
}

export default function NoteEditorModal({ open, note, onClose, defaultFolderId = '' }: NoteEditorModalProps) {
  const { state, dispatch } = useApp()

  const [title,              setTitle]             = useState('')
  const [content,            setContent]           = useState('')
  const [folderId,           setFolderId]          = useState(defaultFolderId)
  const [folderDropdownOpen, setFolderDropdownOpen]= useState(false)
  const [saveStatus,         setSaveStatus]        = useState<'idle' | 'dirty' | 'saved'>('idle')
  const [copied,             setCopied]            = useState(false)
  const [previewMode,        setPreviewMode]       = useState(false)
  const [isDragOver,         setIsDragOver]        = useState(false)

  const editingIdRef  = useRef<string | null>(null)
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Refs so async callbacks always see the latest values without stale closures
  const titleRef    = useRef(title)
  const folderIdRef = useRef(folderId)
  const contentRef  = useRef(content)
  useEffect(() => { titleRef.current    = title    }, [title])
  useEffect(() => { folderIdRef.current = folderId }, [folderId])
  useEffect(() => { contentRef.current  = content  }, [content])

  // ── Reset on open ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    if (note) {
      editingIdRef.current = note.id
      setTitle(note.title)
      setContent(note.content)
      setFolderId(note.folderId)
      // Default to preview for any note that has content
      setPreviewMode(note.content.trim().length > 0)
    } else {
      editingIdRef.current = null
      setTitle('')
      setContent('')
      setFolderId(defaultFolderId)
      setPreviewMode(false)
    }
    setSaveStatus('idle')
  }, [open, note, defaultFolderId])

  // ── Auto-save (debounced 600ms) ──────────────────────────────────────────

  const scheduleSave = useCallback((t: string, c: string, f: string) => {
    setSaveStatus('dirty')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (editingIdRef.current) {
        dispatch({ type: 'UPDATE_NOTE', payload: { id: editingIdRef.current, title: t, content: c, folderId: f } })
      } else {
        const id = crypto.randomUUID()
        editingIdRef.current = id
        dispatch({ type: 'ADD_NOTE', payload: { id, title: t, content: c, folderId: f, pinned: false } })
      }
      setSaveStatus('saved')
    }, 600)
  }, [dispatch])

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val)
    scheduleSave(val, contentRef.current, folderIdRef.current)
  }, [scheduleSave])

  const handleContentChange = useCallback((val: string) => {
    setContent(val)
    scheduleSave(titleRef.current, val, folderIdRef.current)
  }, [scheduleSave])

  const handleFolderChange = useCallback((newFolderId: string) => {
    setFolderId(newFolderId)
    setFolderDropdownOpen(false)
    scheduleSave(titleRef.current, contentRef.current, newFolderId)
  }, [scheduleSave])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // ── Image insertion ──────────────────────────────────────────────────────

  const insertImages = useCallback(async (files: FileList | File[]) => {
    const ta = textareaRef.current
    let cursor = ta ? ta.selectionStart : contentRef.current.length
    let next = contentRef.current

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const base64 = await compressImage(file)
      if (!base64) continue
      const alt = file.name.replace(/\.[^.]+$/, '')
      const md = `\n![${alt}](${base64})\n`
      next = next.slice(0, cursor) + md + next.slice(cursor)
      cursor += md.length
    }

    handleContentChange(next)
    requestAnimationFrame(() => ta?.focus())
  }, [handleContentChange])

  // Insert markdown syntax around cursor selection
  const insertAtCursor = useCallback((before: string, after = '', defaultText = '') => {
    const ta     = textareaRef.current
    const cur    = contentRef.current
    const start  = ta?.selectionStart ?? cur.length
    const end    = ta?.selectionEnd   ?? cur.length
    const sel    = cur.slice(start, end) || defaultText
    const newVal = cur.slice(0, start) + before + sel + after + cur.slice(end)
    handleContentChange(newVal)
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }, [handleContentChange])

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) { e.preventDefault(); await insertImages(files) }
  }, [insertImages])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) await insertImages(files)
  }, [insertImages])

  const handleImageInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { await insertImages(e.target.files); e.target.value = '' }
  }, [insertImages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 'b') { e.preventDefault(); insertAtCursor('**', '**', 'in đậm') }
    if (ctrl && e.key === 'i') { e.preventDefault(); insertAtCursor('*', '*', 'in nghiêng') }
    if (e.key === 'Tab')       { e.preventDefault(); insertAtCursor('  ', '') }
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const currentFolder = useMemo(
    () => state.noteFolders.find(f => f.id === folderId) ?? null,
    [folderId, state.noteFolders],
  )
  const currentFolderName = currentFolder?.name ?? 'Không có thư mục'

  const currentNote = useMemo(() => {
    const id = note?.id ?? editingIdRef.current
    if (!id) return null
    return state.notes.find(n => n.id === id) ?? note ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, state.notes, saveStatus])

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  const handleShare      = () => copyToClipboard(`${title}\n\n${content}`)
  const handleExportForAI = () => {
    const folder = currentFolderName !== 'Không có thư mục' ? currentFolderName : null
    const date   = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const parts  = [
      `# ${title || 'Ghi chú không tiêu đề'}`,
      folder ? `Thư mục: ${folder}` : null,
      `Ngày: ${date}`,
      '',
      content || '(trống)',
    ].filter(Boolean)
    copyToClipboard((parts as string[]).join('\n'))
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  const footer = (
    <div className="flex items-center justify-between px-7 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <span className={cn(
        'text-xs flex items-center gap-1.5 transition-colors',
        saveStatus === 'saved' ? 'text-emerald-600 dark:text-emerald-400' :
        saveStatus === 'dirty' ? 'text-amber-500 dark:text-amber-400' :
        'text-slate-400 dark:text-slate-500',
      )}>
        {saveStatus === 'saved' && <><Check size={12} /> Đã lưu</>}
        {saveStatus === 'dirty' && 'Đang soạn…'}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleShare} title="Sao chép ghi chú"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
        <button type="button" onClick={handleExportForAI} title="Xuất để dán vào AI"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
          <Share2 size={13} />
          Xuất cho AI
        </button>
        <Button variant="ghost" size="sm" onClick={onClose}><X size={14} /> Đóng</Button>
      </div>
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} size="lg" footer={footer}>
      {/* Hidden file picker for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageInputChange}
      />

      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="px-7 pt-7 pb-1">
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Tiêu đề ghi chú…"
            className="w-full text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 leading-tight"
          />
        </div>

        {/* Folder selector + metadata */}
        <div className="px-7 pb-3 flex items-center gap-3 flex-wrap relative">
          <button type="button" onClick={() => setFolderDropdownOpen(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              folderId
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600',
            )}>
            {folderId && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentFolder?.color ?? '#6366f1' }} />}
            {currentFolderName}
            <ChevronDown size={11} className={cn('transition-transform', folderDropdownOpen && 'rotate-180')} />
          </button>

          {currentNote && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <span>Tạo {formatRelativeTime(currentNote.createdAt)}</span>
              {currentNote.createdAt !== currentNote.updatedAt && (
                <><span className="opacity-60">·</span><span>Sửa {formatRelativeTime(currentNote.updatedAt)}</span></>
              )}
            </div>
          )}

          {folderDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFolderDropdownOpen(false)} />
              <div className="absolute left-7 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden pop-in">
                <button type="button" onClick={() => handleFolderChange('')}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                    !folderId ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                  Không có thư mục
                </button>
                {state.noteFolders.map(folder => (
                  <button key={folder.id} type="button" onClick={() => handleFolderChange(folder.id)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      folderId === folder.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: folder.color }} />
                    {folder.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 mx-7" />

        {/* Formatting toolbar */}
        <div className="flex items-center justify-between px-4 py-1 border-b border-slate-100 dark:border-slate-700/60 shrink-0 min-h-[36px]">
          {previewMode ? (
            // Preview mode: only show Edit button
            <div className="flex items-center gap-1.5 w-full justify-end">
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setPreviewMode(false) }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
              >
                <Pencil size={12} />
                Chỉnh sửa
              </button>
            </div>
          ) : (
            // Edit mode: full formatting toolbar
            <>
              <div className="flex items-center gap-0.5">
                <ToolbarBtn title="In đậm (Ctrl+B)" onClick={() => insertAtCursor('**', '**', 'in đậm')}>
                  <Bold size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="In nghiêng (Ctrl+I)" onClick={() => insertAtCursor('*', '*', 'in nghiêng')}>
                  <Italic size={13} />
                </ToolbarBtn>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
                <ToolbarBtn title="Tiêu đề 1" onClick={() => insertAtCursor('\n# ', '', 'Tiêu đề 1')}>
                  <span className="text-[11px] font-bold leading-none">H1</span>
                </ToolbarBtn>
                <ToolbarBtn title="Tiêu đề 2" onClick={() => insertAtCursor('\n## ', '', 'Tiêu đề 2')}>
                  <span className="text-[11px] font-bold leading-none">H2</span>
                </ToolbarBtn>
                <ToolbarBtn title="Tiêu đề 3" onClick={() => insertAtCursor('\n### ', '', 'Tiêu đề 3')}>
                  <span className="text-[11px] font-bold leading-none">H3</span>
                </ToolbarBtn>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />
                <ToolbarBtn title="Danh sách" onClick={() => insertAtCursor('\n- ', '', 'Mục danh sách')}>
                  <List size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Đường kẻ ngang" onClick={() => insertAtCursor('\n---\n', '')}>
                  <Minus size={13} />
                </ToolbarBtn>
              </div>

              <div className="flex items-center gap-1">
                <ToolbarBtn title="Chèn ảnh — tải lên, dán (Ctrl+V) hoặc kéo thả" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus size={13} />
                </ToolbarBtn>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5" />
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); setPreviewMode(true) }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Eye size={12} />
                  Xem trước
                </button>
              </div>
            </>
          )}
        </div>

        {/* Editor / Preview area */}
        <div
          className={cn('flex-1 px-7 py-5 relative', isDragOver && 'bg-indigo-50/60 dark:bg-indigo-900/10')}
          onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="absolute inset-4 rounded-xl border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/20 flex items-center justify-center z-10 pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-indigo-500 dark:text-indigo-400">
                <ImagePlus size={26} />
                <span className="text-sm font-medium">Thả ảnh vào đây</span>
              </div>
            </div>
          )}

          {previewMode ? (
            // ── Markdown preview ─────────────────────────────────────────
            <div
              className="w-full min-h-[360px] text-[15px] select-text"
              dangerouslySetInnerHTML={{
                __html: renderMd(content) ||
                  '<p class="text-slate-300 dark:text-slate-600 italic">Nội dung trống…</p>',
              }}
            />
          ) : (
            // ── Textarea ─────────────────────────────────────────────────
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder={'Viết ghi chú… Hỗ trợ **in đậm**, *in nghiêng*, # Tiêu đề\nDán ảnh từ clipboard hoặc kéo thả ảnh vào đây'}
              className="w-full h-full min-h-[360px] resize-none bg-transparent border-none outline-none text-[15px] text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 leading-relaxed"
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
