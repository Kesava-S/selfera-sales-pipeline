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
import { applyPhoneDefaults } from '@/lib/dynamicData'
import { emailSendBlocked } from '@/lib/emailBlock'
import { INVITE_ROLES, type InviteRole, type Role } from '@/lib/config'

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
  'email_status', 'email_reason', 'email_suggestion', 'email_role', 'email_checked_at',
] as const

export async function updateBusiness(businessId: string, fields: Record<string, string | number | boolean | null>) {
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
    await applyPhoneDefaults()
    const waCheck = parseAndValidatePhone(clean.whatsapp_number as string)
    if (!waCheck.valid) return { ok: false, error: `WhatsApp: ${waCheck.error}` } as ActionResult
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

// ---------- Off-target leads (marked by hand; the stage is not changed) ----------
export async function markOffTarget(businessIds: string[], reason: string, noticed: string, note?: string): Promise<ActionResult<number>> {
  const ids = Array.from(new Set(businessIds)).filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Select at least one lead.' }
  return rpc<number>('mark_off_target', { p_business_ids: ids, p_reason: reason, p_noticed: noticed, p_note: note?.trim() || null })
}

export async function clearOffTarget(businessIds: string[]): Promise<ActionResult<number>> {
  const ids = Array.from(new Set(businessIds)).filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Select at least one lead.' }
  return rpc<number>('clear_off_target', { p_business_ids: ids })
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
  whatsapp_template_name?: string | null
}): Promise<ActionResult<string>> {
  const supabase = createServiceClient()
  const businessTypes = t.businessType && t.businessType !== 'General' ? [t.businessType] : []
  const name = `${t.businessType || 'General'} · ${t.platform === 'All' ? 'All platforms' : t.platform} · ${t.step}`
  const subject = (t.platform === 'Email' || t.platform === 'All') ? (t.subject.trim() || null) : null
  const whatsappTemplateName = t.platform === 'WhatsApp' ? (t.whatsapp_template_name?.trim() || null) : null

  if (t.id) {
    const { error } = await supabase
      .from('templates')
      .update({
        subject,
        body: t.body,
        name,
        business_types: businessTypes,
        whatsapp_template_name: whatsappTemplateName,
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
      whatsapp_template_name: whatsappTemplateName,
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

export async function revertTemplate(id: string): Promise<ActionResult> {
  const supabase = createServiceClient()
  // Safety guard: ensure it is a customized category template and not a General baseline template
  const { data: t, error: fetchErr } = await supabase
    .from('templates')
    .select('id, business_types')
    .eq('id', id)
    .single()

  if (fetchErr || !t) return { ok: false, error: 'Template not found.' }
  if (!t.business_types || t.business_types.length === 0) {
    return { ok: false, error: 'Cannot delete baseline General template.' }
  }

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/templates')
  return { ok: true }
}

export async function createBusinessCategory(data: {
  name: string
  description?: string
  icon_name?: string
}): Promise<ActionResult<string>> {
  const supabase = createServiceClient()
  const name = data.name.trim()
  if (!name) return { ok: false, error: 'Category name is required.' }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const { data: inserted, error } = await supabase
    .from('business_categories')
    .insert({
      name,
      slug,
      description: data.description?.trim() || null,
      icon_name: data.icon_name?.trim() || 'Building2',
      synonyms: [name.toLowerCase()],
      is_active: true,
      sort_order: 10,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'A category with this name or slug already exists.' }
    }
    return { ok: false, error: friendly(error.message) }
  }

  revalidatePath('/dashboard/templates')
  return { ok: true, data: inserted?.id }
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
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('id', id)
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath('/dashboard/notifications')
  return { ok: true }
}

export async function markNotificationsRead(ids: string[] | 'all') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' } as ActionResult
  let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
  if (ids !== 'all') q = q.in('id', ids)
  const { error } = await q
  if (error) return { ok: false, error: friendly(error.message) } as ActionResult
  revalidatePath('/dashboard/notifications')
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
    if (!(await isSmtpConfigured())) {
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
  await applyPhoneDefaults()
  const toCheck = parseAndValidatePhone(to)
  if (!to || !toCheck.valid || !toCheck.normalized) {
    return { ok: false, error: toCheck.valid ? 'Enter a phone number.' : toCheck.error }
  }
  try {
    const { isWhatsAppConfigured, sendWhatsAppMessage } = await import('@/lib/whatsapp')
    if (!(await isWhatsAppConfigured())) {
      return {
        ok: false,
        error: 'WhatsApp is not configured. Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env.local.',
      }
    }
    let finalTemplate = templateName || null
    if (!finalTemplate) {
      try {
        const { getWhatsAppConfig } = await import('@/lib/integrations')
        const cfg = await getWhatsAppConfig()
        finalTemplate = cfg.default_template_name || process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'selfera_sales_pipeline_general'
      } catch {
        finalTemplate = process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'selfera_sales_pipeline_general'
      }
    }

    const res = await sendWhatsAppMessage({
      to,
      body: `[TEST CAMPAIGN]\n${message}`,
      templateName: finalTemplate,
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

// Delete leads and everything connected to them (admin only). Opt-outs are kept.
export type DeletedLeadsSummary = {
  deleted: number; pitches: number; messages: number; campaign_recipients: number; campaign_replies: number
  bookings: number; contact_lists: number; audience_customers: number
}
export async function deleteLeadsEverywhere(businessIds: string[]): Promise<ActionResult<DeletedLeadsSummary>> {
  const ids = Array.from(new Set(businessIds)).filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Select at least one lead.' }
  const res = await rpc<DeletedLeadsSummary>('delete_leads_everywhere', { p_business_ids: ids })
  if (res.ok) {
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/dashboard/audience')
    revalidatePath('/dashboard/campaigns')
    revalidatePath('/dashboard/whatsapp-campaigns')
  }
  return res
}

// ---------- Team Member & Invite Management ----------
async function getAppBaseUrl(): Promise<string> {
  try {
    const { headers } = await import('next/headers')
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') || headerList.get('host')
    const proto = headerList.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    if (host) {
      return `${proto}://${host}`
    }
    const origin = headerList.get('origin')
    if (origin) return origin.replace(/\/$/, '')
  } catch {
    // fallback if headers() not available in context
  }
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sales.selfera.co.uk'
  return envUrl.replace(/\/$/, '')
}

export async function inviteTeamMember(input: {
  fullName: string
  email: string
  role: InviteRole
}): Promise<ActionResult<{ id: string; actionLink?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  const { data: myProfile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can invite team members.' }
  }

  const fullName = input.fullName?.trim()
  const email = input.email?.trim().toLowerCase()
  const role: InviteRole = input.role || 'sales'
  // Administrators are not invited from here
  if (!INVITE_ROLES.includes(role)) return { ok: false, error: 'Pick Sales, Consultant or Sales + Consultant.' }

  if (!fullName) return { ok: false, error: 'Please enter a full name.' }
  if (!email || !email.includes('@')) return { ok: false, error: 'Please enter a valid work email.' }

  const siteUrl = await getAppBaseUrl()
  const redirectTo = `${siteUrl}/auth/set-password`

  const service = createServiceClient()

  // 1. Generate the invite link (creates user in auth.users + provides action_link & hashed_token)
  let linkType: 'invite' | 'recovery' = 'invite'
  let { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo,
      data: { full_name: fullName, role, password_set: false },
    },
  })

  // If already registered in auth.users (e.g. from an uncompleted invite), check if active or pending:
  if (linkErr && (linkErr.message.includes('already been registered') || linkErr.message.includes('already registered'))) {
    const recResult = await service.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
    if (!recResult.error && recResult.data?.user) {
      const { data: existingProf } = await service
        .from('profiles')
        .select('is_active')
        .eq('id', recResult.data.user.id)
        .maybeSingle()

      if (existingProf?.is_active) {
        return { ok: false, error: 'A team member with this email address is already active.' }
      }

      linkType = 'recovery'
      linkData = recResult.data
      linkErr = null
    } else {
      return { ok: false, error: friendly(linkErr.message) }
    }
  }

  if (linkErr || !linkData) {
    return { ok: false, error: friendly(linkErr?.message || 'Failed to create invitation.') }
  }

  const invitedUser = linkData?.user
  const hashedToken = linkData?.properties?.hashed_token
  // Create direct branded activation link (routes directly to our Next.js /auth/confirm handler)
  const directActionLink = hashedToken
    ? `${siteUrl}/auth/confirm?token_hash=${hashedToken}&type=${linkType}&next=/auth/set-password`
    : (linkData?.properties?.action_link || `${siteUrl}/auth/set-password`)

  if (!invitedUser?.id) {
    return { ok: false, error: 'Failed to create invitation.' }
  }

  // 2. Send our customized Selfera invitation email
  if (directActionLink) {
    try {
      const { sendTeamInviteEmail } = await import('@/lib/mailer')
      await sendTeamInviteEmail({
        to: email,
        fullName,
        role,
        actionLink: directActionLink,
        inviterName: myProfile?.full_name || 'Admin',
      })
    } catch (emailErr) {
      console.warn('[inviteTeamMember] custom invite email send warning:', emailErr)
    }
  }

  // 3. Upsert profile into "sales-pipe".profiles with pending status (is_active: false until password is set)
  const { error: profErr } = await service
    .from('profiles')
    .upsert({
      id: invitedUser.id,
      full_name: fullName,
      role,
      is_active: false,
    })

  if (profErr) {
    console.error('[inviteTeamMember] profile upsert error:', profErr)
    return { ok: false, error: friendly(profErr.message) }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true, data: { id: invitedUser.id, actionLink: directActionLink } }
}

export async function completePasswordSetup(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'User session not found. Please click the invitation link again.' }

  const service = createServiceClient()

  // 1. Activate the user in profiles table
  const { error: profErr } = await service
    .from('profiles')
    .update({
      is_active: true,
    })
    .eq('id', user.id)

  if (profErr) {
    console.error('[completePasswordSetup] error activating profile:', profErr)
    return { ok: false, error: friendly(profErr.message) }
  }

  // 2. Mark password_set as true in auth.users user_metadata
  try {
    await service.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        password_set: true,
        password_set_at: new Date().toISOString(),
      },
    })
  } catch (authMetaErr) {
    console.warn('[completePasswordSetup] auth metadata update warning:', authMetaErr)
  }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function resendTeamInvite(email: string): Promise<ActionResult<{ actionLink?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  const { data: myProfile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can manage invites.' }
  }

  const cleanEmail = email.trim().toLowerCase()
  const siteUrl = await getAppBaseUrl()
  const redirectTo = `${siteUrl}/auth/set-password`

  const service = createServiceClient()

  // First try 'invite'. If the user's email was already confirmed or exists,
  // Supabase returns 'A user with this email address has already been registered'.
  // Seamlessly fall back to 'recovery' password setup link.
  let linkType: 'invite' | 'recovery' = 'invite'
  let { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: 'invite',
    email: cleanEmail,
    options: { redirectTo },
  })

  if (linkErr && (linkErr.message.includes('already been registered') || linkErr.message.includes('already registered'))) {
    linkType = 'recovery'
    const recResult = await service.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: { redirectTo },
    })
    linkData = recResult.data
    linkErr = recResult.error
  }

  if (linkErr || !linkData) return { ok: false, error: friendly(linkErr?.message || 'Could not generate invite link.') }

  const hashedToken = linkData?.properties?.hashed_token
  const directActionLink = hashedToken
    ? `${siteUrl}/auth/confirm?token_hash=${hashedToken}&type=${linkType}&next=/auth/set-password`
    : (linkData?.properties?.action_link || `${siteUrl}/auth/set-password`)

  if (directActionLink && linkData?.user) {
    try {
      const { sendTeamInviteEmail } = await import('@/lib/mailer')
      const { data: targetProfile } = await service.from('profiles').select('full_name, role').eq('id', linkData.user.id).maybeSingle()
      await sendTeamInviteEmail({
        to: cleanEmail,
        fullName: targetProfile?.full_name || (linkData.user.user_metadata?.full_name as string) || cleanEmail.split('@')[0],
        role: targetProfile?.role || 'sales',
        actionLink: directActionLink,
        inviterName: myProfile?.full_name || 'Admin',
      })
    } catch (emailErr) {
      console.warn('[resendTeamInvite] custom invite email send warning:', emailErr)
    }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true, data: { actionLink: directActionLink } }
}

