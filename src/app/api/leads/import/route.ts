import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leads } = await request.json()

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    let successCount = 0
    let failedCount = 0

    // For a real production app, we would use a stored procedure to insert businesses 
    // and opportunities in a transaction. We will do them one by one here for MVP.
    for (const lead of leads) {
      try {
        if (!lead.business_name || !lead.business_type) {
          failedCount++
          continue
        }

        // 1. Insert business
        const { data: business, error: bErr } = await supabase
          .from('businesses')
          .insert({
            business_name: lead.business_name,
            business_type: lead.business_type,
            area: lead.area || null,
            contact_name: lead.contact_name || null,
            email_address: lead.email_address || null,
            phone_number: lead.phone_number || null,
            instagram_handle: lead.instagram_handle || null
          })
          .select()
          .single()

        if (bErr || !business) {
          console.error('Failed to insert business:', bErr)
          failedCount++
          continue
        }

        // 2. Insert opportunity linked to the business
        const { error: oErr } = await supabase
          .from('opportunities')
          .insert({
            business_id: business.id,
            stage: 'Needs review', // Default stage for imported leads
            services_pitched: [], // Empty to start
            assigned_sales_id: user.id // Assign to the user who imported
          })

        if (oErr) {
          console.error('Failed to insert opportunity:', oErr)
          failedCount++
          continue
        }

        successCount++
      } catch (e) {
        failedCount++
      }
    }

    return NextResponse.json({ success: true, successCount, failedCount })
  } catch (err: any) {
    console.error('API /leads/import error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
