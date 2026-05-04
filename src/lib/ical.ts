import type { Task, Project } from '../types'

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
}

function dateStamp(date: string, time: string | null): { dtStart: string; dtEnd: string } {
  const d = date.replace(/-/g, '')
  if (time) {
    const t = time.replace(':', '') + '00'
    // Use local time with no Z (floating)
    return { dtStart: `${d}T${t}`, dtEnd: `${d}T${t}` }
  }
  // All-day: next day as DTEND
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  const nd = next.toISOString().slice(0, 10).replace(/-/g, '')
  return { dtStart: d, dtEnd: nd }
}

const PRIORITY_MAP: Record<string, number> = { urgent: 1, high: 3, medium: 5, low: 9 }

export function generateICS(tasks: Task[], projects: Project[]): string {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskPro//TaskPro//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TaskPro',
    'X-WR-TIMEZONE:UTC',
  ]

  for (const task of tasks) {
    if (!task.dueDate) continue
    const { dtStart, dtEnd } = dateStamp(task.dueDate, task.dueTime)
    const allDay = !task.dueTime
    const project = projectMap[task.projectId]
    const desc = [task.description, project ? `Project: ${project.name}` : ''].filter(Boolean).join('\\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@taskpro`,
      `DTSTAMP:${nowStamp()}`,
      allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
      allDay ? `DTEND;VALUE=DATE:${dtEnd}`   : `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(task.title)}`,
      ...(desc ? [`DESCRIPTION:${escapeICS(desc)}`] : []),
      `PRIORITY:${PRIORITY_MAP[task.priority] ?? 5}`,
      `STATUS:${task.status === 'done' ? 'COMPLETED' : 'NEEDS-ACTION'}`,
      ...(project ? [`CATEGORIES:${escapeICS(project.name)}`] : []),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(tasks: Task[], projects: Project[]): void {
  const content = generateICS(tasks, projects)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `taskpro-${new Date().toISOString().slice(0, 10)}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export function googleCalendarUrl(task: Task): string {
  if (!task.dueDate) return ''
  const d = task.dueDate.replace(/-/g, '')
  const t = task.dueTime ? task.dueTime.replace(':', '') + '00' : null
  const start = t ? `${d}T${t}` : d
  // End = +1h for timed, +1 day for all-day
  let end: string
  if (t) {
    const dt = new Date(`${task.dueDate}T${task.dueTime}:00`)
    dt.setHours(dt.getHours() + 1)
    end = dt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, '')
  } else {
    const dt = new Date(task.dueDate)
    dt.setDate(dt.getDate() + 1)
    end = dt.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    task.title,
    dates:   `${start}/${end}`,
    details: task.description ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