export async function revokeTeamInvite(userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  if (user.id === userId) return { ok: false, error: 'You cannot revoke your own account.' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can revoke invites.' }
  }

  const service = createServiceClient()
  await service.from('profiles').delete().eq('id', userId)

  const { error: authErr } = await service.auth.admin.deleteUser(userId)
  if (authErr) return { ok: false, error: friendly(authErr.message) }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function updateTeamMember(
  userId: string,
  patch: { role?: Role; is_active?: boolean }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  if (patch.is_active === false && user.id === userId) {
    return { ok: false, error: 'You cannot deactivate your own account.' }
  }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can update team members.' }
  }

  const service = createServiceClient()

  if (patch.role !== undefined) {
    if (user.id === userId) return { ok: false, error: 'You cannot change your own role.' }
    // Same choices as an invite: administrators are not made from here
    if (!(INVITE_ROLES as readonly string[]).includes(patch.role)) {
      return { ok: false, error: 'Pick Sales, Consultant or Sales + Consultant.' }
    }
    // Admin Panel members get their role from the Admin Panel (it would be overwritten)
    const { data: emp } = await service.schema('hr').from('employees').select('id').eq('auth_user_id', userId).maybeSingle()
    if (emp) return { ok: false, error: 'This member is managed in the Admin Panel. Change their role there.' }
  }

  const { error } = await service.from('profiles').update(patch).eq('id', userId)
  if (error) return { ok: false, error: friendly(error.message) }

  // Keep the invite details in step (pending invites read the role from here)
  if (patch.role) {
    const { data: authUser } = await service.auth.admin.getUserById(userId)
    if (authUser?.user) {
      await service.auth.admin.updateUserById(userId, { user_metadata: { ...authUser.user.user_metadata, role: patch.role } })
        .catch(err => console.warn('[updateTeamMember] metadata update warning:', err))
    }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function deleteTeamMember(userId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  if (user.id === userId) return { ok: false, error: 'You cannot delete your own active account.' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can delete team members.' }
  }

  const service = createServiceClient()

  try {
    // Unassign opportunities to preserve pipeline data and prevent FK constraint violations
    await service.from('opportunities').update({ assigned_sales_id: null }).eq('assigned_sales_id', userId)
    await service.from('opportunities').update({ assigned_consultant_id: null }).eq('assigned_consultant_id', userId)

    // Remove profile from sales-pipe.profiles
    await service.from('profiles').delete().eq('id', userId)

    // Remove user from Supabase Auth
    await service.auth.admin.deleteUser(userId).catch(() => null)

    revalidatePath('/dashboard/settings')
    return { ok: true }
  } catch (err: any) {
    console.error('[deleteTeamMember] Error deleting team member:', err)
    return { ok: false, error: friendly(err?.message || 'Failed to delete team member.') }
  }
}

// ---------- Dynamic Channel Integrations ----------

export async function saveIntegrationAction(
  channelId: string,
  config: Record<string, any>,
  status: 'connected' | 'disconnected' = 'connected'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can update integrations.' }
  }

  const { saveChannelIntegrationDb } = await import('@/lib/integrations')
  const res = await saveChannelIntegrationDb(channelId as any, config, status, user.id)
  if (!res.ok) return { ok: false, error: res.error || 'Failed to save integration.' }

  revalidatePath('/dashboard/integrations')
  return { ok: true }
}

export async function toggleIntegrationAction(
  channelId: string
): Promise<ActionResult<{ status: 'connected' | 'disconnected' }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (myProfile?.role !== 'admin') {
    return { ok: false, error: 'Only administrators can toggle integrations.' }
  }

  const { toggleChannelIntegrationDb } = await import('@/lib/integrations')
  const res = await toggleChannelIntegrationDb(channelId as any, user.id)
  if (!res.ok) return { ok: false, error: res.error || 'Failed to toggle integration.' }

  revalidatePath('/dashboard/integrations')
  return { ok: true, data: { status: res.status! } }
}

