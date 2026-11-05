import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const threadId = searchParams.get('threadId')
  if (!threadId || !UUID_REGEX.test(threadId)) {
    return NextResponse.json({ error: 'Invalid or missing threadId' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller has permission to view this thread under RLS
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .maybeSingle()

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 500 })
    }
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found or access denied' }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load messages' }, { status: 500 })
  }
}
