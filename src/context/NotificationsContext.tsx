import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useApp } from './AppContext'
import { useAuth } from './AuthContext'
import { useT } from '../i18n'
import { useNotifications, type NotifAlert } from '../hooks/useNotifications'

interface NotificationsCtx {
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
  getUpcomingAlerts: () => NotifAlert[]
}

const Ctx = createContext<NotificationsCtx | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { state, dispatch, finalStatusIds } = useApp()
  const { user } = useAuth()
  const t = useT()

  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  useEffect(() => {
    if (!('Notification' in window)) return
    const id = setInterval(() => setPermission(Notification.permission), 3000)
    return () => clearInterval(id)
  }, [])

  const finalStatusId = state.statuses.find(s => s.isFinal)?.id ?? 'done'

  const onMarkDone = useCallback((taskId: string) => {
    dispatch({ type: 'MOVE_TASK', payload: { id: taskId, status: finalStatusId } })
  }, [dispatch, finalStatusId])

  const { requestPermission: rawRequest, getUpcomingAlerts } = useNotifications({
    tasks: state.tasks,
    t,
    enabled: permission === 'granted',
    notifBefore: state.notifBefore,
    onMarkDone,
    userId: user?.id,
    finalStatusIds,
  })

  const requestPermission = useCallback(async () => {
    const perm = await rawRequest()
    setPermission(perm)
    return perm
  }, [rawRequest])

  return (
    <Ctx.Provider value={{ permission, requestPermission, getUpcomingAlerts }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotificationsCtx() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotificationsCtx must be used within NotificationsProvider')
  return ctx
}
