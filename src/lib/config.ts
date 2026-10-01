// Fixed lists and settings used across the dashboard.
// The database checks the same values, so change both together.

export const CONFIG = {
  DEFAULT_SALES_CAPACITY: 150,

  // Follow-up timings (working days). The live values are in Settings (cadence_rules).
  CADENCE: {
    STEP_1_TO_2_DAYS: 3,
    STEP_2_TO_3_DAYS: 5,
    STEP_3_TO_FINAL_DAYS: 14,
    FINAL_TO_NO_REPLY_DAYS: 14,
  },

  SERVICES: ['Website', 'Micro Automation', 'End-to-End Automation', 'Custom Dashboard', 'Cold Outreach'] as const,

  PLATFORMS: ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in'] as const,

  BUSINESS_CATEGORIES: {
    'Food & Drink': ['Cafe', 'Restaurant', 'Bakery', 'Takeaway', 'Pub / Bar'],
    Accommodation: ['Hotel', 'Boutique hotel', 'B&B / Guesthouse', 'Short-let / Airbnb host', 'Serviced apartments', 'Hostel'],
    'Beauty & Wellness': ['Hair salon', 'Barber', 'Beauty', 'Nails & Lashes', 'Medical aesthetics', 'Spa', 'Fitness / Training studio'],
    'Retail & Other': ['Fashion boutique', 'Florist', 'Other'],
  } as Record<string, string[]>,

  STAGES: ['Needs review', 'Active', 'Interested', 'Consultation', 'Won', 'Went cold', 'No response', 'Declined', 'Do not contact'] as const,
  CONVERTED_THROUGH: ['Direct from outreach', 'Consultation', 'Demo', 'Follow-up conversation'] as const,
  TIERS: ['1-2 star', '3 star', '4-5 star'] as const,
  COMPANY_TYPES: ['Limited company', 'Sole trader', 'Partnership', 'Unknown'] as const,
}

export const BUSINESS_TYPES: string[] = Object.values(CONFIG.BUSINESS_CATEGORIES).flat()
export const OPEN_STAGES = ['Active', 'Interested', 'Consultation']
export const STEP_LABELS = ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check'] as const

export type Service = (typeof CONFIG.SERVICES)[number]
export type Platform = (typeof CONFIG.PLATFORMS)[number]
export type Stage = (typeof CONFIG.STAGES)[number]
export type Role = 'admin' | 'sales' | 'consultant'

// Colours (Tailwind classes) used everywhere so a stage or status always looks the same
export const STAGE_STYLE: Record<string, string> = {
  'Needs review': 'bg-amber-50 text-amber-700 border-amber-200',
  Active: 'bg-sky-50 text-sky-700 border-sky-200',
  Interested: 'bg-violet-50 text-violet-700 border-violet-200',
  Consultation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Went cold': 'bg-slate-100 text-slate-600 border-slate-200',
  'No response': 'bg-slate-100 text-slate-500 border-slate-200',
  Declined: 'bg-rose-50 text-rose-700 border-rose-200',
  'Do not contact': 'bg-red-50 text-red-700 border-red-200',
}

export const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  'Not contacted': { dot: 'bg-amber-400', text: 'text-amber-700', label: 'Not contacted' },
  'Awaiting reply': { dot: 'bg-sky-500', text: 'text-sky-700', label: 'Awaiting reply' },
  Replied: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Replied' },
  Paused: { dot: 'bg-slate-400', text: 'text-slate-600', label: 'Paused' },
  'No reply': { dot: 'bg-slate-300', text: 'text-slate-500', label: 'No reply' },
  'Opted out': { dot: 'bg-red-500', text: 'text-red-700', label: 'Opted out' },
}

// Status boxes on the home page and the status pages they open
export const STATUS_PAGES: Record<string, { label: string; filter: string; adminOnly?: boolean; countKey: string }> = {
  'needs-reply': { label: 'Needs reply', filter: 'needs-reply', countKey: 'needs_reply' },
  interested: { label: 'Interested', filter: 'Interested', countKey: 'interested' },
  consultation: { label: 'Consultation', filter: 'Consultation', countKey: 'consultation' },
  'went-cold': { label: 'Went cold', filter: 'Went cold', countKey: 'went_cold' },
  'no-response': { label: 'No response', filter: 'No response', countKey: 'no_response' },
  'needs-consultant': { label: 'Needs consultant', filter: 'needs-consultant', adminOnly: true, countKey: 'needs_consultant' },
  'unmatched-bookings': { label: 'Unmatched bookings', filter: 'unmatched', adminOnly: true, countKey: 'unmatched_bookings' },
}
