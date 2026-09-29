import { createClient } from '@/lib/supabase/server'
import { CompanyLeadsView } from '@/components/CompanyLeadsView'
import type { ExtendedLead, ExtendedTask } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const resolvedParams = await searchParams
  const companyName = resolvedParams?.name ? decodeURIComponent(resolvedParams.name).trim() : ''

  let companyLeads: ExtendedLead[] = []
  let companyTasks: ExtendedTask[] = []

  if (companyName) {
    try {
      const supabase = await createClient()

      // Fetch all leads for this company/business name (case-insensitive)
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .ilike('business_name', companyName)
        .order('created_at', { ascending: false })

      if (leadsData) {
        companyLeads = leadsData as ExtendedLead[]
      }

      const leadIds = companyLeads.map((l) => l.id)

      // Fetch open tasks for these leads
      if (leadIds.length > 0) {
        const { data: tasksData } = await supabase
          .from('tasks')
          .select(`
            *,
            leads (
              id,
              lead_code,
              business_name,
              channel,
              phone,
              email,
              instagram_handle,
              stage,
              follow_up_count,
              next_follow_up
            )
          `)
          .in('lead_id', leadIds)
          .eq('status', 'open')
          .order('due_date', { ascending: true })

        if (tasksData) {
          companyTasks = tasksData as ExtendedTask[]
        }
      }
    } catch (err) {
      console.error('Failed to load company leads & tasks:', err)
    }
  }

  return (
    <CompanyLeadsView
      companyName={companyName}
      initialLeads={companyLeads}
      initialTasks={companyTasks}
    />
  )
}
