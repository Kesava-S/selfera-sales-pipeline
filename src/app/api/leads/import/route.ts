import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

  const { rows } = await request.json().catch(() => ({ rows: null }))
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: 'Send at most 2,000 rows at a time' }, { status: 400 })

  const { data, error } = await supabase.rpc('import_businesses', { p_rows: rows })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('import_businesses', { p_rows: rows }).catch(err => {
      console.warn('[DualWrite] Failed to replicate import_businesses:', err)
    })
  }

  revalidatePath('/dashboard', 'layout')
  return NextResponse.json(data)
}
