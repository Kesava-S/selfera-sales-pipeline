import { describe, it, expect } from 'vitest'
import { replyAllowed } from '@/lib/emailBlock'

const stop = { id: 'x', source: 'inbound', created_at: '2026-11-10T10:00:00Z' }

describe('WhatsApp STOP on the do-not-contact list', () => {
  it('blocks messages after a STOP reply', () => {
    expect(replyAllowed(stop, '2026-11-10T09:00:00Z', null)).toBe(false)
    expect(replyAllowed(stop, null, null)).toBe(false)
  })

  it('allows one answer when they write to us again', () => {
    expect(replyAllowed(stop, '2026-11-11T09:00:00Z', '2026-11-09T09:00:00Z')).toBe(true)
    expect(replyAllowed(stop, '2026-11-11T09:00:00Z', '2026-11-11T10:00:00Z')).toBe(false)
  })

  it('keeps bounces and spam reports closed', () => {
    expect(replyAllowed({ ...stop, source: 'bounce' }, '2026-11-11T09:00:00Z', null)).toBe(false)
    expect(replyAllowed({ ...stop, source: 'complaint' }, '2026-11-11T09:00:00Z', null)).toBe(false)
  })
})
