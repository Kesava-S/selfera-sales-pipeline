import { describe, expect, it } from 'vitest'
import { friendlyMetaError, metaErrorCode } from '@/lib/metaErrors'
import { formatDateTime } from '@/lib/format'

describe('friendlyMetaError', () => {
  it('explains known Meta errors in plain words and keeps the original', () => {
    const r = friendlyMetaError('(#131049) In order to maintain a healthy ecosystem engagement, the message failed to be delivered.')
    expect(r.text).toMatch(/limited marketing messages/)
    expect(r.raw).toMatch(/healthy ecosystem/)
    expect(metaErrorCode('(#132001) Template name does not exist')).toBe(132001)
  })
  it('falls back to Meta’s wording for unknown errors', () => {
    expect(friendlyMetaError('(#999) Something odd').text).toBe('(#999) Something odd')
    expect(friendlyMetaError(null).text).toBe('Not delivered.')
  })
})

describe('formatDateTime time zone', () => {
  it('shows the viewer’s time zone when given', () => {
    const t = '2026-11-12T07:39:17Z'
    expect(formatDateTime(t)).toBe('12 Nov 2026, 07:39')
    expect(formatDateTime(t, 'Asia/Kolkata')).toBe('12 Nov 2026, 13:09')
  })
})
