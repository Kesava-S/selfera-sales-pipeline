import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { parseAndValidatePhone } from '@/lib/contact'
import { applyPhoneDefaults } from '@/lib/dynamicData'
import type { EmailCheck, EmailStatus } from '@/lib/emailCheck'

const EMAIL_STATUSES: (EmailStatus | null)[] = ['valid', 'risky', 'invalid', 'disposable', 'unknown']

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

  await applyPhoneDefaults()
  for (const row of rows) {
    if (typeof row.whatsapp_number === 'string' && row.whatsapp_number.trim()) {
      const w = parseAndValidatePhone(row.whatsapp_number.trim())
      if (w.valid && w.normalized) {
        row.whatsapp_number = w.normalized
      }
    }
    if (!row.business_type || typeof row.business_type !== 'string' || !row.business_type.trim()) {
      row.business_type = 'Restaurant or cafe'
    }
  }

  // Email check results from the import's check step: saved separately, not part of import_businesses
  const emailChecks = new Map<string, EmailCheck>()
  for (const row of rows) {
    const c = row.email_check
    const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
    if (email && c && EMAIL_STATUSES.includes(c.status)) emailChecks.set(email, c)
    delete row.email_check
  }

  const { data, error } = await supabase.rpc('import_businesses', {
    p_rows: rows,
    p_batch_id: batch_id || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (emailChecks.size) {
    const db = createServiceClient()
    const checkedAt = new Date().toISOString()
    const entries = [...emailChecks]
    for (let i = 0; i < entries.length; i += 10) {
      await Promise.all(entries.slice(i, i + 10).map(([email, c]) =>
        db.from('businesses').update({
          email_status: c.status,
          email_reason: c.reason ? String(c.reason).slice(0, 200) : null,
          email_suggestion: c.suggestion ? String(c.suggestion).slice(0, 254) : null,
          email_role: c.role === true,
          email_checked_at: checkedAt,
        }).eq('email_normalised', email)))
    }
  }

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
