const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Deterministically formats a date string (YYYY-MM-DD or ISO) to "28 Sep 2026".
 * Avoids browser vs server timezone shifts and locale hydration mismatches.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'

  // If full ISO timestamp, extract date portion
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const parts = dateOnly.split('-')

  if (parts.length === 3) {
    const year = parts[0]
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const monthName = MONTH_NAMES[month] || parts[1]
    return `${day} ${monthName} ${year}`
  }

  return dateStr
}

/**
 * Formats a timestamp into a readable date and time string.
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'

  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = d.getDate()
    const month = MONTH_NAMES[d.getMonth()]
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month} ${year}, ${hours}:${mins}`
  } catch {
    return dateStr
  }
}

/**
 * Checks whether a date string is due today or overdue (YYYY-MM-DD <= today).
 */
export function isDueTodayOrOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  return dateOnly <= today
}

/**
 * Checks whether a date string is exactly today.
 */
export function isExactToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  return dateOnly === today
}

/**
 * Adds working days (Monday-Friday) to current date and returns YYYY-MM-DD.
 */
export function addWorkingDays(workingDays: number): string {
  const current = new Date()
  let added = 0
  while (added < workingDays) {
    current.setDate(current.getDate() + 1)
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      added++
    }
  }
  const year = current.getFullYear()
  const month = String(current.getMonth() + 1).padStart(2, '0')
  const day = String(current.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Adds calendar days to current date and returns YYYY-MM-DD.
 */
export function addCalendarDays(calendarDays: number): string {
  const current = new Date()
  current.setDate(current.getDate() + calendarDays)
  const year = current.getFullYear()
  const month = String(current.getMonth() + 1).padStart(2, '0')
  const day = String(current.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
