import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, LayoutDashboard, List, Calendar, GanttChart, BarChart3, StickyNote,
  Plus, Moon, Sun, Languages, RefreshCw, Pin, CheckSquare, ChevronRight, Monitor,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../i18n'
import type { ViewMode, Task, Note } from '../../types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNewTask: () => void
  onNewNote: () => void
  onViewTask: (task: Task) => void
  onEditNote: (note: Note) => void
}

interface Item {
  id: string
  group: string
  label: string
  hint?: string
  icon: React.ElementType
  iconColor?: string
  onSelect: () => void
}

const VIEW_ICONS: Record<ViewMode, React.ElementType> = {
  dashboard: BarChart3, kanban: LayoutDashboard, list: List,
  calendar: Calendar, timeline: GanttChart, notes: StickyNote,
}

export default function CommandPalette({ open, onClose, onNewTask, onNewNote, onViewTask, onEditNote }: CommandPaletteProps) {
  const { state, dispatch } = useApp()
  const { syncNow } = useAuth()
  const t = useT()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0) }
  }, [open])

  const items: Item[] = useMemo(() => {
    if (!open) return []
    const out: Item[] = []
    const q = query.trim().toLowerCase()

    // Actions
    out.push({
      id: 'action-new-task', group: t.command.groupActions,
      label: t.command.actionNewTask, icon: Plus, iconColor: 'text-indigo-500',
      hint: 'N', onSelect: () => { onClose(); onNewTask() },
    })
    out.push({
      id: 'action-new-note', group: t.command.groupActions,
      label: t.command.actionNewNote, icon: Plus, iconColor: 'text-violet-500',
      onSelect: () => { onClose(); onNewNote() },
    })
    out.push({
      id: 'action-theme-toggle', group: t.command.groupActions,
      label: t.command.actionToggleTheme, icon: state.darkMode ? Sun : Moon, iconColor: 'text-amber-500',
      onSelect: () => { dispatch({ type: 'TOGGLE_DARK_MODE' }); onClose() },
    })
    out.push({
      id: 'action-theme-system', group: t.command.groupActions,
      label: t.command.actionThemeSystem, icon: Monitor, iconColor: 'text-slate-500',
      onSelect: () => { dispatch({ type: 'SET_DARK_MODE', payload: { mode: 'system' } }); onClose() },
    })
    out.push({
      id: 'action-lang', group: t.command.groupActions,
      label: t.command.actionToggleLanguage, icon: Languages, iconColor: 'text-emerald-500',
      onSelect: () => { dispatch({ type: 'SET_LANGUAGE', payload: state.language === 'vi' ? 'en' : 'vi' }); onClose() },
    })
    out.push({
      id: 'action-sync', group: t.command.groupActions,
      label: t.command.actionSync, icon: RefreshCw, iconColor: 'text-indigo-500',
      onSelect: () => { syncNow(); onClose() },
    })

    // Views
    const views: ViewMode[] = ['dashboard', 'kanban', 'list', 'calendar', 'timeline', 'notes']
    views.forEach(v => {
      out.push({
        id: `view-${v}`, group: t.command.groupViews,
        label: t.views[v], icon: VIEW_ICONS[v], iconColor: 'text-slate-500',
        onSelect: () => { dispatch({ type: 'SET_VIEW_MODE', payload: v }); onClose() },
      })
    })

    // Tasks (limit 12)
    state.tasks.filter(tk => !tk.isNote).slice(0, 50).forEach(task => {
      out.push({
        id: `task-${task.id}`, group: t.command.groupTasks,
        label: task.title,
        hint: t.status[task.status],
        icon: task.pinned ? Pin : CheckSquare,
        iconColor: task.status === 'done' ? 'text-emerald-500' : 'text-slate-400',
        onSelect: () => { onClose(); onViewTask(task) },
      })
    })

    // Notes (limit 50)
    state.notes.slice(0, 50).forEach(note => {
      out.push({
        id: `note-${note.id}`, group: t.command.groupNotes,
        label: note.title || (state.language === 'vi' ? '(không tiêu đề)' : '(untitled)'),
        icon: StickyNote, iconColor: 'text-violet-500',
        onSelect: () => { onClose(); onEditNote(note) },
      })
    })

    if (!q) return out
    return out.filter(it => it.label.toLowerCase().includes(q) || it.group.toLowerCase().includes(q))
  }, [open, query, state.tasks, state.notes, state.darkMode, state.language, dispatch, t, onClose, onNewNote, onNewTask, onViewTask, onEditNote, syncNow])

  // Reset selection when items change
  useEffect(() => { setSelectedIdx(0) }, [query])

  // Group items for rendering
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    items.forEach(it => {
      const list = map.get(it.group) ?? []
      list.push(it)
      map.set(it.group, list)
    })
    return Array.from(map.entries())
  }, [items])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-idx="${selectedIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); items[selectedIdx]?.onSelect() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let flatIdx = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-24 px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm modal-backdrop" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden modal-panel">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.command.placeholder}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-600">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">{t.command.empty}</div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="py-1">
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group}</div>
                {list.map(it => {
                  flatIdx++
                  const isSel = flatIdx === selectedIdx
                  const Icon = it.icon
                  const i = flatIdx
                  return (
                    <button
                      key={it.id}
                      data-cmd-idx={i}
                      onMouseEnter={() => setSelectedIdx(i)}
                      onClick={it.onSelect}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                        isSel ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      <Icon size={14} className={cn('shrink-0', it.iconColor)} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && <span className="text-[11px] text-slate-400">{it.hint}</span>}
                      {isSel && <ChevronRight size={12} className="text-indigo-400" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-400 flex items-center justify-between">
          <span>{t.command.hint}</span>
          <span className="hidden sm:inline">⌘K</span>
        </div>
      </div>
    </div>
  )
}
