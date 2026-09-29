import { createClient } from '@/lib/supabase/server'
import type { Template, ExtendedLead } from '@/types/database'
import { TemplatesView } from '@/components/TemplatesView'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  let liveTemplates: Template[] = []
  let liveLeads: ExtendedLead[] = []

  try {
    const supabase = await createClient()
    const [tplRes, leadsRes] = await Promise.all([
      supabase.from('templates').select('*').order('created_at', { ascending: true }),
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(30),
    ])

    if (!tplRes.error && tplRes.data) {
      liveTemplates = tplRes.data as Template[]
    }
    if (!leadsRes.error && leadsRes.data) {
      liveLeads = leadsRes.data as ExtendedLead[]
    }
  } catch (err) {
    console.error('Failed to load templates or leads from database:', err)
  }

  return <TemplatesView initialTemplates={liveTemplates} initialLeads={liveLeads} />
}
