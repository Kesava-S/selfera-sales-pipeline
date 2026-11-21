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
  type LucideIcon,
} from 'lucide-react'

export interface TourStep {
  id: string
  title: string
  instruction: string
  targetSelector: string
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
      },
      {
        id: 'leads-table-checkbox',
        title: 'Table Row Selection',
        instruction: 'Tick lead checkboxes in the table to open bulk action controls.',
        targetSelector: '[data-tour="leads-table-checkbox"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-assign',
        title: 'Assign Team Member',
        instruction: 'Reallocate selected leads to a specific sales rep or consultant in bulk.',
        targetSelector: '[data-tour="bulk-assign"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-services',
        title: 'Change Services',
        instruction: 'Update pitched service packages across multiple selected businesses at once.',
        targetSelector: '[data-tour="bulk-services"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-archive',
        title: 'Archive Option',
        instruction: 'Archive inactive leads to keep your active pipeline clean without losing data.',
        targetSelector: '[data-tour="bulk-archive"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-offtarget',
        title: 'Off Target Option',
        instruction: 'Flag out-of-scope accounts to prevent outreach and track unserviceable sectors.',
        targetSelector: '[data-tour="bulk-offtarget"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-delete',
        title: 'Delete Option',
        instruction: 'Permanently remove unwanted leads and their conversation history everywhere.',
        targetSelector: '[data-tour="bulk-delete"]',
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
      },
      {
        id: 'leads-table-checkbox',
        title: 'Select Leads',
        instruction: 'Select verified leads to approve them in bulk for active outreach.',
        targetSelector: '[data-tour="leads-table-checkbox"]',
      },
      {
        id: 'bulk-approve',
        title: 'Approve Selected',
        instruction: 'Approve verified leads to create scheduled drafts in Today Queue.',
        targetSelector: '[data-tour="bulk-approve"]',
      },
      {
        id: 'bulk-archive',
        title: 'Archive Option',
        instruction: 'Archive rejected leads without deleting their information permanently.',
        targetSelector: '[data-tour="bulk-archive"]',
        roles: ['admin'],
      },
      {
        id: 'bulk-delete',
        title: 'Delete Option',
        instruction: 'Permanently remove invalid or duplicate leads from the intake queue.',
        targetSelector: '[data-tour="bulk-delete"]',
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

  // 4. Client Audience (Sales roles only)
  {
    id: 'audience',
    route: '/dashboard/audience',
    title: 'Client Audience',
    subtitle: 'Customer marketing for client accounts',
    icon: Contact,
    roles: SALES_SIDE,
    steps: [
      {
        id: 'aud-roster',
        title: 'Client Business Accounts',
        instruction: 'Select a Won client to manage customer contacts and run bulk uploads.',
        targetSelector: '[data-tour="aud-roster"]',
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
        id: 'email-actions',
        title: 'Create & Manage Broadcasts',
        instruction: 'Launch new email sequences with smart variables and reply detection.',
        targetSelector: '[data-tour="email-actions"]',
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
        id: 'wa-actions',
        title: 'Launch WhatsApp Broadcasts',
        instruction: 'Dispatch approved Meta templates and manage custom target lists.',
        targetSelector: '[data-tour="wa-actions"]',
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
      },
      {
        id: 'insights-filters',
        title: 'Filter by Time & Rep',
        instruction: 'Narrow analytics down by custom date range, service, or team member.',
        targetSelector: '[data-tour="insights-filters"]',
      },
      {
        id: 'insights-funnel',
        title: 'Stage Conversion Funnel',
        instruction: 'Spot where deals convert and identify pipeline drop-offs.',
        targetSelector: '[data-tour="insights-funnel"]',
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
      if (!role) return m
      const filteredSteps = m.steps.filter(s => !s.roles || s.roles.includes(role))
      return { ...m, steps: filteredSteps }
    })
    .filter(m => m.steps.length > 0)
}

export function getModuleTourForPath(
  pathname: string,
  role?: string,
  search?: string
): ModuleTour | null {
  const tours = getModuleToursForRole(role)

  // Dedicated lead management tab tours
  if (pathname === '/dashboard/leads') {
    if (search && search.includes('tab=review')) {
      const reviewTour = tours.find(m => m.id === 'leads-review')
      return reviewTour || null
    }
    if (search && search.includes('tab=missing')) {
      const missingTour = tours.find(m => m.id === 'leads-missing')
      return missingTour || null
    }
    const allTour = tours.find(m => m.id === 'leads')
    return allTour || null
  }

  // Exact route match first
  const exact = tours.find(m => m.route === pathname)
  if (exact) return exact

  // Subpath prefix match (except dashboard home)
  const prefix = tours.find(m => m.route !== '/dashboard' && pathname.startsWith(m.route + '/'))
  if (prefix) return prefix

  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return tours.find(m => m.route === '/dashboard') || null
  }

  return null
}
