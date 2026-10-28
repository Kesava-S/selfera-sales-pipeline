'use server'

// Every change made from the dashboard goes through here. Business rules and
// access checks live in the database functions; these only call them and
// turn database errors into short messages.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { parseAndValidatePhone } from '@/lib/contact'
import { emailSendBlocked } from '@/lib/emailBlock'

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function friendly(message?: string): string {
  if (!message) return 'Something went wrong. Please try again.'
  if (/JWT|not logged in|401/i.test(message)) return 'Your session has expired. Please log in again.'
  if (/permission denied/i.test(message)) return 'You do not have permission to do this.'
  if (/duplicate key|already exists/i.test(message)) return 'This already exists.'
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) return 'Could not reach the database. Check your connection and try again.'
  return message.replace(/^.*?ERROR:\s*/i, '')
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return { ok: false, error: friendly(error.message) }

  if (isDualWriteEnabled()) {
    replicateRpcToSecondary(fn, args).catch(err => {
      console.warn(`[DualWrite] RPC "${fn}" replication error:`, err)
    })
  }

  revalidatePath('/dashboard', 'layout')
  return { ok: true, data: data as T }
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ---------- Review queue ----------
export async function approveLeads(businessIds: string[]) {
  if (!businessIds.length) return { ok: false, error: 'Nothing selected.' } as ActionResult
  return rpc('approve_import', { p_business_ids: businessIds })
}

// ---------- Stage, hand over, win ----------
export async function changeStage(opportunityId: string, stage: string, reason: string) {
  return rpc('set_stage', { p_opportunity_id: opportunityId, p_stage: stage, p_reason: reason || null, p_user_id: await currentUserId() })
}

// A closed lead replied, and staff decided not to reopen it
export async function dismissLateReply(opportunityId: string) {
  return rpc('dismiss_late_reply', { p_opportunity_id: opportunityId })
}

export async function handOver(opportunityId: string, consultationAtIso: string) {
  if (!consultationAtIso) return { ok: false, error: 'Pick the consultation date and time.' } as ActionResult
  return rpc('hand_over', { p_opportunity_id: opportunityId, p_consultation_at: consultationAtIso, p_user_id: await currentUserId() })
}

export async function recordWin(opportunityId: string, servicesWon: string[], convertedThrough: string) {
  if (!servicesWon.length) return { ok: false, error: 'Pick at least one service won.' } as ActionResult
  if (!convertedThrough) return { ok: false, error: 'Pick how it was won.' } as ActionResult
  return rpc('record_win', { p_opportunity_id: opportunityId, p_services_won: servicesWon, p_converted_through: convertedThrough, p_user_id: await currentUserId() })
}

export async function assignConsultant(opportunityId: string, consultantId: string) {
  if (!consultantId) return { ok: false, error: 'Pick a consultant.' } as ActionResult
  return rpc('assign_consultant', { p_opportunity_id: opportunityId, p_consultant_id: consultantId })
}

export async function addNote(opportunityId: string, body: string) {
  if (!body.trim()) return { ok: false, error: 'The note is empty.' } as ActionResult
  return rpc('add_note', { p_opportunity_id: opportunityId, p_body: body })
}

export async function newPitch(businessId: string, services: string[], sourceOpportunityId?: string) {
  if (!services.length) return { ok: false, error: 'Pick at least one service.' } as ActionResult
  return rpc<string>('new_pitch', { p_business_id: businessId, p_services: services, p_source_opportunity_id: sourceOpportunityId ?? null })
}

export async function startThread(opportunityId: string, platform: string) {
  return rpc<string>('start_thread', { p_opportunity_id: opportunityId, p_platform: platform })
}

