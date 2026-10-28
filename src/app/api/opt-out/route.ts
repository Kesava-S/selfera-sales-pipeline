import { NextResponse } from 'next/server'
import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { recordAudienceOptOut, recordUnsubscribe } from '@/lib/recordUnsubscribe'

export const dynamic = 'force-dynamic'

// One-click opt-out (RFC 8058): Gmail and Outlook POST here when the lead
// presses the inbox's own "Unsubscribe" button. The link in the email body opens
// the /opt-out page instead.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const c = url.searchParams.get('c')
  const email = verifyUnsubscribe(url.searchParams.get('e'), url.searchParams.get('s'), c)
  if (!email) return NextResponse.json({ error: 'Invalid opt-out link' }, { status: 400 })
  const res = c ? await recordAudienceOptOut(c, email) : await recordUnsubscribe(email)
  return res.ok ? NextResponse.json({ status: 'opted_out' }) : NextResponse.json({ error: 'Please try again' }, { status: 500 })
}
