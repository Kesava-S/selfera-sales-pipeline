import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { parseAndValidatePhone } from '@/lib/contact'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { rows, batch_id } = body
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: 'Send at most 2,000 rows at a time' }, { status: 400 })

  for (const row of rows) {
    if (typeof row.whatsapp_number === 'string' && row.whatsapp_number.trim()) {
      const w = parseAndValidatePhone(row.whatsapp_number.trim())
      if (w.valid && w.normalized) {
        row.whatsapp_number = w.normalized
      }
    }
  }

  const { data, error } = await supabase.rpc('import_businesses', {
    p_rows: rows,
    p_batch_id: batch_id || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('import_businesses', {
      p_rows: rows,
      p_batch_id: batch_id || null,
    }).catch(err => {
      console.warn('[DualWrite] Failed to replicate import_businesses:', err)
    })
  }

  revalidatePath('/dashboard', 'layout')
  return NextResponse.json(data)
}
