import { StickyNote, Pin, Pencil, Trash2, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import type { Note } from '../../types'

interface NotesViewProps {
  onAddNote: () => void
  onEditNote: (note: Note) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NotesView({ onAddNote, onEditNote }: NotesViewProps) {
  const { state, dispatch } = useApp()

  const activeFolder = state.activeNoteFolderId
    ? state.noteFolders.find(f => f.id === state.activeNoteFolderId) ?? null
    : null

  const visibleNotes = state.notes.filter(n => {
    if (activeFolder && n.folderId !== activeFolder.id) return false
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    }
    return true
  })

  // Pinned notes first
  const sorted = [...visibleNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const heading = activeFolder ? activeFolder.name : 'Tất cả ghi chú'

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <StickyNote size={20} className="text-indigo-500" />
          {heading}
        </h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {visibleNotes.length}
        </span>
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={onAddNote}>
            <Plus size={14} />
            <span>Tạo ghi chú</span>
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        /* Empty state */
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
      ) : (
        /* Notes grid */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              folderName={note.folderId ? (state.noteFolders.find(f => f.id === note.folderId)?.name ?? '') : ''}
              onEdit={() => onEditNote(note)}
              onDelete={() => dispatch({ type: 'DELETE_NOTE', payload: note.id })}
              onTogglePin={() => dispatch({ type: 'UPDATE_NOTE', payload: { id: note.id, pinned: !note.pinned } })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface NoteCardProps {
  note: Note
  folderName: string
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}

function NoteCard({ note, folderName, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-white dark:bg-slate-800',
        'border-slate-200 dark:border-slate-700',
        'shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        'min-h-[140px]'
      )}
    >
      {/* Pin indicator */}
      {note.pinned && (
        <div className="absolute top-2 left-2 text-amber-500">
          <Pin size={12} className="fill-amber-500" />
        </div>
      )}

      {/* Action buttons — always visible on touch, hover-reveal on desktop */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={e => { e.stopPropagation(); onTogglePin() }}
          title={note.pinned ? 'Bỏ ghim' : 'Ghim ghi chú'}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
            note.pinned
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100'
              : 'text-slate-400 bg-white dark:bg-slate-700 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30',
            'shadow-sm border border-slate-200 dark:border-slate-600'
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
          title="Xóa"
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 bg-white dark:bg-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm border border-slate-200 dark:border-slate-600"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Card body — click to edit */}
      <div className="flex-1 p-4 pt-3" onClick={onEdit}>
        <p className={cn(
          'text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5 pr-16 leading-snug',
          !note.title && 'text-slate-400 dark:text-slate-500 font-normal italic'
        )}>
          {note.title || 'Không có tiêu đề'}
        </p>
        {note.content && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">
            {note.content}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
          {formatDate(note.updatedAt)}
        </span>
        {folderName && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
            {folderName}
          </span>
        )}
      </div>
    </div>
  )
}
