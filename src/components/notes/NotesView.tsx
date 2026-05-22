import { useState, useMemo, memo } from 'react'
import { StickyNote, Pin, Pencil, Trash2, Plus, LayoutGrid, List, CheckSquare, Square, FileDown, Trash, ImageIcon } from 'lucide-react'
import { cn, formatRelativeTime } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import type { Note } from '../../types'

interface NotesViewProps {
  onAddNote: () => void
  onEditNote: (note: Note) => void
}

function formatDateForExport(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Strip markdown image syntax from content and capture the first image src.
 * Replaces `![alt](src)` with a short placeholder so the preview stays readable.
 */
function previewFromContent(content: string): { text: string; firstImage: string | null; imageCount: number } {
  let firstImage: string | null = null
  let imageCount = 0
  const text = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => {
    if (!firstImage) firstImage = src
    imageCount += 1
    return alt ? `📷 ${alt}` : '📷'
  })
  return { text, firstImage, imageCount }
}

export default function NotesView({ onAddNote, onEditNote }: NotesViewProps) {
  const { state, dispatch } = useApp()
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const folderMap = useMemo(
    () => new Map(state.noteFolders.map(f => [f.id, f])),
    [state.noteFolders]
  )

  const activeFolder = state.activeNoteFolderId
    ? (folderMap.get(state.activeNoteFolderId) ?? null)
    : null

  const visibleNotes = useMemo(() => state.notes.filter(n => {
    if (activeFolder && n.folderId !== activeFolder.id) return false
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    }
    return true
  }), [state.notes, activeFolder, state.searchQuery])

  const sorted = useMemo(() => [...visibleNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  }), [visibleNotes])

  const heading = activeFolder ? activeFolder.name : 'Tất cả ghi chú'

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sorted.map(n => n.id)))
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = () => {
    selectedIds.forEach(id => dispatch({ type: 'DELETE_NOTE', payload: id }))
    exitSelectMode()
  }

  const handleBulkExport = () => {
    const notes = sorted.filter(n => selectedIds.has(n.id))
    const text = notes.map(n => {
      const folder = n.folderId ? (state.noteFolders.find(f => f.id === n.folderId)?.name ?? '') : ''
      const lines = [
        `# ${n.title || 'Ghi chú không tiêu đề'}`,
        folder ? `Thư mục: ${folder}` : null,
        `Ngày: ${formatDateForExport(n.updatedAt)}`,
        '',
        n.content || '(trống)',
      ].filter((l): l is string => l !== null)
      return lines.join('\n')
    }).join('\n\n---\n\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const sharedNoteProps = (note: Note) => {
    const folder = note.folderId ? folderMap.get(note.folderId) : null
    return {
      note,
      folderName: folder?.name ?? '',
      folderColor: folder?.color ?? '',
      onEdit: () => onEditNote(note),
      onDelete: () => dispatch({ type: 'DELETE_NOTE', payload: note.id }),
      onTogglePin: () => dispatch({ type: 'UPDATE_NOTE', payload: { id: note.id, pinned: !note.pinned } }),
      selectMode,
      selected: selectedIds.has(note.id),
      onSelect: () => toggleSelect(note.id),
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <StickyNote size={20} className="text-indigo-500" />
          {heading}
        </h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {visibleNotes.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* View type toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => setViewType('grid')}
              title="Dạng lưới"
              className={cn(
                'p-1.5 transition-colors',
                viewType === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewType('list')}
              title="Dạng danh sách"
              className={cn(
                'p-1.5 transition-colors',
                viewType === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              )}
            >
              <List size={14} />
            </button>
          </div>

          {/* Select mode toggle */}
          {!selectMode && sorted.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
              <CheckSquare size={14} /> Chọn
            </Button>
          )}
        </div>
      </div>

      {/* Selection toolbar */}
      {selectMode && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors"
          >
            {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <span className="text-sm text-indigo-500 dark:text-indigo-400">
            {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size}` : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="ghost" size="sm"
                  onClick={handleBulkExport}
                  className="text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  <FileDown size={13} /> Xuất ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <Trash size={13} /> Xoá ({selectedIds.size})
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>Huỷ</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
            <StickyNote size={32} className="text-indigo-400" />
          </div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">Chưa có ghi chú nào</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-5">Bắt đầu ghi lại ý tưởng, suy nghĩ của bạn</p>
          <Button variant="primary" size="sm" onClick={onAddNote}>
            <Plus size={14} /> Tạo ghi chú đầu tiên
          </Button>
        </div>
      ) : viewType === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map(note => (
            <NoteCard key={note.id} {...sharedNoteProps(note)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/60">
          {sorted.map(note => (
            <NoteListRow key={note.id} {...sharedNoteProps(note)} />
          ))}
        </div>
      )}
    </div>
  )
}

interface NoteItemProps {
  note: Note
  folderName: string
  folderColor: string
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
  selectMode: boolean
  selected: boolean
  onSelect: () => void
}

const NoteCard = memo(function NoteCard({ note, folderName, folderColor, onEdit, onDelete, onTogglePin, selectMode, selected, onSelect }: NoteItemProps) {
  const { text: previewText, firstImage, imageCount } = previewFromContent(note.content)
  return (
    <div
      onClick={selectMode ? onSelect : onEdit}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-white dark:bg-slate-800 h-48 overflow-hidden',
        'shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
        selected
          ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-700'
          : note.pinned
            ? 'border-amber-300 dark:border-amber-600/60 bg-amber-50/40 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700',
        folderColor && 'border-l-[3px]'
      )}
      style={folderColor ? { borderLeftColor: folderColor } : undefined}
    >
      {/* Image thumbnail (if note contains images) */}
      {firstImage && (
        <div className="relative h-20 w-full shrink-0 bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <img src={firstImage} alt="" className="w-full h-full object-cover" loading="lazy" />
          {imageCount > 1 && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
              +{imageCount - 1}
            </span>
          )}
        </div>
      )}

      {/* Pin indicator / select checkbox */}
      <div className="absolute top-2.5 left-3 z-10">
        {selectMode ? (
          selected
            ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm" />
            : <Square size={16} className="text-slate-400 drop-shadow-sm" />
        ) : note.pinned ? (
          <Pin size={12} className="text-amber-500 fill-amber-500 drop-shadow-sm" />
        ) : null}
      </div>

      {/* Action buttons */}
      {!selectMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={e => { e.stopPropagation(); onTogglePin() }}
            title={note.pinned ? 'Bỏ ghim' : 'Ghim'}
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center transition-colors shadow-sm border border-slate-200 dark:border-slate-600',
              note.pinned
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                : 'text-slate-400 bg-white dark:bg-slate-700 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
            )}
          >
            <Pin size={11} className={note.pinned ? 'fill-amber-500' : ''} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Chỉnh sửa"
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 bg-white dark:bg-slate-700 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shadow-sm border border-slate-200 dark:border-slate-600"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Xoá"
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 bg-white dark:bg-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm border border-slate-200 dark:border-slate-600"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className={cn('flex-1 px-4 pb-2 overflow-hidden min-h-0', firstImage ? 'pt-2' : 'pt-7')}>
        <p className={cn(
          'text-[15px] font-semibold text-slate-800 dark:text-slate-200 mb-1 leading-tight line-clamp-2',
          selectMode && !firstImage ? 'pl-5' : '',
          !firstImage ? 'pr-14' : '',
          !note.title && 'text-slate-400 dark:text-slate-500 font-normal italic'
        )}>
          {note.title || 'Không có tiêu đề'}
        </p>
        {previewText && (
          <p className={cn(
            'text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap',
            firstImage ? 'line-clamp-2' : 'line-clamp-4',
            selectMode && !firstImage && 'pl-5'
          )}>
            {previewText}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-2.5 pt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60 shrink-0">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">{formatRelativeTime(note.updatedAt)}</span>
        {folderName && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-full">
            {folderName}
          </span>
        )}
      </div>
    </div>
  )
})

const NoteListRow = memo(function NoteListRow({ note, folderName, folderColor, onEdit, onDelete, onTogglePin, selectMode, selected, onSelect }: NoteItemProps) {
  const { text: previewText, firstImage, imageCount } = previewFromContent(note.content)
  return (
    <div
      onClick={selectMode ? onSelect : onEdit}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
      )}
    >
      {/* Checkbox / pin / bullet */}
      <div className="shrink-0 w-5 mt-0.5 flex items-start justify-center">
        {selectMode ? (
          selected
            ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
            : <Square size={16} className="text-slate-400" />
        ) : note.pinned ? (
          <Pin size={13} className="text-amber-500 fill-amber-500" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
      </div>

      {/* Image thumbnail */}
      {firstImage && (
        <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
          <img src={firstImage} alt="" className="w-full h-full object-cover" loading="lazy" />
          {imageCount > 1 && (
            <span className="absolute bottom-0 right-0 px-1 rounded-tl-md bg-black/60 text-white text-[9px] font-medium">
              +{imageCount - 1}
            </span>
          )}
        </div>
      )}

      {/* Title + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {folderColor && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folderColor }} />
          )}
          <p className={cn(
            'text-sm font-semibold truncate',
            note.title ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic font-normal'
          )}>
            {note.title || 'Không có tiêu đề'}
          </p>
          {imageCount > 0 && !firstImage && (
            <span className="shrink-0 flex items-center text-slate-400 dark:text-slate-500" title={`${imageCount} ảnh`}>
              <ImageIcon size={11} />
            </span>
          )}
        </div>
        {previewText && (
          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-3 leading-relaxed mt-0.5 whitespace-pre-wrap">
            {previewText}
          </p>
        )}
      </div>

      {/* Folder name — desktop only */}
      {folderName && (
        <span className="shrink-0 hidden md:flex items-center text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-full">
          {folderName}
        </span>
      )}

      {/* Relative time */}
      <span className="shrink-0 hidden sm:block text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
        {formatRelativeTime(note.updatedAt)}
      </span>

      {/* Actions */}
      {!selectMode && (
        <div className="shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onTogglePin() }}
            title={note.pinned ? 'Bỏ ghim' : 'Ghim'}
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
              note.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
            )}
          >
            <Pin size={12} className={note.pinned ? 'fill-amber-500' : ''} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            title="Chỉnh sửa"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Xoá"
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
})
