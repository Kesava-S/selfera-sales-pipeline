import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
  // Quote, and stop spreadsheet formulas running when the file is opened
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

const UUID = /^[0-9a-f-]{36}$/i

export const AUDIENCE_FIELD_EXTRACTORS: Record<string, (r: any) => any> = {
  first_name: r => r.first_name,
  last_name: r => r.last_name,
  email: r => r.email,
  phone: r => r.phone_e164 || r.phone,
  phone_type: r => r.phone_type,
  second_phone: r => r.phone2_e164 || r.phone2,
  second_phone_type: r => r.phone2_type,
  whatsapp: r => r.whatsapp_status,
  country: r => r.country,
  town: r => r.town,
  postcode: r => r.postcode,
  last_visit: r => r.last_purchase_on,
  purchased: r => r.purchased,
  birthday_month: r => r.birthday_month,
  tags: r => r.tags,
  notes: r => r.notes,
  consent_confirmed: r => (r.consent_confirmed ? 'yes' : 'no'),
  consent_confirmed_on: r => String(r.consent_confirmed_at || '').slice(0, 10),
  do_not_contact: r => (r.do_not_contact ? 'yes' : 'no'),
  do_not_contact_reason: r => r.do_not_contact_reason,
  source: r => r.source,
  added_on: r => String(r.created_at || '').slice(0, 10),
}

const DEFAULT_AUDIENCE_HEADERS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'phone_type',
  'second_phone',
  'second_phone_type',
  'whatsapp',
  'country',
  'town',
  'postcode',
  'last_visit',
  'purchased',
  'birthday_month',
  'tags',
  'notes',
  'consent_confirmed',
  'consent_confirmed_on',
  'do_not_contact',
  'do_not_contact_reason',
  'source',
  'added_on',
]

async function executeAudienceExport(params: {
  businessId: string
  tab?: string | null
  q?: string | null
  phone?: string | null
  country?: string | null
  ids?: string[]
  columns?: string[]
  filename?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Only admins can export' }, { status: 403 })

  const businessId = params.businessId || ''
  if (!UUID.test(businessId)) return NextResponse.json({ error: 'Pick a client' }, { status: 400 })
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name')
    .eq('id', businessId)
    .maybeSingle()
  if (!business) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const tab = params.tab || 'all'
  const search = (params.q || '').replace(/[%_,()\\*]/g, ' ').trim()
  const phone = params.phone || ''
  const country = params.country || ''
  const ids = params.ids || []

  const rows: Record<string, unknown>[] = []
  const PAGE = 1000

  for (let offset = 0; offset < 100_000; offset += PAGE) {
    let list = supabase.from('customer_leads').select('*').eq('business_id', businessId)
    if (ids.length) {
      list = list.in('id', ids)
    } else {
      if (tab === 'dnc') list = list.eq('do_not_contact', true)
      else {
        list = list.eq('do_not_contact', false)
        if (tab === 'ready') list = list.eq('is_ready', true)
        if (tab === 'missing') list = list.eq('is_ready', false)
      }
      if (search) {
        list = list.or(
          ['first_name', 'last_name', 'email', 'phone', 'phone2', 'phone_e164', 'town', 'postcode']
            .map(c => `${c}.ilike.%${search}%`)
            .join(',')
        )
      }
      if (phone === 'none') list = list.is('phone', null).is('phone2', null)
      else if (['mobile', 'landline', 'invalid'].includes(phone)) {
        list = list.or(`phone_type.eq.${phone},phone2_type.eq.${phone}`)
      }
      if (country === 'UK' || country === 'India') list = list.eq('country', country)
    }

    const { data, error } = await list.order('created_at').range(offset, offset + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  // Exports of personal data are logged (who, when, how many, which filters)
  const { error: logError } = await supabase.rpc('log_audience_export', {
    p_business_id: businessId,
    p_rows: rows.length,
    p_filters: { tab, q: search, phone, country, selected_count: ids.length || undefined },
  })
  if (logError) {
    return NextResponse.json({ error: `Export not logged, so not allowed: ${logError.message}` }, { status: 500 })
  }

  const activeHeaders =
    params.columns && params.columns.length > 0
      ? params.columns.filter(c => AUDIENCE_FIELD_EXTRACTORS[c])
      : DEFAULT_AUDIENCE_HEADERS

  const lines = [activeHeaders.join(',')]
  for (const r of rows) {
    lines.push(
      activeHeaders
        .map(h => {
          const extract = AUDIENCE_FIELD_EXTRACTORS[h]
          const val = extract ? extract(r) : r[h]
          return csvCell(val)
        })
        .join(',')
    )
  }

  const date = new Date().toISOString().slice(0, 10)
  const slug =
    business.business_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'client'

  const safeFilename = (params.filename || `${slug}-audience-${date}.csv`).replace(/[^a-zA-Z0-9._-]/g, '_')

  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// GET /api/audience/export?business=<id>&<filters>
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const ids = (q.get('ids') || '').split(',').filter(Boolean)
  const columns = q.get('columns') ? q.get('columns')!.split(',').filter(Boolean) : undefined

  return executeAudienceExport({
    businessId: q.get('business') || '',
    tab: q.get('tab'),
    q: q.get('q'),
    phone: q.get('phone'),
    country: q.get('country'),
    ids,
    columns,
    filename: q.get('filename'),
  })
}

// POST /api/audience/export (accepts JSON body for large selections or verified columns)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    return executeAudienceExport({
      businessId: body.businessId,
      tab: body.tab,
      q: body.q,
      phone: body.phone,
      country: body.country,
      ids: Array.isArray(body.ids) ? body.ids : undefined,
      columns: Array.isArray(body.columns) ? body.columns : undefined,
      filename: body.filename,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid export request payload' }, { status: 400 })
  }
}