// ---------- Messages ----------
// Used for "Mark as sent" (manual send)
export async function markSent(threadId: string, body: string, subject?: string | null, templateId?: string | null) {
  if (!body.trim()) return { ok: false, error: 'Write the message (or call notes) first.' } as ActionResult
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('threads').select('platform, last_inbound_at, opportunities (businesses (email))').eq('id', threadId).maybeSingle()
  if (thread?.platform === 'Email') {
    const blocked = await emailSendBlocked(supabase, threadId, (thread.opportunities as any)?.businesses?.email, thread.last_inbound_at)
    if (blocked) return { ok: false, error: blocked } as ActionResult
  }
  return rpc('record_outbound', {
    p_thread_id: threadId,
    p_body: body,
    p_subject: subject || null,
    p_template_id: templateId || null,
    p_send_method: 'manual',
    p_external_message_id: null,
    p_sent_by: await currentUserId(),
  })
}

// ---------- Business details ----------
const EDITABLE = [
  'business_name', 'business_type', 'tier', 'room_count', 'area', 'address', 'postcode', 'maps_link',
  'whatsapp_number', 'email', 'instagram', 'facebook', 'linkedin', 'existing_website', 'company_type', 'contact_name', 'notes',
  'owner_contact', 'gaps_found', 'has_no_website',
  'owner_email', 'tech_partner_type', 'tech_partner_name', 'branches', 'source',
] as const

export async function updateBusiness(businessId: string, fields: Record<string, string | number | null>) {
  const supabase = await createClient()
  const clean: Record<string, unknown> = {}
  for (const k of EDITABLE) {
    if (k in fields) {
      const v = fields[k]
      clean[k] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v
    }
  }

  // Handle tech partner input if passed as existing_tech_partner or tech_partner
  const rawTp = (fields.existing_tech_partner || fields.tech_partner) as string | undefined
  if (typeof rawTp === 'string' && rawTp.trim()) {
    const raw = rawTp.trim()
    if (raw.toLowerCase() === 'none') {
      clean.tech_partner_type = 'None'
      clean.tech_partner_name = null
    } else if (/^diy/i.test(raw)) {
      clean.tech_partner_type = 'DIY'
      clean.tech_partner_name = raw.replace(/^diy\s*\(?|\)?$/i, '').trim() || null
    } else if (/^agency/i.test(raw)) {
      clean.tech_partner_type = 'Agency'
      clean.tech_partner_name = raw.replace(/^agency\s*\(?|\)?$/i, '').trim() || null
    } else {
      clean.tech_partner_type = 'Agency'
      clean.tech_partner_name = raw
    }
  }

  // Handle legacy owner contacts if passed
  if (!clean.owner_contact) {
    const legacyOwner = fields.owner_whatsapp || fields.owner_social
    if (typeof legacyOwner === 'string' && legacyOwner.trim()) {
      clean.owner_contact = legacyOwner.trim()
    }
  }
  if ('business_name' in clean && !clean.business_name) return { ok: false, error: 'Business name is required.' } as ActionResult
  if (typeof clean.instagram === 'string') clean.instagram = (clean.instagram as string).replace(/^.*instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '') || null
  if (typeof clean.email === 'string') clean.email = (clean.email as string).toLowerCase()
  if (typeof clean.room_count === 'string') clean.room_count = parseInt(clean.room_count as string) || null

  if (typeof clean.whatsapp_number === 'string' && clean.whatsapp_number) {
    const waCheck = parseAndValidatePhone(clean.whatsapp_number as string)
    if (!waCheck.valid) return { ok: false, error: waCheck.error ? `WhatsApp: ${waCheck.error}` : 'WhatsApp must include country code (e.g. +44, 44, or 0...)' } as ActionResult
    clean.whatsapp_number = waCheck.normalized
  }

  const { error, count } = await supabase.from('businesses').update(clean, { count: 'exact' }).eq('id', businessId)
  if (error) {
    if (/duplicate key/i.test(error.message)) return { ok: false, error: 'Another business already uses this email or contact.' } as ActionResult
    return { ok: false, error: friendly(error.message) } as ActionResult
  }
  if (count === 0) return { ok: false, error: 'You cannot edit this business.' } as ActionResult
  revalidatePath('/dashboard', 'layout')
  return { ok: true } as ActionResult
}

