import { useState, useMemo } from 'react'
import { CheckSquare, ChevronDown, FolderOpen, LayoutDashboard, Plus, Tag, X, AlertTriangle, Zap, Clock, TrendingUp, RefreshCw, Settings2, FileText } from 'lucide-react'
import { cn, getSLAStatus } from '../../lib/utils'
import { useApp } from '../../context/AppContext'
import { useT } from '../../i18n'
import Button from '../ui/Button'
import { Input } from '../ui/Input'
import type { Project } from '../../types'

const PROJECT_COLORS = ['#6366f1','#0ea5e9','#f59e0b','#22c55e','#ec4899','#ef4444','#8b5cf6','#14b8a6','#f97316','#06b6d4']

interface SidebarProps { onClose?: () => void; mobile?: boolean; onSync?: () => void; onManage?: (tab: 'projects' | 'labels') => void; onNotes?: (project: Project) => void }

export default function Sidebar({ onClose, mobile, onSync, onManage, onNotes }: SidebarProps) {
  const { state, dispatch } = useApp()
  const t = useT()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])

  const stats = useMemo(() => {
    const tasks = state.tasks
    return {
      total:    tasks.length,
      done:     tasks.filter(t => t.status === 'done').length,
      inProg:   tasks.filter(t => t.status === 'in_progress').length,
      breached: tasks.filter(t => getSLAStatus(t) === 'breached').length,
      critical: tasks.filter(t => getSLAStatus(t) === 'critical').length,
      atRisk:   tasks.filter(t => getSLAStatus(t) === 'at_risk').length,
    }
  }, [state.tasks])

  const handleAddProject = () => {
    if (!newName.trim()) return
    dispatch({ type: 'ADD_PROJECT', payload: { name: newName.trim(), color: newColor, description: '', notes: '' } })
    setNewName(''); setNewColor(PROJECT_COLORS[0]); setAddingProject(false)
  }

  return (
    <aside className={cn('flex flex-col bg-white border-r border-slate-200', mobile ? 'w-full h-full' : 'w-60 shrink-0 h-full')}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <CheckSquare size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">{t.app.name}</span>
        </div>
        {mobile && <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>}
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* All Tasks */}
        <button
          onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null }); onClose?.() }}
          className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            state.activeProjectId === null ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>
          <LayoutDashboard size={15} />
          <span className="flex-1 text-left">{t.sidebar.allTasks}</span>
          <span className="text-xs opacity-50">{stats.total}</span>
        </button>

        {/* Projects */}
        <div className="pt-3">
          <div className="flex items-center">
            <button className="flex-1 flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
              onClick={() => setProjectsOpen(v => !v)}>
              <FolderOpen size={12} />
              <span className="flex-1 text-left">{t.sidebar.projects}</span>
              <ChevronDown size={12} className={cn('transition-transform', !projectsOpen && '-rotate-90')} />
            </button>
            {onManage && (
              <button onClick={() => onManage('projects')}
                className="p-1 mr-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
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
                  onClick={() => { dispatch({ type: 'SET_ACTIVE_PROJECT', payload: p.id }); onClose?.() }}
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50">
                  <Plus size={12} /> {t.sidebar.newProject}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="pt-3">
          <div className="flex items-center">
            <div className="flex-1 flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Tag size={12} /><span>{t.sidebar.labels}</span>
            </div>
            {onManage && (
              <button onClick={() => onManage('labels')}
                className="p-1 mr-1 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
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
      </div>

      {/* Stats */}
      <div className="border-t border-slate-200 px-4 py-4 space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">{t.sidebar.overallProgress}</span>
            <span className="text-xs font-semibold text-slate-700">{stats.done}/{stats.total}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatChip icon={<AlertTriangle size={11} />} label={t.sidebar.breached} value={stats.breached}
            className={stats.breached > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'} />
          <StatChip icon={<Zap size={11} />} label={t.sidebar.critical} value={stats.critical}
            className={stats.critical > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-400 border-slate-200'} />
          <StatChip icon={<Clock size={11} />} label={t.sidebar.atRisk} value={stats.atRisk}
            className={stats.atRisk > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-500"><TrendingUp size={12} /> {t.sidebar.inProgress}</span>
          <span className="font-semibold text-slate-700">{stats.inProg}</span>
        </div>
        {onSync && (
          <button onClick={onSync} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors border border-slate-200">
            <RefreshCw size={12} /> {t.sidebar.syncBackup}
          </button>
        )}
      </div>
    </aside>
  )
}

function ProjectItem({ project, active, count, onClick, onNotes }: { project: Project; active: boolean; count: number; onClick: () => void; onNotes?: () => void }) {
  return (
    <div className={cn('group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
      active ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100')}>
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
