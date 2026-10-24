'use server'

import { redirect } from 'next/navigation'
import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { recordUnsubscribe } from '@/lib/recordUnsubscribe'

export async function confirmUnsubscribe(formData: FormData) {
  const e = String(formData.get('e') || '')
  const s = String(formData.get('s') || '')
  const email = verifyUnsubscribe(e, s)
  if (!email) redirect('/unsubscribe')
  const res = await recordUnsubscribe(email)
  redirect(`/unsubscribe?e=${encodeURIComponent(e)}&s=${encodeURIComponent(s)}${res.ok ? '' : '&failed=1'}`)
}
