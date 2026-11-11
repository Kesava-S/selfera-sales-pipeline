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
