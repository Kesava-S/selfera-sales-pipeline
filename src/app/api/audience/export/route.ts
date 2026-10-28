import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
  // Quote, and stop spreadsheet formulas running when the file is opened
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

const UUID = /^[0-9a-f-]{36}$/i

// GET /api/audience/export?business=<id>&<same filters as the customer list> (admin only, logged)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Only admins can export' }, { status: 403 })

  const q = new URL(request.url).searchParams
  const businessId = q.get('business') || ''
  if (!UUID.test(businessId)) return NextResponse.json({ error: 'Pick a client' }, { status: 400 })
  const { data: business } = await supabase.from('businesses').select('business_name').eq('id', businessId).maybeSingle()
  if (!business) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const tab = q.get('tab') || 'all'
  const search = (q.get('q') || '').replace(/[%_,()\\*]/g, ' ').trim()
  const phone = q.get('phone') || ''
  const country = q.get('country') || ''

  const rows: Record<string, unknown>[] = []
  const PAGE = 1000
  for (let offset = 0; offset < 100_000; offset += PAGE) {
    let list = supabase.from('customer_leads').select('*').eq('business_id', businessId)
    if (tab === 'dnc') list = list.eq('do_not_contact', true)
    else {
      list = list.eq('do_not_contact', false)
      if (tab === 'ready') list = list.eq('is_ready', true)
      if (tab === 'missing') list = list.eq('is_ready', false)
    }
    if (search) list = list.or(['first_name', 'last_name', 'email', 'phone', 'phone2', 'phone_e164', 'town', 'postcode'].map(c => `${c}.ilike.%${search}%`).join(','))
    if (phone === 'none') list = list.is('phone', null).is('phone2', null)
    else if (['mobile', 'landline', 'invalid'].includes(phone)) list = list.or(`phone_type.eq.${phone},phone2_type.eq.${phone}`)
    if (country === 'UK' || country === 'India') list = list.eq('country', country)
    const { data, error } = await list.order('created_at').range(offset, offset + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  // Exports of personal data are logged (who, when, how many, which filters)
  const { error: logError } = await supabase.rpc('log_audience_export', {
    p_business_id: businessId, p_rows: rows.length, p_filters: { tab, q: search, phone, country },
  })
  if (logError) return NextResponse.json({ error: `Export not logged, so not allowed: ${logError.message}` }, { status: 500 })

  const headers = ['first_name', 'last_name', 'email', 'phone', 'phone_type', 'second_phone', 'second_phone_type', 'whatsapp', 'country',
    'town', 'postcode', 'last_visit', 'purchased', 'birthday_month', 'tags', 'notes', 'consent_confirmed', 'consent_confirmed_on',
    'do_not_contact', 'do_not_contact_reason', 'source', 'added_on']
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      r.first_name, r.last_name, r.email, r.phone_e164 || r.phone, r.phone_type, r.phone2_e164 || r.phone2, r.phone2_type, r.whatsapp_status, r.country,
      r.town, r.postcode, r.last_purchase_on, r.purchased, r.birthday_month, r.tags, r.notes,
      r.consent_confirmed ? 'yes' : 'no', String(r.consent_confirmed_at || '').slice(0, 10),
      r.do_not_contact ? 'yes' : 'no', r.do_not_contact_reason, r.source, String(r.created_at || '').slice(0, 10),
    ].map(csvCell).join(','))
  }
  const date = new Date().toISOString().slice(0, 10)
  const slug = business.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-audience-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
