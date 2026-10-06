'use server'

// Every change made from the dashboard goes through here. Business rules and
// access checks live in the database functions; these only call them and
// turn database errors into short messages.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isDualWriteEnabled, replicateRpcToSecondary } from '@/lib/dual-write'
import { parseAndValidatePhone } from '@/lib/contact'

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
// Used for "Mark as sent" (manual send) and "Mark as done" (phone / walk-in)
export async function markSent(threadId: string, body: string, subject?: string | null, templateId?: string | null) {
  if (!body.trim()) return { ok: false, error: 'Write the message (or call notes) first.' } as ActionResult
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
  'phone', 'whatsapp_number', 'email', 'instagram', 'facebook', 'existing_website', 'company_type', 'contact_name', 'notes',
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
  if ('business_name' in clean && !clean.business_name) return { ok: false, error: 'Business name is required.' } as ActionResult
  if (typeof clean.instagram === 'string') clean.instagram = (clean.instagram as string).replace(/^.*instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '') || null
  if (typeof clean.email === 'string') clean.email = (clean.email as string).toLowerCase()
  if (typeof clean.room_count === 'string') clean.room_count = parseInt(clean.room_count as string) || null

  if (typeof clean.phone === 'string' && clean.phone) {
    const pCheck = parseAndValidatePhone(clean.phone as string)
    if (!pCheck.valid) return { ok: false, error: pCheck.error || 'Phone must include country code (e.g. +44, 44, or 0...)' } as ActionResult
    clean.phone = pCheck.normalized
  }
  if (typeof clean.whatsapp_number === 'string' && clean.whatsapp_number) {
    const waCheck = parseAndValidatePhone(clean.whatsapp_number as string)
    if (!waCheck.valid) return { ok: false, error: waCheck.error ? `WhatsApp: ${waCheck.error}` : 'WhatsApp must include country code (e.g. +44, 44, or 0...)' } as ActionResult
    clean.whatsapp_number = waCheck.normalized
  }

  const { error, count } = await supabase.from('businesses').update(clean, { count: 'exact' }).eq('id', businessId)
  if (error) {
    if (/duplicate key/i.test(error.message)) return { ok: false, error: 'Another business already uses this phone or email.' } as ActionResult
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
// ---------- Templates (admin only, checked in the database) ----------
export async function saveTemplate(t: { id?: string | null; step: string; service: string; platform: string; subject: string; body: string }) {
  return rpc<string>('save_template', { p_id: t.id || null, p_step: t.step, p_service: t.service, p_platform: t.platform, p_subject: t.subject, p_body: t.body })
}
export async function setTemplateActive(id: string, active: boolean) {
  return rpc('set_template_active', { p_id: id, p_active: active })
}

// ---------- Settings ----------
export async function setMyName(fullName: string) {
  return rpc('set_my_name', { p_full_name: fullName })
}

export async function setCadence(stepName: string, days: number) {
  return rpc('set_cadence', { p_step_name: stepName, p_days: days })
}

// Admin only (checked in the database). Blocking log-in needs the service key.
export async function updateMember(m: { id: string; fullName: string; role: string; capacity: number | null; active: boolean }): Promise<ActionResult> {
  const res = await rpc('update_member', { p_id: m.id, p_full_name: m.fullName, p_role: m.role, p_capacity: m.capacity, p_active: m.active })
  if (!res.ok) return res
  try {
    const { error } = await createServiceClient().auth.admin.updateUserById(m.id, { ban_duration: m.active ? 'none' : '876000h' })
    if (error) return { ok: false, error: `Saved, but log-in could not be ${m.active ? 'restored' : 'blocked'}: ${error.message}` }
  } catch {
    return { ok: false, error: 'Saved, but log-in could not be changed. Add SUPABASE_SERVICE_ROLE_KEY to the server settings.' }
  }
  return { ok: true }
}

export async function inviteMember(m: { email: string; fullName: string; role: string }): Promise<ActionResult> {
  const email = m.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (m.fullName.trim().length < 2) return { ok: false, error: 'Enter their name.' }
  if (!['sales', 'consultant', 'admin'].includes(m.role)) return { ok: false, error: 'Pick a role.' }

  // Only admins may invite
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_user_role')
  if (role !== 'admin') return { ok: false, error: 'You do not have permission to do this.' }

  let service
  try { service = createServiceClient() } catch { return { ok: false, error: 'Add SUPABASE_SERVICE_ROLE_KEY to the server settings to send invites.' } }

  const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: m.fullName.trim() },
    redirectTo: `${origin}/auth/set-password`,
  })
  if (error) {
    if (/already been registered|exists/i.test(error.message)) return { ok: false, error: 'This email already has an account.' }
    if (/rate limit/i.test(error.message)) return { ok: false, error: 'Too many invite emails sent. Wait an hour, or set up your own email service in Supabase.' }
    return { ok: false, error: friendly(error.message) }
  }
  // The new profile is created as sales; set the chosen role and name
  return rpc('update_member', { p_id: data.user!.id, p_full_name: m.fullName, p_role: m.role, p_capacity: null, p_active: true })
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_user_role')
  if (role !== 'admin') return { ok: false, error: 'You do not have permission to do this.' }
  
  let service
  try { service = createServiceClient() } catch { return { ok: false, error: 'Add SUPABASE_SERVICE_ROLE_KEY to the server settings to delete users.' } }

  const { error } = await service.auth.admin.deleteUser(id)
  if (error) return { ok: false, error: friendly(error.message) }
  
  // The trigger or cascade should delete the profile, but just in case:
  await service.from('profiles').delete().eq('id', id)
  
  revalidatePath('/dashboard/settings')
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
  return { ok: true } as ActionResult
}

// ---------- Account ----------
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
