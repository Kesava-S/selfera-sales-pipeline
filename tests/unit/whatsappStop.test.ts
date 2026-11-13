import { describe, it, expect } from 'vitest'
import { isStopReply, replyAllowed } from '@/lib/emailBlock'

const stop = { id: 'x', source: 'inbound', created_at: '2026-11-10T10:00:00Z' }

describe('WhatsApp STOP on the do-not-contact list', () => {
  it('identifies all common stop / opt-out phrases', () => {
    expect(isStopReply('Stop')).toBe(true)
    expect(isStopReply('STOP')).toBe(true)
    expect(isStopReply('Stop messages')).toBe(true)
    expect(isStopReply('Stop message.')).toBe(true)
    expect(isStopReply('Stop promotions!')).toBe(true)
    expect(isStopReply('Opt out')).toBe(true)
    expect(isStopReply('opt-out')).toBe(true)
    expect(isStopReply('Unsubscribe')).toBe(true)
    expect(isStopReply('Please stop')).toBe(true)
    expect(isStopReply('Cancel')).toBe(true)
    expect(isStopReply('Hello, tell me more')).toBe(false)
    expect(isStopReply('Stopping by tomorrow')).toBe(false)
    expect(isStopReply(null)).toBe(false)
  })

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
