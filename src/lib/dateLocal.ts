/** Local-timezone-safe date utilities — never use toISOString().slice(0,10) for business dates */

export function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocalISO(): string {
  return localISO(new Date())
}

export function tomorrowLocalISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localISO(d)
}

/** Parse a YYYY-MM-DD string as local midnight, not UTC */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, day] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, day)
}
