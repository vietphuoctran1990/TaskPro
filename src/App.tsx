import { useState, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './i18n'
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
import { ToastProvider } from './context/ToastContext'
import { usePWA } from './hooks/usePWA'
import { Plus } from 'lucide-react'
import type { Status, Task, Project, Note } from './types'

function AppShell() {
  const { state, dispatch } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')
  const [defaultDate, setDefaultDate] = useState('')
  const [installDismissed, setInstallDismissed] = useState(false)
  const [syncOpen, setSyncOpen]   = useState(false)
  const [authOpen, setAuthOpen]   = useState(false)
  const [manageTab, setManageTab] = useState<'projects' | 'labels'>('projects')
  const [manageOpen, setManageOpen] = useState(false)
  const [focusTask,   setFocusTask]   = useState<Task | null>(null)
  const [notesProject, setNotesProject] = useState<Project | null>(null)
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('taskpro-onboarded'))

  const handleFinishOnboarding = () => {
    localStorage.setItem('taskpro-onboarded', '1')
    setShowOnboarding(false)
  }

  const handleManage = useCallback((tab: 'projects' | 'labels') => {
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onAddTask={() => handleAddTask()}
          onAddNote={handleAddNote}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenAuth={() => setAuthOpen(true)}
        />

        <main className="flex-1 overflow-auto p-4 lg:p-6">
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
        </main>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => handleAddTask()}
        className="fixed bottom-6 right-6 z-30 sm:hidden w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center"
        aria-label="Add task"
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
