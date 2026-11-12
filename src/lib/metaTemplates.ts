// Meta WhatsApp message templates (WhatsApp Business Management API).
// Server only: uses the WABA ID and access token from the WhatsApp integration.
// Meta reviews every new or edited template; status comes back on the webhook.

import { getWhatsAppConfig } from '@/lib/integrations'
import type { MetaCategory, MetaComponent, MetaTemplate } from '@/lib/metaTemplateDraft'

const GRAPH = 'https://graph.facebook.com/v21.0'
const FIELDS = 'id,name,status,category,language,components,rejected_reason,quality_score'

export class MetaApiError extends Error {}

async function credentials() {
  const cfg = await getWhatsAppConfig()
  const waba = cfg.waba_id || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  const token = cfg.access_token || process.env.WHATSAPP_ACCESS_TOKEN
  if (!waba || !token) throw new MetaApiError('WhatsApp is not connected. Add the WhatsApp Business Account ID and access token in Integrations.')
  return { waba, token }
}

async function graph<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    const e = json?.error
    // Meta's user-facing message is the most useful when present
    throw new MetaApiError(e?.error_user_msg || e?.error_user_title || e?.message || `Meta returned HTTP ${res.status}`)
  }
  return json as T
}

export async function listMetaTemplates(): Promise<MetaTemplate[]> {
  const { waba, token } = await credentials()
  const all: MetaTemplate[] = []
  let next: string | null = `${GRAPH}/${encodeURIComponent(waba)}/message_templates?fields=${FIELDS}&limit=100`
  for (let page = 0; next && page < 20; page++) {
    const res: { data: MetaTemplate[]; paging?: { next?: string } } = await graph(next, token)
    all.push(...(res.data || []))
    next = res.paging?.next ?? null
  }
  return all
}

export async function createMetaTemplate(t: { name: string; language: string; category: MetaCategory; components: MetaComponent[] }) {
  const { waba, token } = await credentials()
  return graph<{ id: string; status: string; category: MetaCategory }>(
    `${GRAPH}/${encodeURIComponent(waba)}/message_templates`, token,
    { method: 'POST', body: JSON.stringify({ ...t, allow_category_change: true }) },
  )
}

// Meta only allows changing the content (and the category while it isn't approved)
export async function editMetaTemplate(metaId: string, t: { category?: MetaCategory; components: MetaComponent[] }) {
  const { token } = await credentials()
  return graph<{ success: boolean }>(`${GRAPH}/${encodeURIComponent(metaId)}`, token, { method: 'POST', body: JSON.stringify(t) })
}

export async function deleteMetaTemplate(name: string, metaId?: string | null) {
  const { waba, token } = await credentials()
  const q = new URLSearchParams({ name, ...(metaId ? { hsm_id: metaId } : {}) })
  return graph<{ success: boolean }>(`${GRAPH}/${encodeURIComponent(waba)}/message_templates?${q}`, token, { method: 'DELETE' })
}

// One template by its Meta id. null = Meta says it no longer exists.
export async function getMetaTemplate(metaId: string): Promise<MetaTemplate | null> {
  const { token } = await credentials()
  const res = await fetch(`${GRAPH}/${encodeURIComponent(metaId)}?fields=${FIELDS}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && !json?.error) return json as MetaTemplate
  // "Unsupported get request / does not exist" (code 100) or 404: really gone
  if (res.status === 404 || json?.error?.code === 100) return null
  throw new MetaApiError(json?.error?.error_user_msg || json?.error?.message || `Meta returned HTTP ${res.status}`)
}

const SETTLED = ['APPROVED', 'REJECTED', 'DISABLED']

// Re-check our templates whose status may be out of date (in review, paused, marked
// deleted, or not checked for a while) straight from Meta, and save the result.
// Used when the chat page and Templates load, so an approval shows without a manual sync.
export async function refreshMetaTemplateStatuses({ names, maxAgeMs = 5 * 60_000 }: { names?: string[]; maxAgeMs?: number } = {}) {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const db = createServiceClient()
  let q = db.from('meta_templates').select('id, meta_id, status, last_synced_at').eq('managed', true).not('meta_id', 'is', null)
  if (names?.length) q = q.in('name', names)
  const { data: rows } = await q.limit(25)
  const now = Date.now()
  const due = (rows || []).filter(r =>
    !SETTLED.includes(r.status) || !r.last_synced_at || now - new Date(r.last_synced_at).getTime() > maxAgeMs)
  await Promise.all(due.map(async r => {
    try {
      const t = await getMetaTemplate(r.meta_id!)
      const patch = t
        ? {
            status: t.status, category: t.category, components: t.components ?? [],
            rejected_reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
            quality_score: t.quality_score?.score ?? null,
          }
        : { status: 'DELETED' }
      await db.from('meta_templates').update({ ...patch, last_synced_at: new Date().toISOString() }).eq('id', r.id)
    } catch {
      // Meta unreachable: keep what we have, try again next time
    }
  }))
}
