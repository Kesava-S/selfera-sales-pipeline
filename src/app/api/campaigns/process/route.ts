import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCampaignProgress, processCampaignQueue, type CampaignChannel } from '@/lib/campaignQueue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Called every minute by the campaign-queue-cron job (Bearer secret) and by the
// open campaign screen (staff session). Sends the next batch from the queue and,
// when a campaign is named, returns its progress.
async function authorise(request: Request): Promise<'cron' | 'staff' | null> {
  const authHeader = request.headers.get('authorization')
  const validSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (validSecret && authHeader === `Bearer ${validSecret}`) return 'cron'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: role } = await supabase.rpc('get_user_role')
    return role ? 'staff' : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const caller = await authorise(request)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const channel: CampaignChannel | null = body.channel === 'email' || body.channel === 'whatsapp' ? body.channel : null
  const campaignId: string | null = typeof body.campaignId === 'string' ? body.campaignId : null

  try {
    // The screen polls every few seconds, so keep its turns short for quick feedback
    const result = await processCampaignQueue({
      campaignId,
      timeBudgetMs: caller === 'cron' ? 40_000 : 6_000,
    })
    const progress = channel && campaignId ? await getCampaignProgress(channel, campaignId) : null
    return NextResponse.json({ ...result, progress })
  } catch (err) {
    console.error('Campaign queue processing failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Campaign sending failed' }, { status: 500 })
  }
}
