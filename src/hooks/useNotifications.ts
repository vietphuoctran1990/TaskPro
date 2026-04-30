import { useEffect, useRef, useCallback } from 'react'
import type { Task } from '../types'
import type { Translations } from '../i18n/types'
import { getDeadline, getSLAStatus } from '../lib/utils'

export type NotifAlert = {
  task: Task
  label: string
  minutesLeft: number
}

interface Options {
  tasks: Task[]
  t: Translations
  enabled: boolean
}

interface Threshold {
  key: string
  label: (t: Translations) => string
  minMin: number   // window start (minutes before deadline)
  maxMin: number   // window end
}

const THRESHOLDS: Threshold[] = [
  { key: '60m',  label: t => t.notifications.dueIn60,  minMin: 55,   maxMin: 65 },
  { key: '30m',  label: t => t.notifications.dueIn30,  minMin: 25,   maxMin: 35 },
  { key: '15m',  label: t => t.notifications.dueIn15,  minMin: 10,   maxMin: 20 },
  { key: 'due',  label: t => t.notifications.overdue,  minMin: -30,  maxMin: 5  },
]

export function useNotifications({ tasks, t, enabled }: Options) {
  const notifiedRef = useRef(new Set<string>())

  const checkAndNotify = useCallback(() => {
    if (!enabled || Notification.permission !== 'granted') return

    const pending = tasks.filter(task => task.status !== 'done')
    pending.forEach(task => {
      const deadline = getDeadline(task)
      if (!deadline) return
      const minsLeft = (deadline.getTime() - Date.now()) / 60_000

      THRESHOLDS.forEach(({ key, label, minMin, maxMin }) => {
        if (minsLeft >= minMin && minsLeft <= maxMin) {
          const notifKey = `${task.id}-${key}`
          if (!notifiedRef.current.has(notifKey)) {
            notifiedRef.current.add(notifKey)
            try {
              const n = new Notification(label(t), {
                body: task.title,
                icon: '/icon-192x192.png',
                badge: '/icon-72x72.png',
                tag: notifKey,
                requireInteraction: key === 'due',
              })
              n.onclick = () => { window.focus(); n.close() }
            } catch {}
          }
        }
      })
    })
  }, [tasks, t, enabled])

  // Run every 60 seconds
  useEffect(() => {
    checkAndNotify()
    const id = setInterval(checkAndNotify, 60_000)
    return () => clearInterval(id)
  }, [checkAndNotify])

  // Return upcoming alerts for the dropdown (next 2h)
  const getUpcomingAlerts = useCallback((): NotifAlert[] => {
    return tasks
      .filter(t => t.status !== 'done')
      .flatMap(task => {
        const deadline = getDeadline(task)
        if (!deadline) return []
        const minsLeft = (deadline.getTime() - Date.now()) / 60_000
        if (minsLeft > 120 && minsLeft >= 0) return []

        let label = ''
        if (minsLeft < 0) label = t.notifications.overdue
        else if (minsLeft <= 15) label = t.notifications.dueIn15
        else if (minsLeft <= 30) label = t.notifications.dueIn30
        else label = t.notifications.dueIn60

        return [{ task, label, minutesLeft: minsLeft }]
      })
      .sort((a, b) => a.minutesLeft - b.minutesLeft)
  }, [tasks, t])

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) return 'denied'
    return await Notification.requestPermission()
  }, [])

  return {
    permission: 'Notification' in window ? Notification.permission : 'denied' as NotificationPermission,
    requestPermission,
    getUpcomingAlerts,
    getSLAStatus,
  }
}
