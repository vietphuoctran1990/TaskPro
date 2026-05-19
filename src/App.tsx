import { useState, useCallback, useEffect, useRef } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { I18nProvider, useT } from './i18n'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import TaskBoard from './components/tasks/TaskBoard'
import ListView from './components/views/ListView'
import CalendarView from './components/views/CalendarView'
import DashboardView from './components/views/DashboardView'
import TimelineView from './components/views/TimelineView'
import OnboardingTour from './components/onboarding/OnboardingTour'
import TaskForm from './components/tasks/TaskForm'
import TaskDetail from './components/tasks/TaskDetail'
import SyncModal from './components/sync/SyncModal'
import ManageModal from './components/settings/ManageModal'
import AuthModal from './components/auth/AuthModal'
import ProjectNotesModal from './components/notes/ProjectNotesModal'
import NotesView from './components/notes/NotesView'
import NoteEditorModal from './components/notes/NoteEditorModal'
import PomodoroModal from './components/focus/PomodoroModal'
import InstallBanner from './components/pwa/InstallBanner'
import UpdateBanner from './components/pwa/UpdateBanner'
import OfflineToast from './components/pwa/OfflineToast'
import CommandPalette from './components/ui/CommandPalette'
import ShortcutsModal from './components/ui/ShortcutsModal'
import { ToastProvider } from './context/ToastContext'
import { usePWA } from './hooks/usePWA'
import { usePullToRefresh } from './hooks/usePullToRefresh'
import { Plus, RefreshCw } from 'lucide-react'
import { cn } from './lib/utils'
import type { Status, Task, Project, Note } from './types'

