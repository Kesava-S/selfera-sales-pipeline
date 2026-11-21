import {
  LayoutDashboard,
  Users,
  ScanSearch,
  Contact,
  Mail,
  MessageSquare,
  BarChart2,
  FileText,
  Plug,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Bell,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface TourStep {
  id: string
  title: string
  instruction: string
  targetSelector: string
  requiresSelector?: string
  roles?: string[]
}

export interface ModuleTour {
  id: string
  route: string
  title: string
  subtitle: string
  icon: LucideIcon
  roles?: string[]
  steps: TourStep[]
}

const SALES_SIDE = ['admin', 'sales', 'sales_consultant']

export const MODULE_TOURS: ModuleTour[] = [
  // 1. Dashboard
  {
    id: 'dashboard',
    route: '/dashboard',
    title: 'Dashboard',
    subtitle: 'Daily pipeline snapshot and due actions',
    icon: LayoutDashboard,
    steps: [
      {
        id: 'dash-pipeline',
        title: 'Pipeline Status Cards',
        instruction: 'Click any status box to filter leads and view stage conversion health.',
        targetSelector: '[data-tour="dash-pipeline"]',
      },
      {
        id: 'dash-due',
        title: "Today's Task Queue",
        instruction: 'Work through messages, follow-ups, and new outreach due today.',
        targetSelector: '[data-tour="dash-due"]',
      },
    ],
  },

  // 2. Lead Discovery (Sales roles only)
  {
    id: 'discovery',
    route: '/dashboard/discovery',
    title: 'Lead Discovery',
    subtitle: 'SME sourcing via Google Maps and Companies House',
    icon: Compass,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'disc-search',
        title: 'Search Criteria',
        instruction: 'Search prospects by keyword, location, UK postcode, sector category, or URL.',
        targetSelector: '[data-tour="disc-search"]',
      },
      {
        id: 'disc-sme-toggle',
        title: 'Growing SME Filter',
        instruction: 'Filter for active growing SMEs with 10-250 reviews or under 10 years old.',
        targetSelector: '[data-tour="disc-sme-toggle"]',
      },
      {
        id: 'disc-filters',
        title: 'Growth & Quality Filters',
        instruction: 'Refine results by review counts, star ratings, company age, and contacts.',
        targetSelector: '[data-tour="disc-filters"]',
      },
      {
        id: 'disc-results',
        title: 'Discovered Prospects',
        instruction: 'Review enriched leads with phone, website, Google ratings, and company info.',
        targetSelector: '[data-tour="disc-results"]',
      },
      {
        id: 'disc-history',
        title: 'Search History',
        instruction: 'Access previously discovered prospect batches without spending extra credits.',
        targetSelector: '[data-tour="disc-history"]',
      },
    ],
  },

  {
    id: 'discovery-history',
    route: '/dashboard/discovery/history',
    title: 'Discovery Search History',
    subtitle: 'Find and reopen previous discovery searches',
    icon: Compass,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'discovery-history-overview',
        title: 'Saved Searches',
        instruction: 'Review previous searches here and reopen their results without using more credits.',
        targetSelector: '[data-tour="discovery-history-overview"]',
      },
    ],
  },

  // 3. Lead Management: All Leads Tab
  {
    id: 'leads',
    route: '/dashboard/leads',
    title: 'Lead Management: All Leads',
    subtitle: 'Pipeline tabs, category cards, columns, and bulk tools',
    icon: Users,
    steps: [
      {
        id: 'leads-import',
        title: 'Import CSV',
        instruction: 'Bulk upload CSV lead lists with automatic phone formatting and deduplication.',
        targetSelector: '[data-tour="leads-import"]',
        roles: SALES_SIDE,
      },
      {
        id: 'leads-export',
        title: 'Export CSV',
        instruction: 'Export filtered deals or selected businesses directly into a spreadsheet.',
        targetSelector: '[data-tour="leads-export"]',
        roles: ['admin'],
      },
      {
        id: 'leads-add',
        title: 'Add Business',
        instruction: 'Manually register a single business with contact channels and pitch details.',
        targetSelector: '[data-tour="leads-add"]',
        roles: SALES_SIDE,
      },
      {
        id: 'leads-tab-all',
        title: 'All Leads Tab',
        instruction: 'Browse active deals across all stages, outreach platforms, and sales reps.',
        targetSelector: '[data-tour="leads-tab-all"]',
      },
      {
        id: 'leads-tab-review',
        title: 'Approval Queue Tab',
        instruction: 'Review fresh leads and verify contact details before outreach cadences start.',
        targetSelector: '[data-tour="leads-tab-review"]',
      },
      {
        id: 'leads-tab-missing',
        title: 'Missing Data Tab',
        instruction: 'Filter leads missing phone numbers, postcodes, or websites to enrich them.',
        targetSelector: '[data-tour="leads-tab-missing"]',
      },
      {
        id: 'leads-categories',
        title: 'Category Overview',
        instruction: 'Click any category card to filter deals and monitor industry sector volumes.',
        targetSelector: '[data-tour="leads-categories"]',
      },
      {
        id: 'leads-columns',
        title: 'Columns Visibility',
        instruction: 'Toggle table columns to reveal WhatsApp, email, assigned reps, and dates.',
        targetSelector: '[data-tour="leads-columns"]',
        requiresSelector: '[data-tour="leads-columns"]',
      },
      {
        id: 'leads-table-checkbox',
        title: 'Table Row Selection',
        instruction: 'Tick lead checkboxes in the table to open bulk action controls.',
        targetSelector: '[data-tour="leads-table-checkbox"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-assign',
        title: 'Assign Team Member',
        instruction: 'Reallocate selected leads to a specific sales rep or consultant in bulk.',
        targetSelector: '[data-tour="bulk-assign"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-services',
        title: 'Change Services',
        instruction: 'Update pitched service packages across multiple selected businesses at once.',
        targetSelector: '[data-tour="bulk-services"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-archive',
        title: 'Archive Option',
        instruction: 'Archive inactive leads to keep your active pipeline clean without losing data.',
        targetSelector: '[data-tour="bulk-archive"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-offtarget',
        title: 'Off Target Option',
        instruction: 'Flag out-of-scope accounts to prevent outreach and track unserviceable sectors.',
        targetSelector: '[data-tour="bulk-offtarget"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-delete',
        title: 'Delete Option',
        instruction: 'Permanently remove unwanted leads and their conversation history everywhere.',
        targetSelector: '[data-tour="bulk-delete"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
    ],
  },

  // 4. Lead Management: Approval Queue Tab
  {
    id: 'leads-review',
    route: '/dashboard/leads?tab=review',
    title: 'Lead Management: Approval Queue',
    subtitle: 'Inbound intake review and approval workflow',
    icon: CheckCircle2,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'leads-import',
        title: 'Import CSV',
        instruction: 'Upload lead lists that populate this queue for review before pitching.',
        targetSelector: '[data-tour="leads-import"]',
      },
      {
        id: 'leads-add',
        title: 'Add Business',
        instruction: 'Add a new business directly into the approval queue for verification.',
        targetSelector: '[data-tour="leads-add"]',
      },
      {
        id: 'leads-tab-review',
        title: 'Approval Queue Tab',
        instruction: 'New leads wait here until verified to ensure outreach contact accuracy.',
        targetSelector: '[data-tour="leads-tab-review"]',
      },
      {
        id: 'leads-table',
        title: 'Review Table',
        instruction: 'Inspect business names, pitched services, and verification readiness.',
        targetSelector: '[data-tour="leads-table"]',
        requiresSelector: '[data-tour="leads-table"]',
      },
      {
        id: 'leads-table-checkbox',
        title: 'Select Leads',
        instruction: 'Select verified leads to approve them in bulk for active outreach.',
        targetSelector: '[data-tour="leads-table-checkbox"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
      },
      {
        id: 'bulk-approve',
        title: 'Approve Selected',
        instruction: 'Approve verified leads to create scheduled drafts in Today Queue.',
        targetSelector: '[data-tour="bulk-approve"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
      },
      {
        id: 'bulk-archive',
        title: 'Archive Option',
        instruction: 'Archive rejected leads without deleting their information permanently.',
        targetSelector: '[data-tour="bulk-archive"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-delete',
        title: 'Delete Option',
        instruction: 'Permanently remove invalid or duplicate leads from the intake queue.',
        targetSelector: '[data-tour="bulk-delete"]',
        requiresSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
    ],
  },

  // 2c. Lead Management: Missing Data Tab
  {
    id: 'leads-missing',
    route: '/dashboard/leads?tab=missing',
    title: 'Lead Management: Missing Data',
    subtitle: 'Enrich incomplete leads and manage import batches',
    icon: AlertTriangle,
    steps: [
      {
        id: 'leads-tab-missing',
        title: 'Missing Data Tab',
        instruction: 'Isolates imported leads that lack critical outreach contact info.',
        targetSelector: '[data-tour="leads-tab-missing"]',
      },
      {
        id: 'missing-categories',
        title: 'Sector Categories',
        instruction: 'Filter incomplete leads by business sector to focus enrichment efforts.',
        targetSelector: '[data-tour="missing-categories"]',
      },
      {
        id: 'missing-problems',
        title: 'Problem Filters',
        instruction: 'Filter by missing phone, postcode, or website to enrich specific fields.',
        targetSelector: '[data-tour="missing-problems"]',
      },
      {
        id: 'missing-batches',
        title: 'Import Batches',
        instruction: 'Select specific CSV import uploads to review newly added missing rows.',
        targetSelector: '[data-tour="missing-batches"]',
      },
      {
        id: 'missing-table',
        title: 'Inline Data Editor',
        instruction: 'Click any cell directly in the table to add missing contacts and save.',
        targetSelector: '[data-tour="missing-table"]',
        requiresSelector: '[data-tour="missing-table"]',
      },
    ],
  },

  // 3. Lead Lookup
  {
    id: 'lookup',
    route: '/dashboard/lookup',
    title: 'Lead Lookup',
    subtitle: 'Google Places and Companies House search',
    icon: ScanSearch,
    steps: [
      {
        id: 'lookup-leads',
        title: 'Select a Lead',
        instruction: 'Choose a lead from your pipeline that needs verified contact info.',
        targetSelector: '[data-tour="lookup-leads"]',
      },
      {
        id: 'lookup-search',
        title: 'Registry Search',
        instruction: 'Search verified UK businesses on Google Places and Companies House.',
        targetSelector: '[data-tour="lookup-search"]',
      },
    ],
  },

  // 4. Client Audience Details (Sales roles only)
  {
    id: 'audience',
    route: '/dashboard/audience',
    title: 'Client Audience Details',
    subtitle: 'Customer contacts, imports, and segmentation',
    icon: Contact,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'aud-import',
        title: 'Import CSV',
        instruction: 'Bulk upload CSV customer lists with phone formatting and consent checks.',
        targetSelector: '[data-tour="aud-import"]',
      },
      {
        id: 'aud-add',
        title: 'Add Customer',
        instruction: 'Register an individual customer contact with phone, email, and tags.',
        targetSelector: '[data-tour="aud-add"]',
      },
      {
        id: 'aud-tabs',
        title: 'Status Tabs',
        instruction: 'Filter customer contacts by All, Ready for campaigns, Missing data, or Do Not Contact.',
        targetSelector: '[data-tour="aud-tabs"]',
      },
    ],
  },

  // 5. Email Campaigns (Sales roles only)
  {
    id: 'campaigns',
    route: '/dashboard/campaigns',
    title: 'Email Campaigns',
    subtitle: 'Automated batch email outreach',
    icon: Mail,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'email-header',
        title: 'Campaign Overview',
        instruction: 'Review active email sequences and monitor real-time delivery metrics.',
        targetSelector: '[data-tour="email-header"]',
      },
      {
        id: 'email-tab-campaigns',
        title: 'Campaigns',
        instruction: 'View all created, queued, and sent email campaigns and their performance.',
        targetSelector: '[data-tour="email-tab-campaigns"]',
      },
      {
        id: 'email-tab-databases',
        title: 'Target Databases',
        instruction: 'Organize custom lead contact lists and segmented audiences for focused outreach.',
        targetSelector: '[data-tour="email-tab-databases"]',
      },
      {
        id: 'email-new-btn',
        title: 'New Campaign',
        instruction: 'Create and launch a personalized batch email broadcast to your chosen database.',
        targetSelector: '[data-tour="email-new-btn"]',
      },
      {
        id: 'email-replies-btn',
        title: 'Replies',
        instruction: 'Track incoming prospect responses and jump directly into customer conversation threads.',
        targetSelector: '[data-tour="email-replies-btn"]',
      },
    ],
  },

  // 6. WhatsApp Campaigns (Sales roles only)
  {
    id: 'whatsapp-campaigns',
    route: '/dashboard/whatsapp-campaigns',
    title: 'WhatsApp Campaigns',
    subtitle: 'Meta Cloud API broadcast messaging',
    icon: MessageSquare,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'wa-header',
        title: 'Cloud API Status',
        instruction: 'Monitor verified Meta Cloud API broadcasts and delivery ticks.',
        targetSelector: '[data-tour="wa-header"]',
      },
      {
        id: 'wa-tab-campaigns',
        title: 'Campaigns',
        instruction: 'Track active, scheduled, and sent WhatsApp broadcast campaigns.',
        targetSelector: '[data-tour="wa-tab-campaigns"]',
      },
      {
        id: 'wa-tab-databases',
        title: 'Target Databases',
        instruction: 'Build and manage phone contact lists for targeted WhatsApp outreach.',
        targetSelector: '[data-tour="wa-tab-databases"]',
      },
      {
        id: 'wa-new-btn',
        title: 'New Campaign',
        instruction: 'Launch approved WhatsApp templates and personalized messages to target lists.',
        targetSelector: '[data-tour="wa-new-btn"]',
      },
      {
        id: 'wa-replies-btn',
        title: 'Replies',
        instruction: 'Monitor incoming WhatsApp replies with quick actions to qualify or follow up.',
        targetSelector: '[data-tour="wa-replies-btn"]',
      },
    ],
  },

  // 6b. Create Campaign (Common for Email & WhatsApp)
  {
    id: 'campaign-create',
    route: '/dashboard/campaigns?action=create',
    title: 'Create Campaign',
    subtitle: 'Compose, target, preview, and launch outreach',
    icon: Sparkles,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'campaign-create-replies',
        title: 'Campaign Replies',
        instruction: 'Access campaign replies and lead responses across email and WhatsApp channels.',
        targetSelector: '[data-tour="campaign-create-replies"]',
      },
      {
        id: 'campaign-create-details',
        title: 'Campaign Details',
        instruction: 'Set a clear internal campaign name and choose the core service focus to pitch.',
        targetSelector: '[data-tour="campaign-create-details"]',
      },
      {
        id: 'campaign-create-database',
        title: 'Select Target Database',
        instruction: 'Pick a curated business contact database or create a new segmented audience list.',
        targetSelector: '[data-tour="campaign-create-database"]',
      },
      {
        id: 'campaign-create-message',
        title: 'Campaign Message',
        instruction: 'Compose outreach copy and click variable pills to inject personalized fields.',
        targetSelector: '[data-tour="campaign-create-message"]',
      },
      {
        id: 'campaign-create-template',
        title: 'Load Template',
        instruction: 'Load pre-written messaging scripts and templates to speed up campaign creation.',
        targetSelector: '[data-tour="campaign-create-template"]',
      },
      {
        id: 'campaign-create-preview',
        title: 'Live Preview',
        instruction: 'Inspect real-time message previews with personalized placeholders filled in.',
        targetSelector: '[data-tour="campaign-create-preview"]',
      },
      {
        id: 'campaign-create-test-btn',
        title: 'Send Test Message',
        instruction: 'Deliver a single test message to verify formatting and deliverability.',
        targetSelector: '[data-tour="campaign-create-test-btn"]',
      },
      {
        id: 'campaign-create-draft-btn',
        title: 'Save Draft',
        instruction: 'Save your progress safely as a draft to resume editing or reviewing later.',
        targetSelector: '[data-tour="campaign-create-draft-btn"]',
      },
      {
        id: 'campaign-create-launch-btn',
        title: 'Review & Launch',
        instruction: 'Open the pre-flight launch modal to confirm audience size, cadence, and schedule.',
        targetSelector: '[data-tour="campaign-create-launch-btn"]',
      },
    ],
  },

  // 7. Insights
  {
    id: 'insights',
    route: '/dashboard/insights',
    title: 'Insights',
    subtitle: 'Outreach analytics and conversion rates',
    icon: BarChart2,
    steps: [
      {
        id: 'insights-metrics',
        title: 'Key Performance Numbers',
        instruction: 'Track total reached leads, reply percentages, and won deals.',
        targetSelector: '[data-tour="insights-metrics"]',
        requiresSelector: '[data-tour="insights-metrics"]',
      },
      {
        id: 'insights-filters',
        title: 'Filter by Date & Service',
        instruction: 'Narrow analytics by date range or service.',
        targetSelector: '[data-tour="insights-filters"]',
      },
      {
        id: 'insights-funnel',
        title: 'Stage Conversion Funnel',
        instruction: 'Spot where deals convert and identify pipeline drop-offs.',
        targetSelector: '[data-tour="insights-funnel"]',
        requiresSelector: '[data-tour="insights-funnel"]',
      },
    ],
  },

  // 8. Templates
  {
    id: 'templates',
    route: '/dashboard/templates',
    title: 'Templates',
    subtitle: 'Multi-channel scripts and Meta templates',
    icon: FileText,
    steps: [
      {
        id: 'tmpl-categories',
        title: 'Business Categories',
        instruction: 'Select a business category to review or customize its scripts.',
        targetSelector: '[data-tour="tmpl-categories"]',
      },
      {
        id: 'tmpl-channels',
        title: 'Channel Mediums',
        instruction: 'Choose Email, WhatsApp, or Social to configure outreach cadence.',
        targetSelector: '[data-tour="tmpl-channels"]',
        requiresSelector: '[data-tour="tmpl-channels"]',
      },
    ],
  },

  // 9. Integrations
  {
    id: 'integrations',
    route: '/dashboard/integrations',
    title: 'Integrations',
    subtitle: 'Connected channels and health tests',
    icon: Plug,
    steps: [
      {
        id: 'integ-list',
        title: 'Communication Channels',
        instruction: 'Connect WhatsApp Cloud API, SMTP mailboxes, and run health tests.',
        targetSelector: '[data-tour="integ-list"]',
      },
    ],
  },

  // 10. Channel Integration Details
  {
    id: 'integration-channel',
    route: '/dashboard/integrations/whatsapp',
    title: 'Channel Integration Details',
    subtitle: 'Credentials, health checks, and test console',
    icon: Plug,
    steps: [
      {
        id: 'channel-header',
        title: 'Header & Status Toggle',
        instruction: 'Review integration status and toggle the channel connection on or off.',
        targetSelector: '[data-tour="channel-header"]',
      },
      {
        id: 'channel-env-tabs',
        title: 'Environment Switch',
        instruction: 'Switch between Realtime (live production) and Sandbox (test environment) modes.',
        targetSelector: '[data-tour="channel-env-tabs"]',
      },
      {
        id: 'channel-realtime-creds',
        title: 'Realtime Credentials',
        instruction: 'Configure production API keys, webhook URLs, and secure credentials used for live outreach.',
        targetSelector: '[data-tour="channel-realtime-creds"]',
      },
      {
        id: 'channel-sandbox-creds',
        title: 'Sandbox Credentials',
        instruction: 'Enter sandbox or test API keys to experiment with automated sequences without contacting live recipients.',
        targetSelector: '[data-tour="channel-sandbox-creds"]',
      },
      {
        id: 'channel-health',
        title: 'Connection Health Check',
        instruction: 'Run an instant ping check to verify credentials, API handshake, and response latency.',
        targetSelector: '[data-tour="channel-health"]',
      },
      {
        id: 'channel-test-console',
        title: 'Interactive Test Console',
        instruction: 'Send test messages or template payloads to a verified test recipient to confirm end-to-end delivery.',
        targetSelector: '[data-tour="channel-test-console"]',
      },
    ],
  },

  // 11. Settings (Admin only)
  {
    id: 'settings',
    route: '/dashboard/settings',
    title: 'Settings',
    subtitle: 'Team access, cadence, and opt-outs',
    icon: Sliders,
    roles: ['admin'],
    steps: [
      {
        id: 'settings-team',
        title: 'Team Management',
        instruction: 'Invite team members, assign pipeline roles, and manage permissions.',
        targetSelector: '[data-tour="settings-team"]',
      },
      {
        id: 'settings-cadence',
        title: 'Follow-Up Delays',
        instruction: 'Set working days to wait between consecutive automated follow-up steps.',
        targetSelector: '[data-tour="settings-cadence"]',
      },
    ],
  },

  // 12. Notifications Hub
  {
    id: 'notifications',
    route: '/dashboard/notifications',
    title: 'Notifications Hub',
    subtitle: 'Real-time alerts, replies, and assignment reminders',
    icon: Bell,
    steps: [
      {
        id: 'notif-tabs',
        title: 'Read & Unread Filters',
        instruction: 'Filter notifications by read status to clear your task backlog.',
        targetSelector: '[data-tour="notif-tabs"]',
      },
      {
        id: 'notif-filter',
        title: 'Type & Search Filtering',
        instruction: 'Filter alerts by category or search by specific business name.',
        targetSelector: '[data-tour="notif-filter"]',
      },
      {
        id: 'notif-list',
        title: 'Notification Activity',
        instruction: 'Click any notification to navigate directly to its deal or thread.',
        targetSelector: '[data-tour="notif-list"]',
      },
    ],
  },
]

