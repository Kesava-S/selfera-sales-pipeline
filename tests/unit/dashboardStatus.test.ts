import { describe, it, expect } from 'vitest'
import { STATUS_PAGES, toTypeSlug, fromTypeSlug, DRILLDOWN_TYPES, DRILLDOWN_PLATFORMS } from '@/lib/config'

describe('Pipeline Status in Dashboard', () => {
  it('defines all required pipeline status pages', () => {
    const keys = Object.keys(STATUS_PAGES)
    expect(keys).toContain('needs-reply')
    expect(keys).toContain('interested')
    expect(keys).toContain('consultation')
    expect(keys).toContain('went-cold')
    expect(keys).toContain('no-response')
    expect(keys).toContain('needs-consultant')
    expect(keys).toContain('off-target-leads')
    expect(keys).not.toContain('unmatched-bookings')
  })

  it('correctly maps countKey to each status definition', () => {
    expect(STATUS_PAGES['needs-reply'].countKey).toBe('needs_reply')
    expect(STATUS_PAGES['interested'].countKey).toBe('interested')
    expect(STATUS_PAGES['consultation'].countKey).toBe('consultation')
    expect(STATUS_PAGES['went-cold'].countKey).toBe('went_cold')
    expect(STATUS_PAGES['no-response'].countKey).toBe('no_response')
    expect(STATUS_PAGES['needs-consultant'].countKey).toBe('needs_consultant')
    expect(STATUS_PAGES['off-target-leads'].countKey).toBe('off_target')
  })

  it('restricts administrative queues to admins', () => {
    expect(STATUS_PAGES['needs-consultant'].adminOnly).toBe(true)
    expect(STATUS_PAGES['off-target-leads'].adminOnly).toBeFalsy()
    expect(STATUS_PAGES['interested'].adminOnly).toBeFalsy()
    expect(STATUS_PAGES['needs-reply'].adminOnly).toBeFalsy()
  })

  it('maps category slugs bidirectionally for status drilldowns', () => {
    for (const item of DRILLDOWN_TYPES) {
      const slug = toTypeSlug(item.key)
      expect(slug).toBe(item.slug)
      const restored = fromTypeSlug(slug)
      expect(restored).toBe(item.key)
    }
  })

  it('includes standard outreach platforms for reply drilldowns', () => {
    expect(DRILLDOWN_PLATFORMS).toEqual(['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn'])
  })
})

