import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAndValidatePhone, isUkMobile } from '@/lib/contact'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      business_name,
      business_type,
      service_pitched = 'Website',
      area,
      contact_name,
      email,
      phone,
      instagram,
      facebook
    } = body

    if (!business_name?.trim()) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }

    const cleanBusinessType = (business_type || 'Other').trim()
    const cleanService = (service_pitched || 'Website').trim()
    const cleanEmail = email?.trim() || null
    let normalizedPhone: string | null = null
    if (phone?.trim()) {
      const pCheck = parseAndValidatePhone(phone.trim())
      if (!pCheck.valid) {
        return NextResponse.json({ error: pCheck.error || 'Phone must include country code (e.g. +44, 44, or 0...)' }, { status: 400 })
      }
      normalizedPhone = pCheck.normalized
    }
    const cleanInstagram = instagram?.trim() ? instagram.trim().replace(/^@/, '') : null
    const cleanArea = area?.trim() || null
    const cleanContact = contact_name?.trim() || null
    const cleanFacebook = facebook?.trim() || null

    // 1. Insert into businesses
    const { data: business, error: bErr } = await supabase
      .from('businesses')
      .insert({
        business_name: business_name.trim(),
        business_type: cleanBusinessType,
        area: cleanArea,
        contact_name: cleanContact,
        email: cleanEmail,
        phone: normalizedPhone,
        instagram: cleanInstagram,
        facebook: cleanFacebook
      })
      .select()
      .single()

    if (bErr || !business) {
      console.error('Error inserting business:', bErr)
      return NextResponse.json({ error: bErr?.message || 'Failed to save business' }, { status: 500 })
    }

    // 2. Insert into opportunities
    const { data: opp, error: oErr } = await supabase
      .from('opportunities')
      .insert({
        business_id: business.id,
        stage: 'Needs review',
        services_pitched: [cleanService],
        assigned_sales_id: user.id
      })
      .select()
      .single()

    if (oErr || !opp) {
      console.error('Error inserting opportunity:', oErr)
      return NextResponse.json({ error: oErr?.message || 'Failed to create opportunity' }, { status: 500 })
    }

    // 3. Create initial threads for provided contact channels
    const platforms: string[] = []
    if (cleanEmail) platforms.push('Email')
    if (normalizedPhone) {
      const isMobile = isUkMobile(normalizedPhone)
      platforms.push(isMobile ? 'WhatsApp' : 'Phone')
    }
    if (cleanInstagram) platforms.push('Instagram')
    if (cleanFacebook) platforms.push('Facebook')
    if (platforms.length === 0) platforms.push('Walk-in')

    for (const p of platforms) {
      await supabase
        .from('threads')
        .insert({
          opportunity_id: opp.id,
          platform: p,
          status: 'Not contacted',
          step: 0,
          next_due_on: new Date().toISOString().split('T')[0]
        })
    }

    return NextResponse.json({
      success: true,
      businessId: business.id,
      opportunityId: opp.id,
      business_name: business.business_name
    })
  } catch (err: any) {
    console.error('API /leads/create error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