function AppShell() {
  const { state, dispatch } = useApp()
  const { syncNow } = useAuth()
  const t = useT()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')
  const [defaultDate, setDefaultDate] = useState('')
  const [installDismissed, setInstallDismissed] = useState(false)
  const [syncOpen, setSyncOpen]   = useState(false)
  const [authOpen, setAuthOpen]   = useState(false)
  const [manageTab, setManageTab] = useState<'projects' | 'labels' | 'statuses'>('projects')
  const [manageOpen, setManageOpen] = useState(false)
  const [focusTask,   setFocusTask]   = useState<Task | null>(null)
  const [notesProject, setNotesProject] = useState<Project | null>(null)
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('taskpro-onboarded'))
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // ⌘K → command palette · ? → shortcuts cheat sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(v => !v)
        return
      }
      // ? only when no input/textarea/select is focused
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault()
          setShortcutsOpen(v => !v)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Scroll tracking for glassmorphism header
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 4)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Pull-to-refresh (mobile) → syncNow
  const ptr = usePullToRefresh(mainRef, { onRefresh: () => syncNow() })

  const handleFinishOnboarding = () => {
    localStorage.setItem('taskpro-onboarded', '1')
    setShowOnboarding(false)
  }

  const handleManage = useCallback((tab: 'projects' | 'labels' | 'statuses') => {
    setManageTab(tab)
    setManageOpen(true)
    setSidebarOpen(false)
  }, [])

  const handleFocusTask = useCallback((task: Task) => {
    setViewingTask(null)
    setFocusTask(task)
  }, [])

  const { canInstall, isOnline, needRefresh, install, updateServiceWorker } = usePWA()

  const handleAddTask = useCallback((status: Status = 'todo', date = '') => {
    setDefaultStatus(status)
    setDefaultDate(date)
    setEditingTask(null)
    setFormOpen(true)
  }, [])

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }, [])

  const handleAddNote = useCallback(() => {
    setEditingNote(null)
    setNoteEditorOpen(true)
  }, [])

  const handleEditNote = useCallback((note: Note) => {
    setEditingNote(note)
    setNoteEditorOpen(true)
  }, [])

  const handleViewTask = useCallback((task: Task) => setViewingTask(task), [])
  const handleCloseForm = useCallback(() => { setFormOpen(false); setEditingTask(null) }, [])
  const handleCloseDetail = useCallback(() => setViewingTask(null), [])

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <Sidebar onSync={() => setSyncOpen(true)} onManage={handleManage} onNotes={setNotesProject} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <Sidebar mobile onClose={() => setSidebarOpen(false)}
              onSync={() => { setSidebarOpen(false); setSyncOpen(true) }}
              onManage={handleManage}
              onNotes={p => { setSidebarOpen(false); setNotesProject(p) }} />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          onAddTask={() => handleAddTask()}
          onAddNote={handleAddNote}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenAuth={() => setAuthOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          scrolled={scrolled}
        />

        {/* Pull-to-refresh indicator (mobile only) */}
        {(ptr.pulling || ptr.refreshing) && (
          <div
            className="ptr-indicator sm:hidden"
            style={{
              transform: `translateY(${Math.max(0, ptr.distance - 28)}px)`,
              opacity: Math.min(1, ptr.distance / 60),
              height: '56px',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <RefreshCw size={12} className={cn(ptr.refreshing && 'animate-spin', !ptr.refreshing && ptr.willRefresh && 'rotate-180', 'transition-transform')} />
              <span>
                {ptr.refreshing ? t.refresh.refreshing : ptr.willRefresh ? t.refresh.release : t.refresh.pulling}
              </span>
            </div>
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-auto p-4 lg:p-6">
          <div key={state.viewMode} className="view-fade-in">
            {state.viewMode === 'kanban' && (
              <TaskBoard
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onViewTask={handleViewTask}
                onFocusTask={handleFocusTask}
              />
            )}
            {state.viewMode === 'list' && (
              <ListView
                onEditTask={handleEditTask}
                onViewTask={handleViewTask}
                onAddTask={() => handleAddTask()}
                onFocusTask={handleFocusTask}
              />
            )}
            {state.viewMode === 'calendar' && (
              <CalendarView
                onViewTask={handleViewTask}
                onAddTask={(date) => handleAddTask('todo', date)}
              />
            )}
            {state.viewMode === 'timeline' && (
              <TimelineView
                onViewTask={handleViewTask}
                onAddTask={() => handleAddTask()}
              />
            )}
            {state.viewMode === 'dashboard' && (
              <DashboardView
                onViewTask={handleViewTask}
                onAddTask={() => handleAddTask()}
              />
            )}
            {state.viewMode === 'notes' && (
              <NotesView
                onAddNote={handleAddNote}
                onEditNote={handleEditNote}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => state.viewMode === 'notes' ? handleAddNote() : handleAddTask()}
        className="fixed bottom-6 right-6 z-30 sm:hidden w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"
        aria-label={state.viewMode === 'notes' ? 'Tạo ghi chú' : 'Thêm công việc'}
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      <NoteEditorModal
        open={noteEditorOpen}
        note={editingNote}
        onClose={() => { setNoteEditorOpen(false); setEditingNote(null) }}
        defaultFolderId={state.activeNoteFolderId ?? ''}
      />
      <ProjectNotesModal project={notesProject} onClose={() => setNotesProject(null)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <ManageModal open={manageOpen} onClose={() => setManageOpen(false)} initialTab={manageTab} />
      <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <TaskForm
        open={formOpen}
        onClose={handleCloseForm}
        task={editingTask}
        defaultStatus={defaultStatus}
        defaultDate={defaultDate}
      />
      <TaskDetail
        task={viewingTask}
        onClose={handleCloseDetail}
        onEdit={task => { handleCloseDetail(); handleEditTask(task) }}
        onFocus={handleFocusTask}
      />
      {focusTask && (
        <PomodoroModal
          task={focusTask}
          onClose={() => setFocusTask(null)}
          onDone={() => {
            dispatch({ type: 'MOVE_TASK', payload: { id: focusTask.id, status: 'done' } })
            setFocusTask(null)
          }}
        />
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNewTask={() => handleAddTask()}
        onNewNote={handleAddNote}
        onViewTask={handleViewTask}
        onEditNote={handleEditNote}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {showOnboarding && <OnboardingTour onFinish={handleFinishOnboarding} />}

      {/* PWA UI */}
      {needRefresh && <UpdateBanner onUpdate={() => updateServiceWorker()} />}
      {canInstall && !installDismissed && (
        <InstallBanner onInstall={install} onDismiss={() => setInstallDismissed(true)} />
      )}
      <OfflineToast isOnline={isOnline} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <I18nProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </I18nProvider>
      </AuthProvider>
    </AppProvider>
  )
}
