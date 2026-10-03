import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isImapConfigured, syncEmailReplies } from '@/lib/imap'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function checkAuth(request: Request): Promise<boolean> {
  // 1. Check Bearer token for automated crons
  const authHeader = request.headers.get('authorization')
  const validSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (validSecret && authHeader === `Bearer ${validSecret}`) {
    return true
  }

  // 2. Check logged-in user session
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return Boolean(user)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const isAuthorized = await checkAuth(request)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isImapConfigured()) {
    return NextResponse.json(
      { error: 'Email sync is not configured. Set SMTP_PASS or IMAP_PASS in .env' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const unseenOnly = searchParams.get('all') !== 'true'
  const sinceDays = parseInt(searchParams.get('sinceDays') || '3', 10)
  const maxMessages = parseInt(searchParams.get('maxMessages') || '50', 10)

  try {
    const result = await syncEmailReplies({
      unseenOnly,
      sinceDays,
      maxMessages,
      markAsSeen: true,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Email sync failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to sync emails' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const isAuthorized = await checkAuth(request)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isImapConfigured()) {
    return NextResponse.json(
      { error: 'Email sync is not configured. Set SMTP_PASS or IMAP_PASS in .env' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const unseenOnly = body.unseenOnly ?? true
  const sinceDays = body.sinceDays ?? 3
  const maxMessages = body.maxMessages ?? 50
  const markAsSeen = body.markAsSeen ?? true

  try {
    const result = await syncEmailReplies({
      unseenOnly,
      sinceDays,
      maxMessages,
      markAsSeen,
    })

    let messages = null
    if (body.threadId) {
      try {
        const { createServiceClient } = await import('@/lib/supabase/server')
        const service = createServiceClient()
        const { data } = await service
          .from('messages')
          .select('*')
          .eq('thread_id', body.threadId)
          .order('created_at', { ascending: true })
        messages = data
      } catch {}
    }

    return NextResponse.json({ ...result, messages })
  } catch (err: any) {
    console.error('Email sync failed:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to sync emails' },
      { status: 500 }
    )
  }
}
