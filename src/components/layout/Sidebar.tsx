import { useState, useMemo } from 'react'
import { CheckSquare, ChevronDown, CircleDot, FolderOpen, LayoutDashboard, Plus, Tag, X, AlertTriangle, Zap, Clock, TrendingUp, RefreshCw, Settings2, FileText, Sun, Sunset, Calendar, StickyNote } from 'lucide-react'
import { cn, getSLAStatus } from '../../lib/utils'
import { todayLocalISO, tomorrowLocalISO } from '../../lib/dateLocal'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import Button from '../ui/Button'
import { Input } from '../ui/Input'
import type { Project } from '../../types'

const PROJECT_COLORS = ['#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899','#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4']

interface SidebarProps { onClose?: () => void; mobile?: boolean; onSync?: () => void; onManage?: (tab: 'projects' | 'labels' | 'statuses') => void; onNotes?: (project: Project) => void }

export default function Sidebar({ onClose, mobile, onSync, onManage, onNotes }: SidebarProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])

  // Notes section state
  const [notesOpen, setNotesOpen] = useState(true)
  const [addingNoteFolder, setAddingNoteFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState(PROJECT_COLORS[0])

  const stats = useMemo(() => {
    const tasks = state.tasks
    const todayStr    = todayLocalISO()
    const tomorrowStr = tomorrowLocalISO()
    return {
      total:    tasks.length,
      done:     tasks.filter(t => t.status === 'done').length,
      inProg:   tasks.filter(t => t.status === 'in_progress').length,
      breached: tasks.filter(t => getSLAStatus(t) === 'breached').length,
      critical: tasks.filter(t => getSLAStatus(t) === 'critical').length,
      atRisk:   tasks.filter(t => getSLAStatus(t) === 'at_risk').length,
      today:    tasks.filter(t => t.dueDate === todayStr).length,
      tomorrow: tasks.filter(t => t.dueDate === tomorrowStr).length,
      upcoming: tasks.filter(t => t.dueDate != null && t.dueDate > todayStr).length,
    }
  }, [state.tasks])

  const handleAddProject = () => {
    if (!newName.trim()) return
    dispatch({ type: 'ADD_PROJECT', payload: { name: newName.trim(), color: newColor, description: '', notes: '' } })
    setNewName(''); setNewColor(PROJECT_COLORS[0]); setAddingProject(false)
  }

  const handleAddNoteFolder = () => {
    if (!newFolderName.trim()) return
    dispatch({ type: 'ADD_NOTE_FOLDER', payload: { name: newFolderName.trim(), color: newFolderColor } })
    setNewFolderName(''); setNewFolderColor(PROJECT_COLORS[0]); setAddingNoteFolder(false)
  }

  return (
    <aside className={cn('flex flex-col bg-white dark:bg-[#0c1220] border-r border-slate-200/80 dark:border-slate-700/60', mobile ? 'w-full h-full' : 'w-60 shrink-0 h-full')}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <CheckSquare size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t.app.name}</span>
        </div>
        {mobile && <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>}
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* All Tasks */}
        <button
          onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null }); dispatch({ type: 'SET_DATE_FILTER', payload: 'all' }); onClose?.() }}
          className={cn('relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            state.activeProjectId === null && state.dateFilter === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80')}>
          {state.activeProjectId === null && state.dateFilter === 'all' && <span className="absolute left-0 inset-y-1.5 w-0.5 bg-indigo-500 rounded-r-full" />}
          <LayoutDashboard size={15} />
          <span className="flex-1 text-left">{t.sidebar.allTasks}</span>
          <span className="text-xs opacity-40">{stats.total}</span>
        </button>
        {/* Date filter sub-items */}
        <div className="ml-3 pl-3 border-l border-slate-100 dark:border-slate-700/50 space-y-0.5">
          {([
            { key: 'today' as const,    icon: <Sun size={13} />,    label: t.sidebar.today,    count: stats.today },
            { key: 'tomorrow' as const, icon: <Sunset size={13} />, label: t.sidebar.tomorrow, count: stats.tomorrow },
            { key: 'upcoming' as const, icon: <Calendar size={13} />, label: t.sidebar.upcoming, count: stats.upcoming },
          ]).map(({ key, icon, label, count }) => {
            const isActive = state.activeProjectId === null && state.dateFilter === key
            return (
              <button key={key}
                onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null }); dispatch({ type: 'SET_DATE_FILTER', payload: key }); onClose?.() }}
                className={cn('relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                  isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-200')}>
                {isActive && <span className="absolute left-0 inset-y-1 w-0.5 bg-indigo-400 rounded-r-full" />}
                {icon}
                <span className="flex-1 text-left">{label}</span>
                <span className="text-xs opacity-40">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Projects */}
        <div className="pt-3">
          <div className="flex items-center">
            <button className="flex-1 flex items-center gap-2 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={() => setProjectsOpen(v => !v)}>
              <FolderOpen size={12} />
              <span className="flex-1 text-left">{t.sidebar.projects}</span>
              <ChevronDown size={12} className={cn('transition-transform', !projectsOpen && '-rotate-90')} />
            </button>
            {onManage && (
              <button onClick={() => onManage('projects')}
                className="p-1 mr-1 rounded text-slate-300 dark:text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                title={t.sidebar.manage}>
                <Settings2 size={12} />
              </button>
            )}
          </div>
          {projectsOpen && (
            <div className="mt-1 space-y-0.5">
              {state.projects.map(p => (
                <ProjectItem key={p.id} project={p}
                  active={state.activeProjectId === p.id}
                  count={state.tasks.filter(tk => tk.projectId === p.id).length}
                  onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: p.id }); dispatch({ type: 'SET_DATE_FILTER', payload: 'all' }); onClose?.() }}
                  onNotes={onNotes ? () => onNotes(p) : undefined} />
              ))}
              {addingProject ? (
                <div className="px-2 pt-2 pb-1 space-y-2">
                  <Input placeholder={t.sidebar.newProject} value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddProject(); if (e.key === 'Escape') setAddingProject(false) }} autoFocus />
                  <div className="flex gap-1 flex-wrap">
                    {PROJECT_COLORS.map(c => (
                      <button key={c} className={cn('w-5 h-5 rounded-full transition-transform hover:scale-110', newColor === c && 'ring-2 ring-offset-1 ring-slate-400')}
                        style={{ backgroundColor: c }} onClick={() => setNewColor(c)} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleAddProject}>{state.language === 'vi' ? 'Thêm' : 'Add'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingProject(false)}>{t.form.cancel}</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingProject(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Plus size={12} /> {t.sidebar.newProject}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="pt-3">
          <div className="flex items-center">
            <div className="flex-1 flex items-center gap-2 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
              <Tag size={12} /><span>{t.sidebar.labels}</span>
            </div>
            {onManage && (
              <button onClick={() => onManage('labels')}
                className="p-1 mr-1 rounded text-slate-300 dark:text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                title={t.sidebar.manage}>
                <Settings2 size={12} />
              </button>
            )}
          </div>
          <div className="mt-1.5 px-3 flex flex-wrap gap-1.5">
            {state.labels.map(label => (
              <button key={label.id}
                onClick={() => onManage?.('labels')}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: `${label.color}18`, color: label.color }}>
                {label.name}
              </button>
            ))}
          </div>
        </div>

        {/* Statuses */}
        <div className="pt-3">
          <div className="flex items-center">
            <div className="flex-1 flex items-center gap-2 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
              <CircleDot size={12} /><span>{t.manage.statuses}</span>
            </div>
            {onManage && (
              <button onClick={() => onManage('statuses')}
                className="p-1 mr-1 rounded text-slate-300 dark:text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                title={t.sidebar.manage}>
                <Settings2 size={12} />
              </button>
            )}
          </div>
          <div className="mt-1.5 px-3 flex flex-wrap gap-1.5">
            {[...state.statuses].sort((a, b) => a.order - b.order).map(s => {
              const i18nStatus = t.status as Record<string, string>
              const label = s.name || i18nStatus[s.id] || s.id
              return (
                <span key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${s.color}22`, color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {label}
                </span>
              )
            })}
          </div>
          {onManage && (
            <button onClick={() => onManage('statuses')}
              className="mt-1.5 w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
              <Settings2 size={12} /> {t.sidebar.manage}
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="pt-3">
          <div className="flex items-center">
            <button className="flex-1 flex items-center gap-2 px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={() => setNotesOpen(v => !v)}>
              <StickyNote size={12} />
              <span className="flex-1 text-left">Ghi chú</span>
              <ChevronDown size={12} className={cn('transition-transform', !notesOpen && '-rotate-90')} />
            </button>
            <button
              onClick={() => setAddingNoteFolder(true)}
              className="p-1 mr-1 rounded text-slate-300 dark:text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              title="Thêm thư mục ghi chú">
              <Plus size={12} />
            </button>
          </div>
          {notesOpen && (
            <div className="mt-1 space-y-0.5">
              {/* All notes item */}
              {(() => {
                const isActive = state.viewMode === 'notes' && state.activeNoteFolderId === null
                return (
                  <button
                    onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'notes' }); dispatch({ type: 'SET_ACTIVE_NOTE_FOLDER', payload: null }); onClose?.() }}
                    className={cn('relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80')}>
                    {isActive && <span className="absolute left-0 inset-y-1.5 w-0.5 bg-indigo-500 rounded-r-full" />}
                    <StickyNote size={14} />
                    <span className="flex-1 text-left">Tất cả ghi chú</span>
                    <span className="text-xs opacity-40">{state.notes.length}</span>
                  </button>
                )
              })()}

              {/* Note folder items */}
              {state.noteFolders.map(folder => {
                const isActive = state.viewMode === 'notes' && state.activeNoteFolderId === folder.id
                return (
                  <button key={folder.id}
                    onClick={() => { dispatch({ type: 'SET_VIEW_MODE', payload: 'notes' }); dispatch({ type: 'SET_ACTIVE_NOTE_FOLDER', payload: folder.id }); onClose?.() }}
                    className={cn('relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80')}>
                    {isActive && <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full" style={{ backgroundColor: folder.color }} />}
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: folder.color }} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-xs opacity-40">{state.notes.filter(n => n.folderId === folder.id).length}</span>
                  </button>
                )
              })}

              {/* Inline add folder form */}
              {addingNoteFolder ? (
                <div className="px-2 pt-2 pb-1 space-y-2">
                  <Input placeholder="Tên thư mục" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNoteFolder(); if (e.key === 'Escape') setAddingNoteFolder(false) }} autoFocus />
                  <div className="flex gap-1 flex-wrap">
                    {PROJECT_COLORS.map(c => (
                      <button key={c} className={cn('w-5 h-5 rounded-full transition-transform hover:scale-110', newFolderColor === c && 'ring-2 ring-offset-1 ring-slate-400')}
                        style={{ backgroundColor: c }} onClick={() => setNewFolderColor(c)} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleAddNoteFolder}>Thêm</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingNoteFolder(false)}>{t.form.cancel}</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-slate-200/80 dark:border-slate-700/60 px-4 py-4 space-y-3">
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.sidebar.overallProgress}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{stats.done}/{stats.total}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatChip icon={<AlertTriangle size={11} />} label={t.sidebar.breached} value={stats.breached}
            className={stats.breached > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'} />
          <StatChip icon={<Zap size={11} />} label={t.sidebar.critical} value={stats.critical}
            className={stats.critical > 0 ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'} />
          <StatChip icon={<Clock size={11} />} label={t.sidebar.atRisk} value={stats.atRisk}
            className={stats.atRisk > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><TrendingUp size={12} /> {t.sidebar.inProgress}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.inProg}</span>
        </div>
        {onSync && (
          <button onClick={onSync} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 transition-colors border border-slate-200 dark:border-slate-700">
            <RefreshCw size={12} /> {t.sidebar.syncBackup}
          </button>
        )}
      </div>
    </aside>
  )
}

function ProjectItem({ project, active, count, onClick, onNotes }: { project: Project; active: boolean; count: number; onClick: () => void; onNotes?: () => void }) {
  return (
    <div className={cn('relative group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
      active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80')}>
      {active && <span className="absolute left-0 inset-y-1.5 w-0.5 bg-indigo-500 rounded-r-full" />}
      <button onClick={onClick} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <span className="flex-1 truncate">{project.name}</span>
        <span className="text-xs opacity-50">{count}</span>
      </button>
      {onNotes && (
        <button onClick={e => { e.stopPropagation(); onNotes() }}
          title="Ghi chú dự án"
          className={cn(
            'shrink-0 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100',
            project.notes ? 'text-indigo-400 opacity-100' : 'text-slate-300 hover:text-indigo-500'
          )}>
          <FileText size={12} />
        </button>
      )}
    </div>
  )
}

function StatChip({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: number; className: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg border text-center', className)}>
      <div className="flex items-center gap-0.5 font-bold text-sm">{icon}{value}</div>
      <span className="text-[10px] leading-none opacity-75">{label}</span>
    </div>
  )
}
