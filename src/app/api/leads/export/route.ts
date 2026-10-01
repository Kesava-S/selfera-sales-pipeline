import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
  // Quote, and stop spreadsheet formulas running when the file is opened
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

// GET /api/leads/export?<same filters as Lead Management> (admin only)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Only admins can export' }, { status: 403 })

  const q = new URL(request.url).searchParams
  const ids = (q.get('ids') || '').split(',').filter(Boolean)
  const rows: any[] = []
  const PAGE = 500
  for (let offset = 0; offset < 50_000; offset += PAGE) {
    const { data, error } = await supabase.rpc('list_pitches', {
      p_service: q.get('service') || null,
      p_type: q.get('type') || null,
      p_filter: q.get('tab') === 'review' ? 'Needs review' : q.get('stage') || 'all',
      p_search: q.get('q') || null,
      p_platform: q.get('platform') || null,
      p_assigned: q.get('assigned') || null,
      p_include_archived: q.get('archived') === '1',
      p_limit: PAGE,
      p_offset: offset,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  const out = ids.length ? rows.filter(r => ids.includes(r.opportunity_id)) : rows

  const headers = ['business_name', 'business_type', 'area', 'postcode', 'phone', 'email', 'instagram', 'facebook', 'company_type',
    'contact_name', 'stage', 'services_pitched', 'services_won', 'assigned_to', 'consultant', 'platforms', 'next_due', 'archived', 'added_on']
  const lines = [headers.join(',')]
  for (const r of out) {
    lines.push([
      r.business_name, r.business_type, r.area, r.postcode, r.phone, r.email, r.instagram, r.facebook, r.company_type,
      r.contact_name, r.stage, r.services_pitched, r.services_won, r.assigned_sales_name, r.assigned_consultant_name,
      (r.threads || []).map((t: any) => `${t.platform}: ${t.status}`), r.next_due_on, r.archived ? 'yes' : 'no',
      (r.created_at || '').slice(0, 10),
    ].map(csvCell).join(','))
  }
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="selfera-leads-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
