// UK date and time formatting, always in London time
const TZ = 'Europe/London'

export function formatDate(value?: string | Date | null): string {
  if (!value) return ''
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00Z') : new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })}`
}

export function todayLondon(): string {
  // YYYY-MM-DD for "today" in London
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function dueLabel(dateStr?: string | null): { text: string; tone: 'overdue' | 'today' | 'later' | 'none' } {
  if (!dateStr) return { text: 'Nothing due', tone: 'none' }
  const today = todayLondon()
  if (dateStr < today) return { text: `Overdue (${formatDate(dateStr)})`, tone: 'overdue' }
  if (dateStr === today) return { text: 'Due today', tone: 'today' }
  return { text: formatDate(dateStr), tone: 'later' }
}

export function stepLabel(step: number, status?: string): string {
  if (status === 'Not contacted' || step === 0) return 'First contact'
  if (step >= 4) return 'Final check sent'
  return ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check'][step] ?? `Step ${step}`
}

export function nextStepLabel(step: number): string {
  return ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check'][Math.min(step, 3)]
}
