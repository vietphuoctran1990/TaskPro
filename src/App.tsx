import { useState, useCallback } from 'react'
import { AppProvider } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import TaskBoard from './components/tasks/TaskBoard'
import TaskForm from './components/tasks/TaskForm'
import TaskDetail from './components/tasks/TaskDetail'
import InstallBanner from './components/pwa/InstallBanner'
import UpdateBanner from './components/pwa/UpdateBanner'
import OfflineToast from './components/pwa/OfflineToast'
import { usePWA } from './hooks/usePWA'
import type { Status, Task } from './types'

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')
  const [installDismissed, setInstallDismissed] = useState(false)

  const { canInstall, isOnline, needRefresh, install, updateServiceWorker } = usePWA()

  const handleAddTask = useCallback((status: Status = 'todo') => {
    setDefaultStatus(status)
    setEditingTask(null)
    setFormOpen(true)
  }, [])

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }, [])

  const handleViewTask = useCallback((task: Task) => {
    setViewingTask(task)
  }, [])

  const handleCloseForm = useCallback(() => {
    setFormOpen(false)
    setEditingTask(null)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setViewingTask(null)
  }, [])

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onAddTask={() => handleAddTask('todo')}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <TaskBoard
            onAddTask={handleAddTask}
            onEditTask={handleEditTask}
            onViewTask={handleViewTask}
          />
        </main>
      </div>

      {/* Modals */}
      <TaskForm
        open={formOpen}
        onClose={handleCloseForm}
        task={editingTask}
        defaultStatus={defaultStatus}
      />
      <TaskDetail
        task={viewingTask}
        onClose={handleCloseDetail}
        onEdit={task => {
          handleCloseDetail()
          handleEditTask(task)
        }}
      />

      {/* PWA UI */}
      {needRefresh && (
        <UpdateBanner onUpdate={() => updateServiceWorker(true)} />
      )}

      {canInstall && !installDismissed && (
        <InstallBanner
          onInstall={install}
          onDismiss={() => setInstallDismissed(true)}
        />
      )}

      <OfflineToast isOnline={isOnline} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
