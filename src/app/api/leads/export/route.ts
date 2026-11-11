import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
  // Quote, and stop spreadsheet formulas running when the file is opened
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export const LEAD_FIELD_EXTRACTORS: Record<string, (r: any) => any> = {
  business_name: r => r.business_name,
  business_type: r => r.business_type,
  area: r => r.area,
  postcode: r => r.postcode,
  address: r => r.address,
  company_type: r => r.company_type,
  existing_website: r => r.existing_website || (r.has_no_website ? 'No website' : ''),

  contact_name: r => r.contact_name,
  email: r => r.email || r.owner_email,
  whatsapp_number: r => r.whatsapp_number,
  phone: r => r.phone || r.owner_contact,
  instagram: r => r.instagram,
  facebook: r => r.facebook,
  linkedin: r => r.linkedin,

  stage: r => r.stage,
  services_pitched: r => r.services_pitched,
  services_won: r => r.services_won,
  assigned_to: r => r.assigned_sales_name,
  consultant: r => r.assigned_consultant_name,
  platforms: r => (r.threads || []).map((t: any) => `${t.platform}: ${t.status}`).join('; '),
  next_due: r => r.next_due_on,
  archived: r => (r.archived ? 'yes' : 'no'),
  added_on: r => (r.created_at || '').slice(0, 10),

  tech_partner_name: r => r.tech_partner_name,
  gaps_found: r => r.gaps_found,

  // Fallback aliases for backward compatibility
  google_rating: r => r.google_rating,
  owner_contact: r => r.owner_contact,
  owner_email: r => r.owner_email,
}

const DEFAULT_HEADERS = [
  'business_name',
  'business_type',
  'area',
  'postcode',
  'whatsapp_number',
  'email',
  'instagram',
  'facebook',
  'linkedin',
  'company_type',
  'contact_name',
  'stage',
  'services_pitched',
  'services_won',
  'assigned_to',
  'consultant',
  'platforms',
  'next_due',
  'archived',
  'added_on',
]

async function executeExport(params: {
  service?: string | null
  type?: string | null
  tab?: string | null
  stage?: string | null
  q?: string | null
  platform?: string | null
  assigned?: string | null
  archived?: boolean | null
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

  const ids = params.ids || []
  const rows: any[] = []
  const PAGE = 500

  for (let offset = 0; offset < 50_000; offset += PAGE) {
    const { data, error } = await supabase.rpc('list_pitches', {
      p_service: params.service || null,
      p_type: params.type || null,
      p_filter: params.tab === 'review' ? 'Needs review' : params.stage || 'all',
      p_search: params.q || null,
      p_platform: params.platform || null,
      p_assigned: params.assigned || null,
      p_include_archived: params.archived === true,
      p_limit: PAGE,
      p_offset: offset,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  const out = ids.length ? rows.filter(r => ids.includes(r.opportunity_id)) : rows

  // Determine headers to output
  const activeHeaders =
    params.columns && params.columns.length > 0
      ? params.columns.filter(c => LEAD_FIELD_EXTRACTORS[c])
      : DEFAULT_HEADERS

  const lines = [activeHeaders.join(',')]
  for (const r of out) {
    lines.push(
      activeHeaders
        .map(h => {
          const extract = LEAD_FIELD_EXTRACTORS[h]
          const val = extract ? extract(r) : r[h]
          return csvCell(val)
        })
        .join(',')
    )
  }

  const date = new Date().toISOString().slice(0, 10)
  const safeFilename = (params.filename || `selfera-leads-${date}.csv`).replace(/[^a-zA-Z0-9._-]/g, '_')

  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// GET /api/leads/export?<filters>
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const ids = (q.get('ids') || '').split(',').filter(Boolean)
  const columns = q.get('columns') ? q.get('columns')!.split(',').filter(Boolean) : undefined

  return executeExport({
    service: q.get('service'),
    type: q.get('type'),
    tab: q.get('tab'),
    stage: q.get('stage'),
    q: q.get('q'),
    platform: q.get('platform'),
    assigned: q.get('assigned'),
    archived: q.get('archived') === '1',
    ids,
    columns,
    filename: q.get('filename'),
  })
}

// POST /api/leads/export (accepts JSON body for large selections or verified columns)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    return executeExport({
      service: body.service,
      type: body.type,
      tab: body.tab,
      stage: body.stage,
      q: body.q,
      platform: body.platform,
      assigned: body.assigned,
      archived: body.archived === true || body.archived === '1',
      ids: Array.isArray(body.ids) ? body.ids : undefined,
      columns: Array.isArray(body.columns) ? body.columns : undefined,
      filename: body.filename,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid export request payload' }, { status: 400 })
  }
}