// ---------- Admin bulk actions ----------
export async function bulkAssign(opportunityIds: string[], salesId: string | null) {
  return rpc<number>('assign_sales', { p_opportunity_ids: opportunityIds, p_sales_id: salesId })
}
export async function bulkServices(opportunityIds: string[], services: string[]) {
  return rpc<number>('set_services', { p_opportunity_ids: opportunityIds, p_services: services })
}
export async function bulkArchive(businessIds: string[], archived: boolean) {
  return rpc<number>('set_archived', { p_business_ids: businessIds, p_archived: archived })
}

// ---------- Bookings ----------
export async function linkBooking(bookingId: string, opportunityId: string) {
  return rpc('link_booking', { p_booking_id: bookingId, p_opportunity_id: opportunityId })
}

// ---------- Notifications ----------
// ---------- Templates (admin only) ----------
export async function saveTemplate(t: {
  id?: string | null
  step: string
  businessType?: string
  platform: string
  subject: string
  body: string
}): Promise<ActionResult<string>> {
  const supabase = createServiceClient()
  const businessTypes = t.businessType && t.businessType !== 'General' ? [t.businessType] : []
  const name = `${t.businessType || 'General'} · ${t.platform === 'All' ? 'All platforms' : t.platform} · ${t.step}`
  const subject = (t.platform === 'Email' || t.platform === 'All') ? (t.subject.trim() || null) : null

  if (t.id) {
    const { error } = await supabase
      .from('templates')
      .update({
        subject,
        body: t.body,
        name,
        business_types: businessTypes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', t.id)
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/templates')
    return { ok: true, data: t.id }
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      platform: t.platform,
      step: t.step,
      services: [],
      business_types: businessTypes,
      subject,
      body: t.body,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/templates')
  return { ok: true, data: data?.id }
}

export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('templates')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/templates')
  return { ok: true }
}

// ---------- Settings ----------
export async function setMyName(fullName: string) {
  return rpc('set_my_name', { p_full_name: fullName })
}

// Admin only (checked in the database): the lead asked to hear from us again
export async function removeOptOut(id: string): Promise<ActionResult> {
  const res = await rpc<undefined>('remove_opt_out', { p_id: id })
  if (res.ok) revalidatePath('/dashboard', 'layout')
  return res
}

export async function setCadence(stepName: string, days: number) {
  return rpc('set_cadence', { p_step_name: stepName, p_days: days })
}

// Admin only (checked in the database). Who is on the team, their role and
// whether they can log in are set in the Admin Panel's Access page.
export async function markNotificationsRead(ids: string[] | 'all') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' } as ActionResult
  let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
  if (ids !== 'all') q = q.in('id', ids)
  const { error } = await q
  if (error) return { ok: false, error: friendly(error.message) } as ActionResult
  return { ok: true } as ActionResult
}

// ---------- Campaign send queue ----------
// Launching only queues the recipients; /api/campaigns/process sends them in
// batches with retries (see src/lib/campaignQueue.ts). These call the database
// directly instead of rpc(), so production-to-staging replication never queues
// (and sends) the same campaign a second time.
export type LaunchResult = { queued: number; skipped: number; removed: number }

async function enqueueCampaign(channel: 'email' | 'whatsapp', id: string, path: string): Promise<ActionResult<LaunchResult>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('enqueue_campaign', { p_channel: channel, p_campaign_id: id })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath(path)
  return { ok: true, data: data as LaunchResult }
}

export async function retryFailedCampaignSends(channel: 'email' | 'whatsapp', id: string): Promise<ActionResult<number>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('retry_failed_campaign_sends', { p_channel: channel, p_campaign_id: id })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath(channel === 'email' ? '/dashboard/campaigns' : '/dashboard/whatsapp-campaigns')
  return { ok: true, data: data as number }
}

