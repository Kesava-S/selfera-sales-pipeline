'use server'

// Client Audience: the customers of our client businesses.
// Writes only to customer_leads and customer_import_batches; businesses is read, never changed.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/app/dashboard/actions'
import { cleanCustomer, type CleanCustomer, type Country, type CustomerInput, COUNTRIES } from '@/lib/customerLeads'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function staff(): Promise<{ supabase: Supabase; userId: string } | { error: string }> {
  const supabase = await createClient()
  const [{ data: { user } }, { data: role }] = await Promise.all([supabase.auth.getUser(), supabase.rpc('get_user_role')])
  if (!user) return { error: 'Your session has expired. Please log in again.' }
  if (role !== 'admin' && role !== 'sales') return { error: 'You do not have permission to do this.' }
  return { supabase, userId: user.id }
}

function friendly(message: string): string {
  if (/uq_customer_leads_email/.test(message)) return 'A customer with this email is already saved for this business.'
  if (/uq_customer_leads_phone/.test(message)) return 'A customer with this phone number is already saved for this business.'
  if (/customer_leads_has_identity/.test(message)) return 'Add a name, an email or a phone number.'
  if (/permission denied|row-level security/i.test(message)) return 'You do not have permission to do this.'
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) return 'Could not reach the database. Check your connection and try again.'
  return message.replace(/^.*?ERROR:\s*/i, '')
}

const done = (businessId: string) => {
  revalidatePath('/dashboard/audience')
  revalidatePath(`/dashboard/audience/${businessId}`)
}

const validCountry = (c: unknown): Country => (COUNTRIES.includes(c as Country) ? (c as Country) : 'UK')

// ---------- One customer (form) ----------

export async function saveCustomerLead(
  businessId: string,
  id: string | null,
  input: CustomerInput,
  opts: { country: Country; consent: boolean },
): Promise<ActionResult<{ id: string; problems: string[] }>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { row, problems } = cleanCustomer(input, validCountry(opts.country))
  if (!row) return { ok: false, error: 'Add a name, an email or a phone number.' }

  const consent = opts.consent
    ? { consent_confirmed: true, consent_confirmed_by: s.userId, consent_confirmed_at: new Date().toISOString() }
    : { consent_confirmed: false, consent_confirmed_by: null, consent_confirmed_at: null }

  if (id) {
    // Keep who confirmed consent first, if it was already confirmed
    const { data: before } = await s.supabase.from('customer_leads').select('consent_confirmed').eq('id', id).eq('business_id', businessId).maybeSingle()
    if (!before) return { ok: false, error: 'This customer was not found. It may have been deleted.' }
    const { error } = await s.supabase
      .from('customer_leads')
      .update({ ...row, ...(before.consent_confirmed && opts.consent ? {} : consent) })
      .eq('id', id).eq('business_id', businessId)
    if (error) return { ok: false, error: friendly(error.message) }
    done(businessId)
    return { ok: true, data: { id, problems } }
  }

  const { data, error } = await s.supabase
    .from('customer_leads')
    .insert({ ...row, ...consent, business_id: businessId, source: 'form' })
    .select('id').single()
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true, data: { id: data.id, problems } }
}

export async function deleteCustomerLeads(businessId: string, ids: string[]): Promise<ActionResult<number>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  if (!ids.length) return { ok: true, data: 0 }
  const { error, count } = await s.supabase.from('customer_leads').delete({ count: 'exact' }).eq('business_id', businessId).in('id', ids)
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true, data: count ?? 0 }
}

export async function setCustomerDoNotContact(businessId: string, ids: string[], on: boolean, reason?: string): Promise<ActionResult<number>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  if (!ids.length) return { ok: true, data: 0 }
  const { error, count } = await s.supabase
    .from('customer_leads')
    .update(on
      ? { do_not_contact: true, do_not_contact_reason: reason?.trim() || 'Marked by our team', do_not_contact_at: new Date().toISOString() }
      : { do_not_contact: false, do_not_contact_reason: null, do_not_contact_at: null }, { count: 'exact' })
    .eq('business_id', businessId).in('id', ids)
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true, data: count ?? 0 }
}

// ---------- CSV import ----------

export type ImportChunkResult = { batchId: string; created: number; updated: number; skipped: number; failed: { row: number; message: string }[] }

