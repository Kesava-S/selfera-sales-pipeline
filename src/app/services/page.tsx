import { createClient } from '@/lib/supabase/server'
import type { ExtendedLead, ServiceItem } from '@/types/database'
import { ServicesView } from '@/components/ServicesView'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  let liveLeads: ExtendedLead[] = []
  let liveServices: ServiceItem[] = []

  try {
    const supabase = await createClient()
    const [leadsRes, servicesRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('services').select('*').order('created_at', { ascending: true }),
    ])

    if (!leadsRes.error && leadsRes.data) {
      liveLeads = leadsRes.data as ExtendedLead[]
    }
    if (!servicesRes.error && servicesRes.data) {
      liveServices = servicesRes.data as ServiceItem[]
    }
  } catch (err) {
    console.error('Failed to load services data:', err)
  }

  return <ServicesView initialLeads={liveLeads} initialServices={liveServices} />
}
