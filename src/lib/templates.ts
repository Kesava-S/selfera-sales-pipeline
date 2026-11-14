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
  whatsapp_template_name?: string | null
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

export type TemplateCategory = {
  id?: string
  key: string
  label: string
  desc: string
  iconName?: string | null
}

export const DEFAULT_TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    key: 'General',
    label: 'General (all business types)',
    desc: 'Default baseline for all business types',
    iconName: 'Globe',
  },
  {
    key: 'Restaurant or cafe',
    label: 'Restaurants and cafes',
    desc: 'Restaurants, cafes, bakeries & dining spots',
    iconName: 'Utensils',
  },
  {
    key: 'Hotel',
    label: 'Hotels',
    desc: 'Hotels, B&Bs & boutique accommodation',
    iconName: 'Hotel',
  },
  {
    key: 'Pub',
    label: 'Pubs',
    desc: 'Pubs, bars & taverns',
    iconName: 'Beer',
  },
  {
    key: 'Property management',
    label: 'Property Management',
    desc: 'Short-let hosts & serviced properties',
    iconName: 'Building2',
  },
]

// "All platforms" templates cover messaging platforms
export const MESSAGING = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn']

export const platformLabel = (p: string) => (p === 'All' ? 'All platforms' : p)

export const businessTypeOf = (t: { business_types?: string[] }) =>
  t.business_types?.[0] || 'General'