// ---------- Email Databases & Campaigns ----------
export type EmailDatabaseInput = {
  id?: string | null
  name: string
  description?: string | null
  contacts: Array<{
    id?: string
    business_name: string
    email: string
    contact_name?: string | null
    category?: string | null
    business_type?: string | null
  }>
}

export async function saveEmailDatabase(input: EmailDatabaseInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, error: 'Database name is required.' }
  const cleanContacts = (input.contacts || []).filter(c => c.email && c.email.includes('@'))
  if (cleanContacts.length === 0) return { ok: false, error: 'Please add at least one valid contact with an email address.' }

  const supabase = await createClient()
  const userId = await currentUserId()

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    contacts: JSON.stringify(cleanContacts),
    contact_count: cleanContacts.length,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase.from('email_databases').update(payload).eq('id', input.id)
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/campaigns')
    return { ok: true, data: { id: input.id } }
  } else {
    payload.created_by = userId
    const { data, error } = await supabase.from('email_databases').insert(payload).select('id').single()
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/campaigns')
    return { ok: true, data: { id: data.id } }
  }
}

export async function deleteEmailDatabase(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('email_databases').delete().eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/campaigns')
  return { ok: true }
}

export type EmailCampaignInput = {
  id?: string | null
  name: string
  subject: string
  preheader?: string | null
  body: string
  service?: string
  databaseId?: string | null
  databaseName?: string | null
  status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived'
  recipientCount?: number
  recipients?: Array<{ id: string; business_name: string; email: string; contact_name?: string | null }>
  scheduledAt?: string | null
}

export async function saveEmailCampaign(input: EmailCampaignInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, error: 'Campaign name is required.' }
  if (!input.subject.trim()) return { ok: false, error: 'Subject line is required.' }
  if (!input.body.trim()) return { ok: false, error: 'Email body cannot be empty.' }

  const supabase = await createClient()
  const userId = await currentUserId()

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    subject: input.subject.trim(),
    preheader: input.preheader?.trim() || null,
    body: input.body.trim(),
    service: input.service || 'General',
    database_id: input.databaseId || null,
    database_name: input.databaseName || null,
    status: input.status || 'draft',
    recipient_count: input.recipientCount ?? (input.recipients ? input.recipients.length : 0),
    recipients: JSON.stringify(input.recipients || []),
    scheduled_at: input.scheduledAt || null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase.from('email_campaigns').update(payload).eq('id', input.id)
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/campaigns')
    return { ok: true, data: { id: input.id } }
  } else {
    payload.created_by = userId
    const { data, error } = await supabase.from('email_campaigns').insert(payload).select('id').single()
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/campaigns')
    return { ok: true, data: { id: data.id } }
  }
}

export async function deleteEmailCampaign(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('email_campaigns').delete().eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/campaigns')
  return { ok: true }
}

