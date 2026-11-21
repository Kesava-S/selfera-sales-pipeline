import { describe, it, expect } from 'vitest'
import {
  MODULE_TOURS,
  getModuleToursForRole,
  getModuleTourForPath,
} from '@/components/tour/tourData'

describe('Separate Module Tours & Cursor Guide', () => {
  it('defines separate guided tours for modules and lead tabs', () => {
    expect(MODULE_TOURS).toHaveLength(14)
    const moduleIds = MODULE_TOURS.map(m => m.id)
    expect(moduleIds).toEqual([
      'dashboard',
      'discovery',
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
      'notifications',
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
    expect(adminTours).toHaveLength(14)

    const consultantTours = getModuleToursForRole('consultant')
    const consultantRoutes = consultantTours.map(m => m.route)

    // Consultants cannot access discovery, review queue, audience, campaigns, whatsapp-campaigns, or settings
    expect(consultantRoutes).not.toContain('/dashboard/discovery')
    expect(consultantRoutes).not.toContain('/dashboard/leads?tab=review')
    expect(consultantRoutes).not.toContain('/dashboard/audience')
    expect(consultantRoutes).not.toContain('/dashboard/campaigns')
    expect(consultantRoutes).not.toContain('/dashboard/whatsapp-campaigns')
    expect(consultantRoutes).not.toContain('/dashboard/settings')
    expect(consultantTours).toHaveLength(8)
  })

  it('restricts Settings tour strictly to administrators', () => {
    const adminSettings = getModuleTourForPath('/dashboard/settings', 'admin')
    expect(adminSettings).not.toBeNull()
    expect(adminSettings?.id).toBe('settings')
    expect(adminSettings?.steps).toHaveLength(2)

    // Non-admin roles do not have access to team management and cadence settings, preventing tour collapse
    expect(getModuleTourForPath('/dashboard/settings', 'sales')).toBeNull()
    expect(getModuleTourForPath('/dashboard/settings', 'consultant')).toBeNull()
    expect(getModuleTourForPath('/dashboard/settings', 'sales_consultant')).toBeNull()
  })

  it('tailors Lead Management steps depending on user role', () => {
    // Admin sees all 14 steps including export, row checkboxes, and bulk controls
    const adminLeadTour = getModuleTourForPath('/dashboard/leads', 'admin')
    expect(adminLeadTour?.steps).toHaveLength(14)

    // Sales reps see intake and filters, but not admin-only export or bulk delete/archive
    const salesLeadTour = getModuleTourForPath('/dashboard/leads', 'sales')
    expect(salesLeadTour?.steps).toHaveLength(7)
    expect(salesLeadTour?.steps.map(s => s.id)).toEqual([
      'leads-import',
      'leads-add',
      'leads-tab-all',
      'leads-tab-review',
      'leads-tab-missing',
      'leads-categories',
      'leads-columns',
    ])

    // Consultants only see view/filter controls, not intake buttons or bulk operations
    const consultantLeadTour = getModuleTourForPath('/dashboard/leads', 'consultant')
    expect(consultantLeadTour?.steps).toHaveLength(5)
    expect(consultantLeadTour?.steps.map(s => s.id)).toEqual([
      'leads-tab-all',
      'leads-tab-review',
      'leads-tab-missing',
      'leads-categories',
      'leads-columns',
    ])

    // In Approval Queue, sales sees 6 steps (excluding admin-only archive & delete)
    const salesReviewTour = getModuleTourForPath('/dashboard/leads', 'sales', 'tab=review')
    expect(salesReviewTour?.steps).toHaveLength(6)
    expect(salesReviewTour?.steps.map(s => s.id)).toEqual([
      'leads-import',
      'leads-add',
      'leads-tab-review',
      'leads-table',
      'leads-table-checkbox',
      'bulk-approve',
    ])
  })

  it('matches separate tours for Lead Discovery and Notifications', () => {
    const discoveryTour = getModuleTourForPath('/dashboard/discovery')
    expect(discoveryTour).not.toBeNull()
    expect(discoveryTour?.id).toBe('discovery')
    expect(discoveryTour?.title).toBe('Lead Discovery')
    expect(discoveryTour?.steps).toHaveLength(5)

    const discoveryHistoryTour = getModuleTourForPath('/dashboard/discovery/history')
    expect(discoveryHistoryTour).not.toBeNull()
    expect(discoveryHistoryTour?.id).toBe('discovery')

    const notifTour = getModuleTourForPath('/dashboard/notifications')
    expect(notifTour).not.toBeNull()
    expect(notifTour?.id).toBe('notifications')
    expect(notifTour?.title).toBe('Notifications Hub')
    expect(notifTour?.steps).toHaveLength(3)
  })

  it('contains zero literal em dashes across all tour content', () => {
    const rawJson = JSON.stringify(MODULE_TOURS)
    expect(rawJson).not.toContain('\u2014')
  })
})
