import { NextResponse } from 'next/server'
import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { recordUnsubscribe } from '@/lib/recordUnsubscribe'

export const dynamic = 'force-dynamic'

// One-click unsubscribe (RFC 8058): Gmail and Outlook POST here when the lead
// presses the inbox's own "Unsubscribe" button. The link in the email body opens
// the /unsubscribe page instead.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const email = verifyUnsubscribe(url.searchParams.get('e'), url.searchParams.get('s'))
  if (!email) return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 })
  const res = await recordUnsubscribe(email)
  return res.ok ? NextResponse.json({ status: 'unsubscribed' }) : NextResponse.json({ error: 'Please try again' }, { status: 500 })
}