export async function sendTestEmailCampaign({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<ActionResult> {
  if (!to || !to.includes('@')) return { ok: false, error: 'Enter a valid email address.' }
  try {
    const { isSmtpConfigured, sendEmail } = await import('@/lib/mailer')
    if (!isSmtpConfigured()) {
      return { ok: false, error: 'SMTP is not configured in .env.local (SMTP_PASS is required).' }
    }
    await sendEmail({
      to,
      subject: `[TEST] ${subject}`,
      body,
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send test email.'
    return { ok: false, error: msg }
  }
}

export async function launchEmailCampaign(id: string): Promise<ActionResult<LaunchResult>> {
  return enqueueCampaign('email', id, '/dashboard/campaigns')
}

// ---------- WhatsApp Campaigns & Databases ----------
export type WhatsAppDatabaseInput = {
  id?: string | null
  name: string
  description?: string | null
  contacts: Array<{
    id?: string
    business_name: string
    whatsapp_number: string
    contact_name?: string | null
    category?: string | null
    business_type?: string | null
  }>
}

export async function saveWhatsAppDatabase(input: WhatsAppDatabaseInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, error: 'Database name is required.' }
  const cleanContacts = (input.contacts || []).filter(c => c.whatsapp_number && c.whatsapp_number.trim().length >= 7)
  if (cleanContacts.length === 0) return { ok: false, error: 'Please add at least one contact with a phone number.' }

  const supabase = await createClient()
  const userId = await currentUserId()

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    contacts: JSON.stringify(cleanContacts),
    contact_count: cleanContacts.length,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase.from('whatsapp_databases').update(payload).eq('id', input.id)
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/whatsapp-campaigns')
    return { ok: true, data: { id: input.id } }
  } else {
    payload.created_by = userId
    const { data, error } = await supabase.from('whatsapp_databases').insert(payload).select('id').single()
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/whatsapp-campaigns')
    return { ok: true, data: { id: data.id } }
  }
}

export async function deleteWhatsAppDatabase(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('whatsapp_databases').delete().eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/whatsapp-campaigns')
  return { ok: true }
}

export type WhatsAppCampaignInput = {
  id?: string | null
  name: string
  message: string
  templateName?: string | null
  service?: string
  databaseId?: string | null
  databaseName?: string | null
  status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived'
  recipientCount?: number
  recipients?: Array<{ id: string; business_name: string; whatsapp_number: string; contact_name?: string | null }>
  scheduledAt?: string | null
}

export async function saveWhatsAppCampaign(input: WhatsAppCampaignInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, error: 'Campaign name is required.' }
  if (!input.message.trim()) return { ok: false, error: 'WhatsApp message body cannot be empty.' }

  const supabase = await createClient()
  const userId = await currentUserId()

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    message: input.message.trim(),
    template_name: input.templateName || null,
    service: input.service || 'General',
    database_id: input.databaseId || null,
    database_name: input.databaseName || null,
    status: input.status || 'draft',
    recipient_count: input.recipientCount ?? (input.recipients ? input.recipients.length : 0),
    recipients: JSON.stringify(input.recipients || []),
    scheduled_at: input.scheduledAt || null,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase.from('whatsapp_campaigns').update(payload).eq('id', input.id)
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/whatsapp-campaigns')
    return { ok: true, data: { id: input.id } }
  } else {
    payload.created_by = userId
    const { data, error } = await supabase.from('whatsapp_campaigns').insert(payload).select('id').single()
    if (error) return { ok: false, error: friendly(error.message) }
    revalidatePath('/dashboard/whatsapp-campaigns')
    return { ok: true, data: { id: data.id } }
  }
}

export async function deleteWhatsAppCampaign(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('whatsapp_campaigns').delete().eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/whatsapp-campaigns')
  return { ok: true }
}

export async function sendTestWhatsAppCampaign({
  to,
  message,
  templateName,
}: {
  to: string
  message: string
  templateName?: string | null
}): Promise<ActionResult> {
  if (!to || to.replace(/\D/g, '').length < 7) {
    return { ok: false, error: 'Enter a valid phone number with country code (e.g. +44 7123 456789 or +91 98765 43210).' }
  }
  try {
    const { isWhatsAppConfigured, sendWhatsAppMessage } = await import('@/lib/whatsapp')
    if (!isWhatsAppConfigured()) {
      return {
        ok: false,
        error: 'WhatsApp is not configured. Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env.local.',
      }
    }
    const res = await sendWhatsAppMessage({
      to,
      body: `[TEST CAMPAIGN]\n${message}`,
      templateName: templateName || null,
    })
    if (!res.success) {
      return { ok: false, error: res.error || 'WhatsApp message send failed.' }
    }
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send test WhatsApp message.'
    return { ok: false, error: msg }
  }
}

export async function launchWhatsAppCampaign(id: string): Promise<ActionResult<LaunchResult>> {
  return enqueueCampaign('whatsapp', id, '/dashboard/whatsapp-campaigns')
}

