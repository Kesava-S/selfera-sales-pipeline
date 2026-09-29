'use server'
import { createClient } from '@/lib/supabase/server'
import type { CSVLeadRow } from '@/types/database'

export async function bulkImportLeads(leads: CSVLeadRow[]) {
  const supabase = await createClient()
  
  // Clean up and prepare leads for insertion
  const preparedLeads = leads.map(lead => ({
    business_name: lead.business_name,
    email: lead.email || null,
    channel: lead.channel || 'Email',
    stage: 'New',
    next_follow_up: new Date().toISOString().split('T')[0] // today
  }))

  const { error } = await supabase.from('leads').insert(preparedLeads)
  
  if (error) {
    console.error('Bulk import error:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true }
}
