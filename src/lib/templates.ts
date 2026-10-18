// Shared template constants (used by server pages and client components)
export type TemplateRow = {
  id: string
  name: string
  platform: string
  step: string
  services: string[]
  business_types: string[]
  subject: string | null
  body: string
  is_active: boolean
}

export const STEPS = [
  'First contact',
  'Follow-up 1',
  'Follow-up 2',
  'Final check',
  'Reply',
  'Upsell',
] as const

export const PLATFORMS = [
  'All',
  'WhatsApp',
  'Instagram',
  'Facebook',
  'Email',
  'LinkedIn',
] as const

export const TEMPLATE_BUSINESS_TYPES = [
  'General',
  'Restaurants and cafes',
  'Hotels',
  'Pubs',
  'Property Management',
] as const

// "All platforms" templates cover messaging platforms
export const MESSAGING = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn']

export const platformLabel = (p: string) => (p === 'All' ? 'All platforms' : p)

export const businessTypeOf = (t: { business_types?: string[] }) =>
  t.business_types?.[0] || 'General'
