import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { threadId, body, subject, templateId } = await request.json()

    if (!threadId || !body) {
      return NextResponse.json({ error: 'Missing threadId or body' }, { status: 400 })
    }

    // Fetch thread platform
    const { data: thread, error: threadErr } = await supabase
      .from('threads')
      .select('platform, opportunity_id')
      .eq('id', threadId)
      .single()

    if (threadErr || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL

    if (n8nWebhookUrl) {
      // Hit n8n
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.N8N_WEBHOOK_SECRET || ''}`
        },
        body: JSON.stringify({
          threadId,
          platform: thread.platform,
          body,
          subject,
          templateId,
          userId: user.id
        })
      })

      if (!response.ok) {
        console.error('n8n error:', await response.text())
        return NextResponse.json({ error: 'Failed to send via n8n' }, { status: 500 })
      }
    } else {
      console.warn('N8N_WEBHOOK_URL is missing. Simulating success by calling record_outbound directly.')
      // Simulate success
      const { error: rpcErr } = await supabase.rpc('record_outbound', {
        p_thread_id: threadId,
        p_body: body,
        p_subject: subject || null,
        p_template_id: templateId || null,
        p_send_method: 'api',
        p_external_message_id: 'local-' + Date.now(),
        p_sent_by: user.id
      })

      if (rpcErr) {
        console.error('Error simulating send:', rpcErr)
        return NextResponse.json({ error: 'Failed to simulate send' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API /send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
