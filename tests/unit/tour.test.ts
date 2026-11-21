import { describe, it, expect } from 'vitest'
import {
  MODULE_TOURS,
  getModuleToursForRole,
  getModuleTourForPath,
} from '@/components/tour/tourData'

describe('Separate Module Tours & Cursor Guide', () => {
  it('defines separate guided tours for modules and lead tabs', () => {
    expect(MODULE_TOURS).toHaveLength(17)
    const moduleIds = MODULE_TOURS.map(m => m.id)
    expect(moduleIds).toEqual([
      'dashboard',
      'discovery',
      'discovery-history',
      'leads',
      'leads-review',
      'leads-missing',
      'lookup',
      'audience',
      'campaigns',
      'whatsapp-campaigns',
      'campaign-create',
      'insights',
      'templates',
      'integrations',
      'integration-channel',
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
    expect(adminTours).toHaveLength(17)

    const consultantTours = getModuleToursForRole('consultant')
    const consultantRoutes = consultantTours.map(m => m.route)

    // Consultants cannot access discovery, review queue, audience, campaigns, whatsapp-campaigns, or settings
    expect(consultantRoutes).not.toContain('/dashboard/discovery')
    expect(consultantRoutes).not.toContain('/dashboard/discovery/history')
    expect(consultantRoutes).not.toContain('/dashboard/leads?tab=review')
    expect(consultantRoutes).not.toContain('/dashboard/audience')
    expect(consultantRoutes).not.toContain('/dashboard/campaigns')
    expect(consultantRoutes).not.toContain('/dashboard/whatsapp-campaigns')
    expect(consultantRoutes).not.toContain('/dashboard/settings')
    expect(consultantTours).toHaveLength(9)
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
    expect(discoveryHistoryTour?.id).toBe('discovery-history')

    const notifTour = getModuleTourForPath('/dashboard/notifications')
    expect(notifTour).not.toBeNull()
    expect(notifTour?.id).toBe('notifications')
    expect(notifTour?.title).toBe('Notifications Hub')
    expect(notifTour?.steps).toHaveLength(3)
  })

  it('includes new campaign, replies, campaigns, and target databases in email and whatsapp tours', () => {
    // 1. Email Campaigns tour
    const emailTour = getModuleTourForPath('/dashboard/campaigns', 'sales')
    expect(emailTour).not.toBeNull()
    expect(emailTour?.id).toBe('campaigns')
    expect(emailTour?.steps).toHaveLength(5)
    expect(emailTour?.steps.map(s => s.id)).toEqual([
      'email-header',
      'email-tab-campaigns',
      'email-tab-databases',
      'email-new-btn',
      'email-replies-btn',
    ])
    expect(emailTour?.steps.map(s => s.targetSelector)).toEqual([
      '[data-tour="email-header"]',
      '[data-tour="email-tab-campaigns"]',
      '[data-tour="email-tab-databases"]',
      '[data-tour="email-new-btn"]',
      '[data-tour="email-replies-btn"]',
    ])

    // 2. WhatsApp Campaigns tour
    const waTour = getModuleTourForPath('/dashboard/whatsapp-campaigns', 'sales')
    expect(waTour).not.toBeNull()
    expect(waTour?.id).toBe('whatsapp-campaigns')
    expect(waTour?.steps).toHaveLength(5)
    expect(waTour?.steps.map(s => s.id)).toEqual([
      'wa-header',
      'wa-tab-campaigns',
      'wa-tab-databases',
      'wa-new-btn',
      'wa-replies-btn',
    ])
    expect(waTour?.steps.map(s => s.targetSelector)).toEqual([
      '[data-tour="wa-header"]',
      '[data-tour="wa-tab-campaigns"]',
      '[data-tour="wa-tab-databases"]',
      '[data-tour="wa-new-btn"]',
      '[data-tour="wa-replies-btn"]',
    ])
  })

  it('matches lead tabs even when other filters are present', () => {
    expect(getModuleTourForPath('/dashboard/leads', 'sales', 'type=general&tab=review')?.id).toBe('leads-review')
    expect(getModuleTourForPath('/dashboard/leads', 'admin', 'tab=missing&batch=1')?.id).toBe('leads-missing')
    expect(getModuleTourForPath('/dashboard/leads', 'admin', 'q=tab%3Dreview')?.id).toBe('leads')
  })

  it('does not offer overview tours on replies or detail pages', () => {
    for (const path of [
      '/dashboard/campaigns/replies',
      '/dashboard/whatsapp-campaigns/replies',
      '/dashboard/templates/General/Email',
      '/dashboard/audience',
    ]) {
      expect(getModuleTourForPath(path, 'admin')).toBeNull()
    }
  })

  it('offers Channel Integration tour on channel details page, including header toggle, env tabs, credentials, health check, and test console', () => {
    // 1. Integrations roster page has overview tour
    const listTour = getModuleTourForPath('/dashboard/integrations', 'admin')
    expect(listTour).not.toBeNull()
    expect(listTour?.id).toBe('integrations')
    expect(listTour?.steps).toHaveLength(1)

    // 2. Channel detail pages (WhatsApp, Email, etc.) have Channel Integration Details tour
    for (const channelPath of ['/dashboard/integrations/whatsapp', '/dashboard/integrations/email']) {
      const channelTour = getModuleTourForPath(channelPath, 'admin')
      expect(channelTour).not.toBeNull()
      expect(channelTour?.id).toBe('integration-channel')
      expect(channelTour?.title).toBe('Channel Integration Details')
      expect(channelTour?.steps).toHaveLength(6)
      expect(channelTour?.steps.map(s => s.id)).toEqual([
        'channel-header',
        'channel-env-tabs',
        'channel-realtime-creds',
        'channel-sandbox-creds',
        'channel-health',
        'channel-test-console',
      ])
      expect(channelTour?.steps.map(s => s.targetSelector)).toEqual([
        '[data-tour="channel-header"]',
        '[data-tour="channel-env-tabs"]',
        '[data-tour="channel-realtime-creds"]',
        '[data-tour="channel-sandbox-creds"]',
        '[data-tour="channel-health"]',
        '[data-tour="channel-test-console"]',
      ])
    }
  })

  it('offers Create Campaign tour in create section for both email and whatsapp campaigns', () => {
    // 1. Email Create Campaign tour
    const emailCreateTour = getModuleTourForPath('/dashboard/campaigns', 'sales', 'action=create')
    expect(emailCreateTour).not.toBeNull()
    expect(emailCreateTour?.id).toBe('campaign-create')
    expect(emailCreateTour?.title).toBe('Create Email Campaign')
    expect(emailCreateTour?.steps).toHaveLength(9)
    expect(emailCreateTour?.steps.map(s => s.id)).toEqual([
      'campaign-create-replies',
      'campaign-create-details',
      'campaign-create-database',
      'campaign-create-message',
      'campaign-create-template',
      'campaign-create-preview',
      'campaign-create-test-btn',
      'campaign-create-draft-btn',
      'campaign-create-launch-btn',
    ])
    expect(emailCreateTour?.steps.map(s => s.targetSelector)).toEqual([
      '[data-tour="campaign-create-replies"]',
      '[data-tour="campaign-create-details"]',
      '[data-tour="campaign-create-database"]',
      '[data-tour="campaign-create-message"]',
      '[data-tour="campaign-create-template"]',
      '[data-tour="campaign-create-preview"]',
      '[data-tour="campaign-create-test-btn"]',
      '[data-tour="campaign-create-draft-btn"]',
      '[data-tour="campaign-create-launch-btn"]',
    ])
    expect(emailCreateTour?.steps.find(s => s.id === 'campaign-create-message')?.title).toBe('Email Message')
    expect(emailCreateTour?.steps.find(s => s.id === 'campaign-create-preview')?.title).toBe('Email Preview')
    expect(emailCreateTour?.steps.find(s => s.id === 'campaign-create-test-btn')?.title).toBe('Send Test Email')

    // 2. WhatsApp Create Campaign tour
    const waCreateTour = getModuleTourForPath('/dashboard/whatsapp-campaigns', 'sales', 'action=create')
    expect(waCreateTour).not.toBeNull()
    expect(waCreateTour?.id).toBe('campaign-create')
    expect(waCreateTour?.title).toBe('Create WhatsApp Campaign')
    expect(waCreateTour?.steps).toHaveLength(9)
    expect(waCreateTour?.steps.map(s => s.id)).toEqual([
      'campaign-create-replies',
      'campaign-create-details',
      'campaign-create-database',
      'campaign-create-message',
      'campaign-create-template',
      'campaign-create-preview',
      'campaign-create-test-btn',
      'campaign-create-draft-btn',
      'campaign-create-launch-btn',
    ])
    expect(waCreateTour?.steps.find(s => s.id === 'campaign-create-message')?.title).toBe('WhatsApp Message')
    expect(waCreateTour?.steps.find(s => s.id === 'campaign-create-preview')?.title).toBe('WhatsApp Preview')
    expect(waCreateTour?.steps.find(s => s.id === 'campaign-create-test-btn')?.title).toBe('Send Test Message')

    // 3. Consultant cannot access create campaign tour
    expect(getModuleTourForPath('/dashboard/campaigns', 'consultant', 'action=create')).toBeNull()
    expect(getModuleTourForPath('/dashboard/whatsapp-campaigns', 'consultant', 'action=create')).toBeNull()

    // 4. Default overview tours still returned without action=create
    expect(getModuleTourForPath('/dashboard/campaigns', 'sales')?.id).toBe('campaigns')
    expect(getModuleTourForPath('/dashboard/whatsapp-campaigns', 'sales')?.id).toBe('whatsapp-campaigns')
  })

  it('offers Client Audience Details tour on client detail page, including import, add customer, and tabs', () => {
    // 1. Roster page has no tour
    expect(getModuleTourForPath('/dashboard/audience', 'sales')).toBeNull()
    expect(getModuleTourForPath('/dashboard/audience', 'admin')).toBeNull()

    // 2. Client details page has Client Audience Details tour
    const detailTour = getModuleTourForPath('/dashboard/audience/b64fa296-1234-4567-8901-abcdef123456', 'sales')
    expect(detailTour).not.toBeNull()
    expect(detailTour?.id).toBe('audience')
    expect(detailTour?.title).toBe('Client Audience Details')
    expect(detailTour?.steps).toHaveLength(3)
    expect(detailTour?.steps.map(s => s.id)).toEqual(['aud-import', 'aud-add', 'aud-tabs'])
    expect(detailTour?.steps.map(s => s.targetSelector)).toEqual([
      '[data-tour="aud-import"]',
      '[data-tour="aud-add"]',
      '[data-tour="aud-tabs"]',
    ])

    // 3. Consultant cannot access audience details tour
    expect(getModuleTourForPath('/dashboard/audience/b64fa296-1234-4567-8901-abcdef123456', 'consultant')).toBeNull()
  })

  it('describes the Person filter only for admins', () => {
    for (const role of ['admin', 'sales', 'consultant', 'sales_consultant']) {
      const filters = getModuleTourForPath('/dashboard/insights', role)?.steps.find(step => step.id === 'insights-filters')
      expect(filters?.instruction.includes('team member')).toBe(role === 'admin')
    }
  })

  it('contains zero literal em dashes across all tour content', () => {
    const rawJson = JSON.stringify(MODULE_TOURS)
    expect(rawJson).not.toContain('\u2014')
  })
})
