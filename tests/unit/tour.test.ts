import { describe, it, expect } from 'vitest'
import {
  MODULE_TOURS,
  getModuleToursForRole,
  getModuleTourForPath,
} from '@/components/tour/tourData'

describe('Separate Module Tours & Cursor Guide', () => {
  it('defines separate guided tours for modules and lead tabs', () => {
    expect(MODULE_TOURS).toHaveLength(12)
    const moduleIds = MODULE_TOURS.map(m => m.id)
    expect(moduleIds).toEqual([
      'dashboard',
      'leads',
      'leads-review',
      'leads-missing',
      'lookup',
      'audience',
      'campaigns',
      'whatsapp-campaigns',
      'insights',
      'templates',
      'integrations',
      'settings',
    ])
  })

  it('provides punchy, concise instructions for each action step', () => {
    for (const moduleTour of MODULE_TOURS) {
      expect(moduleTour.title.trim().length).toBeGreaterThan(0)
      expect(moduleTour.subtitle.trim().length).toBeGreaterThan(0)
      expect(moduleTour.steps.length).toBeGreaterThanOrEqual(1)

      for (const step of moduleTour.steps) {
        expect(step.title.trim().length).toBeGreaterThan(0)
        expect(step.instruction.trim().length).toBeGreaterThan(0)
        // Concise 1-liner rule: short instructions (<= 110 characters)
        expect(step.instruction.length).toBeLessThanOrEqual(110)
        expect(step.instruction).not.toContain('\n')
        expect(step.targetSelector).toMatch(/^\[data-tour="[a-z0-9-]+"]$/)
      }
    }
  })

  it('provides individual, non-navigated tours for each lead management tab', () => {
    // 1. All Leads Tab
    const allTour = getModuleTourForPath('/dashboard/leads')
    expect(allTour).not.toBeNull()
    expect(allTour?.title).toBe('Lead Management: All Leads')
    expect(allTour?.steps).toHaveLength(14)
    expect(allTour?.steps.map(s => s.id)).toEqual([
      'leads-import',
      'leads-export',
      'leads-add',
      'leads-tab-all',
      'leads-tab-review',
      'leads-tab-missing',
      'leads-categories',
      'leads-columns',
      'leads-table-checkbox',
      'bulk-assign',
      'bulk-services',
      'bulk-archive',
      'bulk-offtarget',
      'bulk-delete',
    ])

    // 2. Approval Queue Tab
    const reviewTour = getModuleTourForPath('/dashboard/leads', 'admin', 'tab=review')
    expect(reviewTour).not.toBeNull()
    expect(reviewTour?.title).toBe('Lead Management: Approval Queue')
    expect(reviewTour?.steps).toHaveLength(8)
    expect(reviewTour?.steps.map(s => s.id)).toEqual([
      'leads-import',
      'leads-add',
      'leads-tab-review',
      'leads-table',
      'leads-table-checkbox',
      'bulk-approve',
      'bulk-archive',
      'bulk-delete',
    ])

    // 3. Missing Data Tab
    const missingTour = getModuleTourForPath('/dashboard/leads', 'admin', 'tab=missing')
    expect(missingTour).not.toBeNull()
    expect(missingTour?.title).toBe('Lead Management: Missing Data')
    expect(missingTour?.steps).toHaveLength(5)
    expect(missingTour?.steps.map(s => s.id)).toEqual([
      'leads-tab-missing',
      'missing-categories',
      'missing-problems',
      'missing-batches',
      'missing-table',
    ])
  })

  it('filters out restricted module tours for consultants', () => {
    const adminTours = getModuleToursForRole('admin')
    expect(adminTours).toHaveLength(12)

    const consultantTours = getModuleToursForRole('consultant')
    const consultantRoutes = consultantTours.map(m => m.route)

    // Consultants cannot access audience, campaigns, or whatsapp-campaigns
    expect(consultantRoutes).not.toContain('/dashboard/audience')
    expect(consultantRoutes).not.toContain('/dashboard/campaigns')
    expect(consultantRoutes).not.toContain('/dashboard/whatsapp-campaigns')
    expect(consultantTours).toHaveLength(9)
  })

  it('contains zero literal em dashes across all tour content', () => {
    const rawJson = JSON.stringify(MODULE_TOURS)
    expect(rawJson).not.toContain('\u2014')
  })
})
