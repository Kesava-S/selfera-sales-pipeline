'use server'
import { createClient } from '@/lib/supabase/server'
import type { CSVLeadRow, DuplicateLeadMatch } from '@/types/database'

export interface BulkDuplicateCheckResult {
  rowIndex: number
  businessName: string
  contact: string
  match: DuplicateLeadMatch
}

export async function checkBulkDuplicates(leads: CSVLeadRow[]): Promise<BulkDuplicateCheckResult[]> {
  const supabase = await createClient()
  const results: BulkDuplicateCheckResult[] = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const email = lead.email ? lead.email.trim() : null
    const phone = lead.phone ? lead.phone.trim() : null

    if (email || phone) {
      try {
        const { data, error } = await supabase.rpc('check_duplicate_lead', {
          p_email: email || null,
          p_phone: phone || null,
        })

        if (!error && data && data.length > 0) {
          results.push({
            rowIndex: i,
            businessName: lead.business_name,
            contact: email || phone || '',
            match: data[0] as DuplicateLeadMatch,
          })
        }
      } catch (e) {
        console.error('Error checking duplicate for row:', i, e)
      }
    }
  }

  return results
}

export async function bulkImportLeads(
  leads: CSVLeadRow[],
  options?: { skipDuplicateIndices?: number[] }
) {
  const supabase = await createClient()
  const skipSet = new Set(options?.skipDuplicateIndices || [])

  const filtered = leads.filter((_, idx) => !skipSet.has(idx))
  if (filtered.length === 0) {
    return { success: true, count: 0 }
  }

  // Clean up and prepare leads for insertion
  const preparedLeads = filtered.map(lead => ({
    business_name: lead.business_name.trim(),
    email: lead.email ? lead.email.trim() : null,
    phone: lead.phone ? lead.phone.trim() : null,
    channel: lead.channel || 'Email',
    stage: 'New',
    follow_up_count: 0,
    next_follow_up: new Date().toISOString().split('T')[0] // today
  }))

  const { data, error } = await supabase.from('leads').insert(preparedLeads).select('id')
  
  if (error) {
    console.error('Bulk import error:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, count: data?.length || preparedLeads.length }
}
