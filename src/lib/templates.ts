// Shared template constants (used by server pages and client components)
import { CONFIG } from '@/lib/config'

export type TemplateRow = {
  id: string; name: string; platform: string; step: string; services: string[]
  subject: string | null; body: string; is_active: boolean
}

export const STEPS = ['First contact', 'Follow-up 1', 'Follow-up 2', 'Final check', 'Reply', 'Upsell']
export const PLATFORMS = ['All', 'WhatsApp', 'Instagram', 'Facebook', 'Email', 'Phone', 'Walk-in']
export const SERVICES: string[] = ['General', ...CONFIG.SERVICES]
// "All platforms" templates cover messaging only, not Phone or Walk-in
export const MESSAGING = ['WhatsApp', 'Instagram', 'Facebook', 'Email']

export const platformLabel = (p: string) => (p === 'All' ? 'All platforms' : p)
export const serviceOf = (t: { services: string[] }) => t.services?.[0] || 'General'
