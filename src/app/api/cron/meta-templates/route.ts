import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { refreshMetaTemplateStatuses } from '@/lib/metaTemplates'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Called every 15 minutes by the meta-template-status job (migration 77, Bearer secret).
// Re-checks this product's Meta templates that are in review (and the rest hourly),
// so "Approved" / "Rejected" shows without anyone opening a page.
function fromCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  const header = request.headers.get('authorization') || ''
  if (!secret) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!fromCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await refreshMetaTemplateStatuses({ maxAgeMs: 60 * 60_000 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cron/meta-templates]', err)
    return NextResponse.json({ ok: false, error: 'Could not reach Meta' }, { status: 502 })
  }
}