// Called once per chunk of rows; the first call creates the import record.
export async function importCustomerLeads(
  businessId: string,
  rows: { row: number; input: CustomerInput }[],
  opts: { country: Country; consent: boolean; duplicates: 'skip' | 'update'; fileName: string; batchId: string | null },
): Promise<ActionResult<ImportChunkResult>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  if (!opts.consent) return { ok: false, error: 'Confirm the client says these customers agreed to marketing.' }
  if (rows.length > 1000) return { ok: false, error: 'Too many rows in one go.' }
  const country = validCountry(opts.country)
  const supabase = s.supabase

  let batchId = opts.batchId
  if (!batchId) {
    const { data: b } = await supabase.from('businesses').select('id').eq('id', businessId).maybeSingle()
    if (!b) return { ok: false, error: 'This business was not found.' }
    const { data, error } = await supabase.from('customer_import_batches').insert({ business_id: businessId, file_name: opts.fileName.slice(0, 200) }).select('id').single()
    if (error) return { ok: false, error: friendly(error.message) }
    batchId = data.id as string
  }

  const failed: ImportChunkResult['failed'] = []
  let skipped = 0
  const clean: { row: number; data: CleanCustomer }[] = []
  for (const r of rows) {
    const { row } = cleanCustomer(r.input, country)
    if (row) clean.push({ row: r.row, data: row })
    else skipped++
  }

  // Already saved for this business? (matched by email or phone)
  const emails = [...new Set(clean.map(c => c.data.email).filter(Boolean))] as string[]
  const phones = [...new Set(clean.flatMap(c => [c.data.phone_e164]).filter(Boolean))] as string[]
  const existing: { id: string; email: string | null; phone_e164: string | null; tags: string[] }[] = []
  for (let i = 0; i < Math.max(emails.length, phones.length); i += 150) {
    const e = emails.slice(i, i + 150)
    const p = phones.slice(i, i + 150)
    const [a, b] = await Promise.all([
      e.length ? supabase.from('customer_leads').select('id, email, phone_e164, tags').eq('business_id', businessId).in('email', e) : Promise.resolve({ data: [] }),
      p.length ? supabase.from('customer_leads').select('id, email, phone_e164, tags').eq('business_id', businessId).in('phone_e164', p) : Promise.resolve({ data: [] }),
    ])
    existing.push(...(a.data || []), ...(b.data || []))
  }
  const byEmail = new Map(existing.filter(x => x.email).map(x => [x.email as string, x]))
  const byPhone = new Map(existing.filter(x => x.phone_e164).map(x => [x.phone_e164 as string, x]))

  const consent = { consent_confirmed: true, consent_confirmed_by: s.userId, consent_confirmed_at: new Date().toISOString() }
  const inserts: Record<string, unknown>[] = []
  const insertRows: number[] = []
  const seenEmail = new Set<string>()
  const seenPhone = new Set<string>()
  let updated = 0

  for (const { row, data } of clean) {
    const match = (data.email && byEmail.get(data.email)) || (data.phone_e164 && byPhone.get(data.phone_e164))
    if (match) {
      if (opts.duplicates === 'skip') { skipped++; continue }
      // Update: new values win, blanks keep what is saved, tags are added
      const patch: Record<string, unknown> = { ...consent }
      for (const [k, v] of Object.entries(data)) {
        if (k === 'tags') patch.tags = [...new Set([...(match.tags || []), ...data.tags])]
        else if (k === 'whatsapp_status') { if (data.phone || data.phone2) patch[k] = v }
        else if (v !== null && v !== '') patch[k] = v
      }
      const { error } = await supabase.from('customer_leads').update(patch).eq('id', match.id)
      if (error) failed.push({ row, message: friendly(error.message) })
      else updated++
      continue
    }
    // The same customer twice in this file: keep the first
    if ((data.email && seenEmail.has(data.email)) || (data.phone_e164 && seenPhone.has(data.phone_e164))) { skipped++; continue }
    if (data.email) seenEmail.add(data.email)
    if (data.phone_e164) seenPhone.add(data.phone_e164)
    inserts.push({ ...data, ...consent, business_id: businessId, source: 'csv', import_batch_id: batchId })
    insertRows.push(row)
  }

  let created = 0
  if (inserts.length) {
    const { error, count } = await supabase.from('customer_leads').insert(inserts, { count: 'exact' })
    if (!error) created = count ?? inserts.length
    else {
      // One bad row fails the batch; retry one by one so the rest still go in
      for (let i = 0; i < inserts.length; i++) {
        const { error: e } = await supabase.from('customer_leads').insert(inserts[i])
        if (e) failed.push({ row: insertRows[i], message: friendly(e.message) })
        else created++
      }
    }
  }

  const { data: b } = await supabase.from('customer_import_batches').select('created_count, updated_count, skipped_count').eq('id', batchId).maybeSingle()
  if (b) {
    await supabase.from('customer_import_batches').update({
      created_count: b.created_count + created,
      updated_count: b.updated_count + updated,
      skipped_count: b.skipped_count + skipped + failed.length,
    }).eq('id', batchId)
  }

  done(businessId)
  return { ok: true, data: { batchId, created, updated, skipped, failed } }
}

