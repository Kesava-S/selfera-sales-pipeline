import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { Lead, PipelineAnalyticsRow } from '@/types/database'
import { ReportsView } from '@/components/ReportsView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pipeline Analytics | Selfera Sales Pipeline',
  description: 'Commercial sales pipeline analytics, conversion funnels, win rates, and channel performance metrics.',
}

export default async function ReportsPage() {
  let liveAnalytics: PipelineAnalyticsRow[] = []
  let liveLeads: Lead[] = []

  try {
    const supabase = await createClient()
    const [analyticsRes, leadsRes] = await Promise.all([
      supabase.from('pipeline_analytics').select('*'),
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
    ])

    if (!analyticsRes.error && analyticsRes.data) {
      liveAnalytics = analyticsRes.data as PipelineAnalyticsRow[]
    }
    if (!leadsRes.error && leadsRes.data) {
      liveLeads = leadsRes.data as Lead[]
    }
  } catch (err) {
    console.error('Failed to load reports & analytics data:', err)
  }

  return <ReportsView initialAnalytics={liveAnalytics} initialLeads={liveLeads} />
}