export function getModuleToursForRole(role?: string): ModuleTour[] {
  return MODULE_TOURS
    .filter(m => !role || !m.roles || m.roles.includes(role))
    .map(m => {
      const steps = m.steps
        .filter(step => !role || !step.roles || step.roles.includes(role))
        .map(step => role === 'admin' && step.id === 'insights-filters'
          ? { ...step, title: 'Filter by Date, Service & Rep', instruction: 'Narrow analytics by date range, service, or team member.' }
          : step)
      return { ...m, steps }
    })
    .filter(m => m.steps.length > 0)
}

export function getModuleTourForPath(
  pathname: string,
  role?: string,
  search?: string
): ModuleTour | null {
  const tours = getModuleToursForRole(role)
  const path = pathname.replace(/\/$/, '')

  if (path === '/dashboard/leads') {
    const tab = new URLSearchParams(search).get('tab')
    const id = tab === 'review' || tab === 'missing' ? `leads-${tab}` : 'leads'
    return tours.find(tour => tour.id === id) ?? null
  }

  // Create Campaign: when creating a new campaign in Email or WhatsApp
  if (path === '/dashboard/campaigns' || path === '/dashboard/whatsapp-campaigns') {
    const action = new URLSearchParams(search).get('action')
    if (action === 'create') {
      const isWa = path === '/dashboard/whatsapp-campaigns'
      const tour = tours.find(t => t.id === 'campaign-create')
      if (!tour) return null
      const steps = tour.steps.map(step => {
        if (step.id === 'campaign-create-message') {
          return { ...step, title: isWa ? 'WhatsApp Message' : 'Email Message' }
        }
        if (step.id === 'campaign-create-preview') {
          return { ...step, title: isWa ? 'WhatsApp Preview' : 'Email Preview' }
        }
        if (step.id === 'campaign-create-test-btn') {
          return { ...step, title: isWa ? 'Send Test Message' : 'Send Test Email' }
        }
        return step
      })
      return {
        ...tour,
        title: isWa ? 'Create WhatsApp Campaign' : 'Create Email Campaign',
        steps,
      }
    }
  }

  // Client Audience: tour is for client details page (/dashboard/audience/:id), NOT the roster page (/dashboard/audience)
  if (path.startsWith('/dashboard/audience/')) {
    return tours.find(tour => tour.id === 'audience') ?? null
  }
  if (path === '/dashboard/audience') {
    return null
  }

  // Channel Integration: tour is for channel details page (/dashboard/integrations/:id)
  if (path.startsWith('/dashboard/integrations/') && path !== '/dashboard/integrations') {
    return tours.find(tour => tour.id === 'integration-channel') ?? null
  }

  return tours.find(tour => tour.route === path) ?? null
}
