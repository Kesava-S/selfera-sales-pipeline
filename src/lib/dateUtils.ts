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
