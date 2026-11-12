import { describe, it, expect } from 'vitest'
import { INVITE_ROLES, ROLE_LABEL, actsAsConsultant, actsAsSales } from '@/lib/config'

describe('Team roles', () => {
  it('lets admins invite sales, consultant and sales + consultant, but not admins', () => {
    expect([...INVITE_ROLES]).toEqual(['sales', 'consultant', 'sales_consultant'])
    expect(INVITE_ROLES).not.toContain('admin')
  })

  it('treats Sales + Consultant as both roles', () => {
    expect(actsAsSales('sales_consultant')).toBe(true)
    expect(actsAsConsultant('sales_consultant')).toBe(true)
    expect(ROLE_LABEL.sales_consultant).toBe('Sales + Consultant')
  })

  it('keeps sales and consultant separate', () => {
    expect(actsAsSales('sales')).toBe(true)
    expect(actsAsConsultant('sales')).toBe(false)
    expect(actsAsSales('consultant')).toBe(false)
    expect(actsAsConsultant('consultant')).toBe(true)
    expect(actsAsSales('admin')).toBe(false)
    expect(actsAsSales(null)).toBe(false)
  })
})
