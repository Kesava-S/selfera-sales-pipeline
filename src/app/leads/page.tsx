import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { LeadsView } from '@/components/LeadsView'
import type { ExtendedLead } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  let liveLeads: ExtendedLead[] = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      liveLeads = data as ExtendedLead[]
    }
  } catch (err) {
    console.error('Failed to load leads from database:', err)
  }

  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#64748b' }}>Loading leads directory...</div>}>
      <LeadsView initialLeads={liveLeads} />
    </Suspense>
  )
}
