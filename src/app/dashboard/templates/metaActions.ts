'use server'

// WhatsApp Meta templates, managed from Templates → WhatsApp. Every change goes to
// Meta first; our copy is saved only after Meta accepts it. The Meta account is
// shared with other products, so only templates this product created or added on
// purpose ("managed") are stored, synced, edited or deleted here.

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/app/dashboard/actions'
import { createMetaTemplate, deleteMetaTemplate, editMetaTemplate, listMetaTemplates, MetaApiError } from '@/lib/metaTemplates'
import { checkDraft, toComponents, variablesIn, VAR_KEYS, type MetaTemplate, type TemplateDraft, type VariableMap } from '@/lib/metaTemplateDraft'

async function role(): Promise<{ role: string | null; userId: string | null }> {
  const supabase = await createClient()
  const [{ data: claims }, { data: r }] = await Promise.all([supabase.auth.getClaims(), supabase.rpc('get_user_role')])
  return { role: (r as string | null) ?? null, userId: claims?.claims?.sub ?? null }
}

const failed = (e: unknown): ActionResult<never> => ({
  ok: false,
  error: e instanceof MetaApiError ? `Meta: ${e.message}` : e instanceof Error ? e.message : 'Something went wrong.',
})

const done = () => revalidatePath('/dashboard/templates', 'layout')

const rowFrom = (t: MetaTemplate, now: string) => ({
  meta_id: t.id, name: t.name, language: t.language, category: t.category, status: t.status,
  components: t.components ?? [], rejected_reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
  quality_score: t.quality_score?.score ?? null, last_synced_at: now,
})

// Keep only known keys, one per body variable
function cleanMap(map: VariableMap | null | undefined, count: number): VariableMap {
  const ok = (k: unknown) => (VAR_KEYS as readonly string[]).includes(String(k))
  const body = Array.from({ length: count }, (_, i) => (ok(map?.body?.[i]) ? map!.body[i] : 'message'))
  return { body, header: ok(map?.header) ? map!.header : null }
}
const bodyCount = (components: { type: string; text?: string }[]) =>
  variablesIn(components.find(c => c.type === 'BODY')?.text ?? '').length

// Refresh our templates' content and review status from Meta (other products' are ignored)
export async function syncMetaTemplates(): Promise<ActionResult<{ count: number; missing: number }>> {
  const me = await role()
  if (me.role !== 'admin' && me.role !== 'sales') return { ok: false, error: 'You do not have permission to do this.' }
  try {
    const db = createServiceClient()
    const [remote, { data: ours }] = await Promise.all([
      listMetaTemplates(),
      db.from('meta_templates').select('id, name, language, meta_id').eq('managed', true),
    ])
    const now = new Date().toISOString()
    let count = 0
    let missing = 0
    for (const row of ours || []) {
      const t = remote.find(r => r.id === row.meta_id) ?? remote.find(r => r.name === row.name && r.language === row.language)
      if (!t) {
        // Deleted in Meta's own dashboard: kept so links show it, but it can't send
        await db.from('meta_templates').update({ status: 'DELETED', last_synced_at: now }).eq('id', row.id)
        missing++
        continue
      }
      const { error } = await db.from('meta_templates').update(rowFrom(t, now)).eq('id', row.id)
      if (error) return { ok: false, error: error.message }
      count++
    }
    done()
    return { ok: true, data: { count, missing } }
  } catch (e) {
    return failed(e)
  }
}

// Templates in the Meta account that aren't ours yet, to add one on purpose
export async function listAddableMetaTemplates(): Promise<ActionResult<{ id: string; name: string; language: string; status: string; category: string; body: string }[]>> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can add templates.' }
  try {
    const [remote, { data: ours }] = await Promise.all([
      listMetaTemplates(),
      createServiceClient().from('meta_templates').select('meta_id').eq('managed', true),
    ])
    const have = new Set((ours || []).map(o => o.meta_id))
    return {
      ok: true,
      data: remote.filter(t => !have.has(t.id)).map(t => ({
        id: t.id, name: t.name, language: t.language, status: t.status, category: t.category,
        body: (t.components?.find(c => c.type === 'BODY') as { text?: string } | undefined)?.text ?? '',
      })),
    }
  } catch (e) {
    return failed(e)
  }
}

