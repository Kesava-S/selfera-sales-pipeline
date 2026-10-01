import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST { rows: [{ idx, business_name, phone, email, postcode }] } -> matches with existing businesses
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

  const { rows } = await request.json().catch(() => ({ rows: null }))
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: 'Send at most 2,000 rows at a time' }, { status: 400 })

  const { data, error } = await supabase.rpc('find_duplicates', { p_rows: rows })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ matches: data ?? [] })
}