// ---------- Picking a client (read-only search of Lead Management businesses) ----------

export type BusinessPick = { id: string; business_name: string; contact_name: string | null; business_type: string | null; area: string | null }

export async function findBusinesses(query: string): Promise<ActionResult<BusinessPick[]>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const q = query.trim().replace(/[%_,()\\]/g, ' ').trim()
  let req = s.supabase.from('businesses').select('id, business_name, contact_name, business_type, area').eq('archived', false)
  if (q) req = req.or(`business_name.ilike.%${q}%,contact_name.ilike.%${q}%`)
  const { data, error } = await req.order('business_name').limit(20)
  if (error) return { ok: false, error: friendly(error.message) }
  return { ok: true, data: (data || []) as BusinessPick[] }
}

// ---------- Client settings: data-processing agreement and sender ----------

export async function saveAudienceClient(
  businessId: string,
  input: { dpaSignedOn: string | null; senderName: string; replyTo: string },
): Promise<ActionResult> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { error } = await s.supabase.rpc('set_audience_client', {
    p_business_id: businessId, p_dpa_signed_on: input.dpaSignedOn || null, p_sender_name: input.senderName, p_reply_to: input.replyTo,
  })
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true }
}

// ---------- Campaigns ----------

export type AudienceFilter = {
  tags?: string[]
  birthday_months?: number[]
  country?: string
  visited_within_days?: number | null
  not_visited_days?: number | null
  mobile_only?: boolean
}
export type AudiencePreview = { send: number; skipped: Record<string, number> }

export async function previewAudience(businessId: string, channel: 'email' | 'whatsapp', filter: AudienceFilter): Promise<ActionResult<AudiencePreview>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { data, error } = await s.supabase.rpc('audience_preview', { p_business_id: businessId, p_channel: channel, p_filter: filter })
  if (error) return { ok: false, error: friendly(error.message) }
  return { ok: true, data: data as AudiencePreview }
}

export type AudienceCampaignInput = {
  channel: 'email' | 'whatsapp'
  name: string
  subject?: string
  body?: string
  message?: string
  templateName?: string
  filter: AudienceFilter
}

// Creates the campaign and queues it straight away; the normal send queue sends it
export async function launchAudienceCampaign(businessId: string, input: AudienceCampaignInput): Promise<ActionResult<{ id: string; queued: number; skipped: number }>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give the campaign a name.' }
  const email = input.channel === 'email'
  if (email && (!input.subject?.trim() || !input.body?.trim())) return { ok: false, error: 'Add a subject and a message.' }
  if (!email && !input.message?.trim()) return { ok: false, error: 'Add the message.' }

  const table = email ? 'email_campaigns' : 'whatsapp_campaigns'
  const row = email
    ? { name, subject: input.subject!.trim(), body: input.body!.trim(), service: 'Client Audience' }
    : { name, message: input.message!.trim(), template_name: input.templateName?.trim() || null, service: 'Client Audience' }
  const { data: created, error } = await s.supabase
    .from(table)
    .insert({ ...row, status: 'draft', recipients: [], audience_business_id: businessId, audience_filter: input.filter, created_by: s.userId })
    .select('id').single()
  if (error) return { ok: false, error: friendly(error.message) }

  const { data, error: launchError } = await s.supabase.rpc('enqueue_audience_campaign', { p_channel: input.channel, p_campaign_id: created.id })
  if (launchError) {
    await s.supabase.from(table).delete().eq('id', created.id)
    return { ok: false, error: friendly(launchError.message) }
  }
  done(businessId)
  const r = data as { queued: number; skipped: number }
  return { ok: true, data: { id: created.id, queued: r.queued, skipped: r.skipped } }
}

// ---------- Audience data: approve / undo imports, delete everything ----------

export async function approveCustomerImport(businessId: string, batchId: string): Promise<ActionResult> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { error } = await s.supabase.rpc('approve_customer_import', { p_batch_id: batchId })
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true }
}

export async function undoCustomerImport(businessId: string, batchId: string): Promise<ActionResult<number>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { data, error } = await s.supabase.rpc('undo_customer_import', { p_batch_id: batchId })
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true, data: data as number }
}

export async function deleteAudience(businessId: string, confirmName: string): Promise<ActionResult<number>> {
  const s = await staff()
  if ('error' in s) return { ok: false, error: s.error }
  const { data, error } = await s.supabase.rpc('delete_audience', { p_business_id: businessId, p_confirm_name: confirmName })
  if (error) return { ok: false, error: friendly(error.message) }
  done(businessId)
  return { ok: true, data: data as number }
}
