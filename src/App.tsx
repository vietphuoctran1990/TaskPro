import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { I18nProvider, useT } from './i18n'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import AIChatPanel from './components/ai/AIChatPanel'
// TaskBoard is the default view — eagerly loaded
import TaskBoard from './components/tasks/TaskBoard'
// Other views are lazy-loaded to reduce initial bundle size
const ListView        = lazy(() => import('./components/views/ListView'))
const CalendarView    = lazy(() => import('./components/views/CalendarView'))
const DashboardView   = lazy(() => import('./components/views/DashboardView'))
const TimelineView    = lazy(() => import('./components/views/TimelineView'))
const NotesView       = lazy(() => import('./components/notes/NotesView'))
// Heavy modals lazy-loaded on first open
const TaskForm        = lazy(() => import('./components/tasks/TaskForm'))
const TaskDetail      = lazy(() => import('./components/tasks/TaskDetail'))
const NoteEditorModal = lazy(() => import('./components/notes/NoteEditorModal'))
const ManageModal     = lazy(() => import('./components/settings/ManageModal'))
const SyncModal       = lazy(() => import('./components/sync/SyncModal'))
const PomodoroModal   = lazy(() => import('./components/focus/PomodoroModal'))
const CommandPalette  = lazy(() => import('./components/ui/CommandPalette'))
import OnboardingTour from './components/onboarding/OnboardingTour'
import AuthModal from './components/auth/AuthModal'
import ProjectNotesModal from './components/notes/ProjectNotesModal'
import ShortcutsModal from './components/ui/ShortcutsModal'
import InstallBanner from './components/pwa/InstallBanner'
import UpdateBanner from './components/pwa/UpdateBanner'
import OfflineToast from './components/pwa/OfflineToast'
import { ToastProvider } from './context/ToastContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { usePWA } from './hooks/usePWA'
import { usePullToRefresh } from './hooks/usePullToRefresh'
import { Plus, RefreshCw } from 'lucide-react'
import { cn } from './lib/utils'
import type { Status, Task, Project, Note } from './types'

function ViewSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  )
}

function AppShell() {
  const { state, dispatch } = useApp()
  const { syncNow } = useAuth()
  const t = useT()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null)
  const viewingTask = viewingTaskId ? (state.tasks.find(t => t.id === viewingTaskId) ?? null) : null
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

  // Scroll tracking for glassmorphism header (rAF-throttled)
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(el.scrollTop > 4)
          ticking = false
        })
        ticking = true
      }
    }
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
    setViewingTaskId(null)
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

  const handleViewTask = useCallback((task: Task) => setViewingTaskId(task.id), [])
  const handleCloseForm = useCallback(() => { setFormOpen(false); setEditingTask(null) }, [])
  const handleCloseDetail = useCallback(() => setViewingTaskId(null), [])

  return (
    <div className="flex h-[100dvh] bg-[#f1f5f9] dark:bg-[#080c15] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <Sidebar onSync={() => setSyncOpen(true)} onManage={handleManage} onNotes={setNotesProject} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />
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

        <main ref={mainRef} className="flex-1 overflow-auto p-4 lg:p-6 pb-20 lg:pb-6 overscroll-contain">
          <Suspense fallback={<ViewSpinner />}>
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
                  onViewNote={handleEditNote}
                />
              )}
              {state.viewMode === 'notes' && (
                <NotesView
                  onAddNote={handleAddNote}
                  onEditNote={handleEditNote}
                />
              )}
            </div>
          </Suspense>
        </main>
      </div>

      {/* Mobile FAB — above bottom nav, left of AI chat FAB */}
      <button
        onClick={() => state.viewMode === 'notes' ? handleAddNote() : handleAddTask()}
        className="fixed bottom-24 right-20 z-30 sm:hidden w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/40 active:scale-90 transition-transform flex items-center justify-center"
        aria-label={state.viewMode === 'notes' ? 'Tạo ghi chú' : 'Thêm công việc'}
      >
        <Plus size={20} />
      </button>

      {/* Modals — wrapped in Suspense so lazy chunks load on first open */}
      <Suspense fallback={null}>
        <NoteEditorModal
          open={noteEditorOpen}
          note={editingNote}
          onClose={() => { setNoteEditorOpen(false); setEditingNote(null) }}
          defaultFolderId={state.activeNoteFolderId ?? ''}
        />
      </Suspense>
      <ProjectNotesModal project={notesProject} onClose={() => setNotesProject(null)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <Suspense fallback={null}>
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
      </Suspense>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {showOnboarding && <OnboardingTour onFinish={handleFinishOnboarding} />}

      {/* AI floating chat */}
      <AIChatPanel />

      {/* Mobile bottom navigation */}
      <BottomNav />

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
            <NotificationsProvider>
              <AppShell />
            </NotificationsProvider>
          </ToastProvider>
        </I18nProvider>
      </AuthProvider>
    </AppProvider>
  )
}
