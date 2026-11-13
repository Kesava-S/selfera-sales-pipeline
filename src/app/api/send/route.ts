import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSendRule, needsPecrConfirm } from '@/lib/sending'
import { getDynamicApiPlatforms } from '@/lib/integrations'
import { internationalDigits } from '@/lib/contact'
import { applyPhoneDefaults } from '@/lib/dynamicData'
import { sendEmail } from '@/lib/mailer'
import { isWhatsAppConfigured, sendWhatsAppMessage } from '@/lib/whatsapp'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { emailSendBlocked, whatsappSendBlocked } from '@/lib/emailBlock'

export const dynamic = 'force-dynamic'

// Sends ONE message directly (via SMTP for email, WhatsApp Cloud API, or n8n for other channels), then records it.
// Never called on a schedule.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })

  const input = await request.json().catch(() => null)
  const threadId: string | undefined = input?.threadId
  const body: string = String(input?.body ?? '').trim()
  const subject: string | null = input?.subject ? String(input.subject).trim() : null
  const templateId: string | null = input?.templateId || null
  if (!threadId || !body) return NextResponse.json({ error: 'The message is empty' }, { status: 400 })
  if (/\{[a-z_]+\}/.test(body + (subject ?? ''))) return NextResponse.json({ error: 'The message still has a {placeholder} in it' }, { status: 422 })

  // Reading the thread also checks this user may see it (database rules)
  const { data: thread } = await supabase
    .from('threads')
    .select('id, platform, status, external_thread_id, last_inbound_at, opportunities (id, stage, businesses (business_name, contact_name, area, linkedin, whatsapp_number, email, instagram, facebook, company_type))')
    .eq('id', threadId)
    .maybeSingle()
  if (!thread) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  const opp: any = thread.opportunities
  const b: any = opp?.businesses

  if (opp?.stage === 'Needs review') return NextResponse.json({ error: 'Approve this lead first. Outreach starts from the Approval queue.' }, { status: 422 })

  const webhook = process.env.N8N_WEBHOOK_URL
  const apiPlatforms = await getDynamicApiPlatforms()
  let templateName: string | null = input?.templateName || null
  if (!templateName && templateId) {
    const { data: t } = await supabase.from('templates').select('whatsapp_template_name').eq('id', templateId).maybeSingle()
    templateName = t?.whatsapp_template_name ?? null
  }
  if (!templateName && thread.platform === 'WhatsApp') {
    try {
      const { getWhatsAppConfig } = await import('@/lib/integrations')
      const waConfig = await getWhatsAppConfig()
      templateName = waConfig.default_template_name || process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'selfera_sales_pipeline_general'
    } catch {
      templateName = process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'selfera_sales_pipeline_general'
    }
  }

  // Resolve accurate lastInboundAt: fallback to latest message if thread.last_inbound_at is missing
  let effectiveLastInbound = thread.last_inbound_at
  if (!effectiveLastInbound) {
    const { data: latestInbound } = await supabase
      .from('messages')
      .select('created_at')
      .eq('thread_id', threadId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestInbound?.created_at) effectiveLastInbound = latestInbound.created_at
  }

  // Same rule the screen uses, checked again here
  const rule = getSendRule({
    platform: thread.platform, threadStatus: thread.status, stage: opp.stage, lastInboundAt: effectiveLastInbound,
    apiPlatforms, whatsappTemplateName: templateName, humanAgent: process.env.META_HUMAN_AGENT === 'true',
  })
  if (rule.mode !== 'api' && rule.mode !== 'api-template') return NextResponse.json({ error: rule.reason }, { status: 422 })
  if (needsPecrConfirm(thread.platform, b?.company_type) && input?.consentConfirmed !== true) {
    return NextResponse.json({ error: 'Confirm the sole trader has agreed to marketing emails (PECR).' }, { status: 422 })
  }

  const to =
    thread.platform === 'Email' ? b?.email
      : thread.platform === 'WhatsApp' ? (await applyPhoneDefaults(), internationalDigits(b?.whatsapp_number))
        : thread.external_thread_id || (thread.platform === 'Instagram' ? b?.instagram : b?.facebook)
  if (!to) return NextResponse.json({ error: `No ${thread.platform} contact saved for this business.` }, { status: 422 })

  // Leads who opted out (or bounced, or reported spam) are not emailed again,
  // except one answer each time a lead who opted out writes to us
  if (thread.platform === 'Email') {
    const blocked = await emailSendBlocked(supabase, thread.id, String(to), thread.last_inbound_at)
    if (blocked) return NextResponse.json({ error: blocked }, { status: 422 })
  }
  // Numbers that replied STOP on WhatsApp (any lead with that number)
  if (thread.platform === 'WhatsApp') {
    const blocked = await whatsappSendBlocked(supabase, thread.id, String(to), thread.last_inbound_at)
    if (blocked) return NextResponse.json({ error: blocked }, { status: 422 })
  }

  // 1. Send the message
  let externalId: string | null = null
  // What the lead actually received (a template's text differs from the typed message)
  let sentBody = body
  let metaTemplateUsed: string | null = null

  if (thread.platform === 'Email') {
    try {
      const res = await sendEmail({ to, subject: subject || '(No subject)', body })
      externalId = res.messageId
    } catch (e: any) {
      console.error('Email send error:', e)
      return NextResponse.json({ error: `Not sent: ${e?.message || 'Email delivery failed'}. Your message is still here.` }, { status: 502 })
    }
  } else if (thread.platform === 'WhatsApp' && (await isWhatsAppConfigured())) {
    try {
      let senderName: string | null = null
      if (rule.mode === 'api-template') {
        const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        senderName = (me?.full_name || '').split(' ')[0] || null
      }
      const res = await sendWhatsAppMessage({
        to,
        body,
        templateName: rule.mode === 'api-template' ? templateName : null,
        vars: { business_name: b?.business_name, contact_name: b?.contact_name, area: b?.area, sender_name: senderName },
      })
      if (!res.success) {
        return NextResponse.json({ error: `WhatsApp send failed: ${res.error || 'Unknown error'}. Your message is still here.` }, { status: 502 })
      }
      externalId = res.messageId
      if (res.sentText) sentBody = res.sentText
      metaTemplateUsed = res.templateUsed ?? null
    } catch (e: any) {
      console.error('WhatsApp send error:', e)
      return NextResponse.json({ error: `Not sent: ${e?.message || 'WhatsApp delivery failed'}. Your message is still here.` }, { status: 502 })
    }
  } else {
    // Non-email channels via n8n if configured
    if (!webhook) {
      return NextResponse.json({ error: `Not sent: ${thread.platform} sending service is not configured.` }, { status: 502 })
    }
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.N8N_WEBHOOK_SECRET || ''}` },
        body: JSON.stringify({
          platform: thread.platform, to, threadId, externalThreadId: thread.external_thread_id, body, subject,
          templateName: rule.mode === 'api-template' ? templateName : null, sentBy: user.id,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) {
        return NextResponse.json({ error: `Not sent: ${json?.error || `the ${thread.platform} service returned an error (${res.status})`}. Your message is still here.` }, { status: 502 })
      }
      externalId = json?.message_id ?? null
    } catch {
      return NextResponse.json({ error: `Not sent: could not reach the sending service. Your message is still here.` }, { status: 502 })
    }
  }

  const rpcArgs = {
    p_thread_id: threadId, p_body: sentBody, p_subject: subject, p_template_id: templateId,
    p_send_method: 'api', p_external_message_id: externalId, p_sent_by: user.id,
  }
  const { error } = await supabase.rpc('record_outbound', rpcArgs)
  if (error) {
    return NextResponse.json({ error: `The message WAS sent, but saving it failed (${error.message}). Don't send it again; refresh the page.` }, { status: 500 })
  }
  // Note which Meta template it went out as, for the chat
  if (metaTemplateUsed && externalId) {
    await createServiceClient().from('messages').update({ meta_template: metaTemplateUsed })
      .eq('thread_id', threadId).eq('external_message_id', externalId)
  }

  if (isDualWriteEnabled()) {
    replicateRpcToSecondary('record_outbound', rpcArgs).catch(err => {
      console.warn('[DualWrite] Failed to replicate record_outbound:', err)
    })
  }

  revalidatePath('/dashboard', 'layout')
  return NextResponse.json({ ok: true })
}
