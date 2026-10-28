'use server'

import { redirect } from 'next/navigation'
import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { recordAudienceOptOut, recordUnsubscribe } from '@/lib/recordUnsubscribe'

export async function confirmOptOut(formData: FormData) {
  const e = String(formData.get('e') || '')
  const s = String(formData.get('s') || '')
  const c = String(formData.get('c') || '') || null
  const email = verifyUnsubscribe(e, s, c)
  if (!email) redirect('/opt-out')
  // A Client Audience email: opt out of that client only
  const res = c ? await recordAudienceOptOut(c, email) : await recordUnsubscribe(email)
  redirect(`/opt-out?e=${encodeURIComponent(e)}&s=${encodeURIComponent(s)}${c ? `&c=${encodeURIComponent(c)}` : ''}${res.ok ? '' : '&failed=1'}`)
}