export async function addMetaTemplate(metaId: string): Promise<ActionResult<{ name: string }>> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can add templates.' }
  try {
    const t = (await listMetaTemplates()).find(r => r.id === metaId)
    if (!t) return { ok: false, error: 'This template is no longer in your Meta account.' }
    const { error } = await createServiceClient().from('meta_templates').upsert({
      ...rowFrom(t, new Date().toISOString()), managed: true, created_by: me.userId,
      variable_map: cleanMap(null, bodyCount(t.components ?? [])),
    }, { onConflict: 'meta_id' })
    if (error) return { ok: false, error: error.message }
    done()
    return { ok: true, data: { name: t.name } }
  } catch (e) {
    return failed(e)
  }
}

export async function submitMetaTemplate(draft: TemplateDraft, map?: VariableMap): Promise<ActionResult<{ id: string; name: string; status: string }>> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can submit templates to Meta.' }
  const problems = checkDraft(draft)
  if (problems.length) return { ok: false, error: problems[0] }
  try {
    const components = toComponents(draft)
    const res = await createMetaTemplate({ name: draft.name, language: draft.language, category: draft.category, components })
    const { data, error } = await createServiceClient().from('meta_templates').upsert({
      meta_id: res.id, name: draft.name, language: draft.language, category: res.category || draft.category,
      status: res.status || 'PENDING', components, rejected_reason: null, created_by: me.userId,
      last_synced_at: new Date().toISOString(), managed: true, variable_map: cleanMap(map, variablesIn(draft.body).length),
    }, { onConflict: 'meta_id' }).select('id').single()
    if (error) return { ok: false, error: `Sent to Meta, but not saved here: ${error.message}. Use Sync from Meta.` }
    done()
    return { ok: true, data: { id: data.id, name: draft.name, status: res.status || 'PENDING' } }
  } catch (e) {
    return failed(e)
  }
}

export async function updateMetaTemplate(id: string, draft: TemplateDraft, map?: VariableMap): Promise<ActionResult> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can edit templates.' }
  const db = createServiceClient()
  const { data: row } = await db.from('meta_templates').select('meta_id, status, category').eq('id', id).eq('managed', true).maybeSingle()
  if (!row?.meta_id) return { ok: false, error: 'This template was not found. Use Sync from Meta.' }
  const problems = checkDraft(draft)
  if (problems.length) return { ok: false, error: problems[0] }
  try {
    const components = toComponents(draft)
    // An approved template keeps its category
    const category = row.status === 'APPROVED' ? undefined : draft.category
    await editMetaTemplate(row.meta_id, { components, ...(category ? { category } : {}) })
    const { error } = await db.from('meta_templates').update({
      components, ...(category ? { category } : {}), status: 'PENDING', rejected_reason: null,
      last_synced_at: new Date().toISOString(), variable_map: cleanMap(map, variablesIn(draft.body).length),
    }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    done()
    return { ok: true }
  } catch (e) {
    return failed(e)
  }
}

// What fills each {{n}}: saved here only, no Meta review needed
export async function setMetaVariableMap(id: string, map: VariableMap): Promise<ActionResult> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can change this.' }
  const db = createServiceClient()
  const { data: row } = await db.from('meta_templates').select('components').eq('id', id).eq('managed', true).maybeSingle()
  if (!row) return { ok: false, error: 'This template was not found.' }
  const { error } = await db.from('meta_templates').update({ variable_map: cleanMap(map, bodyCount(row.components || [])) }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

// Stop using it in this product; it stays in the Meta account
export async function unlinkMetaTemplate(id: string): Promise<ActionResult> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can change this.' }
  const { error } = await createServiceClient().from('meta_templates').delete().eq('id', id).eq('managed', true)
  if (error) return { ok: false, error: error.message }
  done()
  return { ok: true }
}

// Delete from the Meta account (only templates this product created or added)
export async function removeMetaTemplate(id: string): Promise<ActionResult> {
  const me = await role()
  if (me.role !== 'admin') return { ok: false, error: 'Only admins can delete templates.' }
  const db = createServiceClient()
  const { data: row } = await db.from('meta_templates').select('meta_id, name').eq('id', id).eq('managed', true).maybeSingle()
  if (!row) return { ok: false, error: 'This template was already removed.' }
  try {
    await deleteMetaTemplate(row.name, row.meta_id)
    await db.from('meta_templates').delete().eq('id', id)
    done()
    return { ok: true }
  } catch (e) {
    return failed(e)
  }
}

// This product's approved templates, for the campaign forms' template picker
export async function ourApprovedMetaTemplates(): Promise<ActionResult<{ name: string; language: string; body: string }[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('meta_templates').select('name, language, components').eq('managed', true).eq('status', 'APPROVED').order('name')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data || []).map(t => ({ name: t.name, language: t.language, body: (t.components as { type: string; text?: string }[]).find(c => c.type === 'BODY')?.text ?? '' })) }
}
