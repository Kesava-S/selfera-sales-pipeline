'use server'

// Email checks in the CSV import's check step, before anything is saved, for
// Lead Management and Client Audience. The import screen sends the file's emails
// in rounds; the results are saved with the rows when they are imported.

import { createClient } from '@/lib/supabase/server'
import { actsAsSales } from '@/lib/config'
import type { ActionResult } from '@/app/dashboard/actions'
import { verifyEmails } from '@/lib/emailVerify'
import type { EmailCheck } from '@/lib/emailCheck'

export type EmailListRound = {
  results: Record<string, EmailCheck | null> // by lower-case email; null = not checked (no free checks left)
  outOfCredits: boolean
  credits: number | null
  error: string | null
}

// Each QuickEmailVerification check takes about a second; keep a round short
const EMAIL_ROUND = 10

export async function checkEmailList(emails: string[]): Promise<ActionResult<EmailListRound>> {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_user_role')
  if (role !== 'admin' && !actsAsSales(role)) return { ok: false, error: 'You do not have permission to do this.' }
  const list = [...new Set(emails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean))].slice(0, EMAIL_ROUND)
  const run = await verifyEmails(list)
  return {
    ok: true,
    data: {
      results: Object.fromEntries(list.map(e => [e, run.results.get(e) ?? null])),
      outOfCredits: run.outOfCredits,
      credits: run.credits,
      error: run.outOfCredits ? null : run.apiError,
    },
  }
}
