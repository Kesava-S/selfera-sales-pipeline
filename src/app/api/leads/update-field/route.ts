import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Please log in again' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { businessId, field, value, secondaryValue } = body

  if (!businessId || !field) {
    return NextResponse.json({ ok: false, error: 'Missing businessId or field' }, { status: 400 })
  }

  try {
    if (field === 'address_and_postcode') {
      const [res1, res2] = await Promise.all([
        supabase.rpc('update_lead_field', {
          p_business_id: businessId,
          p_field: 'address',
          p_value: value || '',
        }),
        supabase.rpc('update_lead_field', {
          p_business_id: businessId,
          p_field: 'postcode',
          p_value: secondaryValue || '',
        }),
      ])
      if (res2.error) return NextResponse.json({ ok: false, error: res2.error.message }, { status: 400 })
      if (res1.error) return NextResponse.json({ ok: false, error: res1.error.message }, { status: 400 })
      return NextResponse.json({ ok: true, data: res2.data || res1.data })
    }

    let targetField = field
    if (targetField === 'no_site') {
      targetField = 'has_no_website'
    } else if (targetField === 'gaps') {
      targetField = 'gaps_found'
    }

    const { data, error } = await supabase.rpc('update_lead_field', {
      p_business_id: businessId,
      p_field: targetField,
      p_value: value ?? '',
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to update field' }, { status: 500 })
  }
}