// ---------- Account ----------
export async function signOut() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('refreshToken')?.value || cookieStore.get('selfera_refresh_token')?.value
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
      const service = createServiceClient()
      await service
        .schema('shared')
        .from('refresh_tokens')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'user_logout',
        })
        .eq('token_hash', tokenHash)

      cookieStore.delete('refreshToken')
      cookieStore.delete('selfera_refresh_token')
    }
    cookieStore.delete('accessToken')
  } catch (err) {
    console.warn('[signOut] Failed to revoke session token:', err)
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---------- CSV Import & Missing Data Queues ----------
export async function createImportBatch(fileName: string): Promise<ActionResult<string>> {
  return rpc<string>('create_import_batch', { p_file_name: fileName })
}

export async function listImportBatches(): Promise<ActionResult<{
  id: string
  file_name: string
  uploaded_by: string
  uploader_name: string
  created_at: string
  total_rows: number
  ready_count: number
  missing_count: number
  failed_count: number
}[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_import_batches')
  if (error) return { ok: false, error: friendly(error.message) }
  return { ok: true, data: data ?? [] }
}

export async function getMissingCounts(
  type?: string | null,
  problem?: string | null,
  batchId?: string | null
): Promise<ActionResult<{
  types: { business_type: string; count: number }[]
  problems: { problem: string; label: string; count: number }[]
  total: number
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('missing_counts', {
    p_type: type || null,
    p_problem: problem || null,
    p_batch: batchId || null,
  })
  if (error) return { ok: false, error: friendly(error.message) }
  return { ok: true, data }
}

export async function getMissingList(
  type?: string | null,
  problem?: string | null,
  batchId?: string | null,
  limit: number = 50,
  offset: number = 0
): Promise<ActionResult<{
  rows: any[]
  total: number
}>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('missing_list', {
    p_type: type || null,
    p_problem: problem || null,
    p_batch: batchId || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) return { ok: false, error: friendly(error.message) }
  const rows = data ?? []
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0
  return { ok: true, data: { rows, total } }
}

export async function updateLeadField(
  businessId: string,
  field: string,
  value: string
): Promise<ActionResult<{ ok: boolean; business_id: string; problems: string[]; ready: boolean }>> {
  return rpc<{ ok: boolean; business_id: string; problems: string[]; ready: boolean }>('update_lead_field', {
    p_business_id: businessId,
    p_field: field,
    p_value: value,
  })
}

export async function updateLeadAddressAndPostcode(
  businessId: string,
  address: string,
  postcode: string
): Promise<ActionResult<{ ok: boolean; business_id: string; problems: string[]; ready: boolean }>> {
  const [res1, res2] = await Promise.all([
    rpc<{ ok: boolean; business_id: string; problems: string[]; ready: boolean }>('update_lead_field', {
      p_business_id: businessId,
      p_field: 'address',
      p_value: address,
    }),
    rpc<{ ok: boolean; business_id: string; problems: string[]; ready: boolean }>('update_lead_field', {
      p_business_id: businessId,
      p_field: 'postcode',
      p_value: postcode,
    }),
  ])
  if (res2.ok) {
    return res2
  }
  return res1
}

export async function bulkSetField(
  businessIds: string[],
  field: string,
  value: string
): Promise<ActionResult<number>> {
  if (!businessIds.length) return { ok: false, error: 'Select at least one lead.' }
  const res = await rpc<number>('bulk_set_field', {
    p_business_ids: businessIds,
    p_field: field,
    p_value: value,
  })
  if (res.ok) {
    revalidatePath('/dashboard/leads')
  }
  return res
}

export async function deleteLeads(businessIds: string[]): Promise<ActionResult<number>> {
  if (!businessIds.length) return { ok: false, error: 'Select at least one lead.' }
  const res = await rpc<number>('delete_leads', {
    p_business_ids: businessIds,
  })
  if (res.ok) {
    revalidatePath('/dashboard/leads')
  }
  return res
}