export async function testIntegrationAction(
  channelId: string,
  testInput?: string,
  environment: 'realtime' | 'sandbox' = 'realtime'
): Promise<ActionResult<{ latencyMs: number; message: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  const { testChannelIntegration } = await import('@/lib/integrations')
  const res = await testChannelIntegration(channelId as any, testInput, environment)

  if (!res.ok) {
    return {
      ok: false,
      error: res.error || res.message,
    }
  }

  return {
    ok: true,
    data: { latencyMs: res.latencyMs, message: res.message },
  }
}

export async function sendLiveTestChannelAction({
  channelId,
  environment,
  recipient,
  message,
  templateName,
}: {
  channelId: string
  environment: 'realtime' | 'sandbox'
  recipient: string
  message: string
  templateName?: string
}): Promise<ActionResult<{ messageId?: string | null; latencyMs: number; details?: any }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in again.' }

  if (!recipient.trim()) {
    return { ok: false, error: 'Recipient is required.' }
  }

  const start = Date.now()

  if (channelId === 'whatsapp') {
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
    const { getWhatsAppConfig } = await import('@/lib/integrations')
    const cfg = await getWhatsAppConfig()

    const phoneId = environment === 'sandbox' && (cfg as any).sandbox_phone_number_id
      ? (cfg as any).sandbox_phone_number_id
      : cfg.phone_number_id

    const token = environment === 'sandbox' && (cfg as any).sandbox_access_token
      ? (cfg as any).sandbox_access_token
      : cfg.access_token

    const tpl = templateName || cfg.default_template_name || process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'selfera_sales_pipeline_general'
    const bodyText = environment === 'sandbox' ? `[SANDBOX TEST]\n${message}` : message

    try {
      const res = await sendWhatsAppMessage({
        to: recipient,
        body: bodyText,
        templateName: tpl,
        phoneId: phoneId || undefined,
        accessToken: token || undefined,
      })

      const latencyMs = Date.now() - start
      if (!res.success) {
        return { ok: false, error: res.error || 'WhatsApp message test failed.' }
      }
      return { ok: true, data: { messageId: res.messageId, latencyMs } }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to send WhatsApp test message.' }
    }
  }

  if (channelId === 'email') {
    const { sendEmail } = await import('@/lib/mailer')
    try {
      const res = await sendEmail({
        to: recipient,
        subject: `[${environment === 'sandbox' ? 'SANDBOX ' : ''}TEST] Selfera Integration Health Check`,
        body: message,
      })
      const latencyMs = Date.now() - start
      return { ok: true, data: { messageId: res.messageId, latencyMs } }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to send test email.' }
    }
  }

  // Social channels (Instagram, Facebook, LinkedIn) test handshake
  const { testChannelIntegration } = await import('@/lib/integrations')
  const res = await testChannelIntegration(channelId as any, recipient, environment)
  const latencyMs = Date.now() - start
  if (!res.ok) {
    return { ok: false, error: res.error || res.message }
  }
  return { ok: true, data: { latencyMs, details: res.message } }
}

