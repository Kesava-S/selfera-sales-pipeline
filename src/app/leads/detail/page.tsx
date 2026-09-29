import { createClient } from '@/lib/supabase/server'
import { LeadDetailView } from '@/components/LeadDetailView'
import type { ExtendedLead, ActivityLog } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const resolvedParams = await searchParams
  const leadId = resolvedParams?.id || ''

  let liveLead: ExtendedLead | null = null
  let liveActivities: ActivityLog[] = []

  if (leadId) {
    try {
      const supabase = await createClient()
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (leadData) {
        liveLead = leadData as ExtendedLead
        const { data: actData } = await supabase
          .from('activity_log')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })

        if (actData) {
          liveActivities = actData as ActivityLog[]
        }
      }
    } catch (err) {
      console.error('Failed to load lead details from database:', err)
    }
  }

  return (
    <LeadDetailView
      leadId={leadId}
      initialLead={liveLead}
      initialActivities={liveActivities}
    />
  )
}
