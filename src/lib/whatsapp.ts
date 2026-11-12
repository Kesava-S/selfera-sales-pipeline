import { parseAndValidatePhone } from '@/lib/contact'
import { paramsFor, renderTemplate, type MetaComponent, type VarKey, type VariableMap } from '@/lib/metaTemplateDraft'

/**
 * Meta WhatsApp Cloud API Client
 * Sends messages directly via Meta Graph API v21.0
 */

// Set up in Integrations (falls back to .env only when Integrations has no value)
export async function isWhatsAppConfigured(): Promise<boolean> {
  try {
    const { getWhatsAppConfig } = await import('@/lib/integrations')
    const cfg = await getWhatsAppConfig()
    return Boolean(cfg.phone_number_id && cfg.access_token)
  } catch {
    return false
  }
}

export function formatWhatsAppNumber(phone: string): string {
  const res = parseAndValidatePhone(phone)
  if (res.valid && res.normalized) {
    if (res.normalized.startsWith('+44')) return res.normalized.slice(1)
    if (res.normalized.startsWith('+0')) return '44' + res.normalized.slice(2)
    if (res.normalized.startsWith('0')) return '44' + res.normalized.slice(1)
    if (res.normalized.startsWith('44')) return res.normalized
    return res.normalized.replace(/^\+/, '')
  }
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '44' + digits.slice(1)
  }
  return digits
}

export interface SendWhatsAppOptions {
  to: string
  body: string
  templateName?: string | null
  templateLanguage?: string
  // Lead details that fill the template's {{n}} (see Templates → WhatsApp); `message` defaults to body
  vars?: Partial<Record<VarKey, string | null | undefined>>
  phoneId?: string
  accessToken?: string
}

export interface SendWhatsAppResult {
  success: boolean
  messageId: string | null
  error?: string
  // The template text as sent, with the lead's details filled in
  sentText?: string
  // A retry won't help (no usable template)
  permanent?: boolean
  // The Meta template it went out as (outside the 24-hour window)
  templateUsed?: string
}

type OurTemplate = { name: string; language: string; status: string; components: MetaComponent[]; variable_map: VariableMap | null }

// Only this product's templates are used (the Meta account is shared with other products)
async function ourTemplate(name: string): Promise<OurTemplate | null> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const { data } = await createServiceClient()
    .from('meta_templates')
    .select('name, language, status, components, variable_map')
    .eq('name', name)
    .eq('managed', true)
    .order('status')
  const rows = (data || []) as OurTemplate[]
  return rows.find(r => r.status === 'APPROVED') ?? rows[0] ?? null
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<SendWhatsAppResult> {
  // Integrations first (it falls back to .env itself)
  let phoneId = options.phoneId
  let token = options.accessToken
  if (!phoneId || !token) {
    try {
      const { getWhatsAppConfig } = await import('@/lib/integrations')
      const cfg = await getWhatsAppConfig()
      phoneId = phoneId || cfg.phone_number_id
      token = token || cfg.access_token
    } catch {
      // Integrations unavailable
    }
  }

  if (!phoneId || !token) {
    throw new Error('WhatsApp is not set up. Add the Phone Number ID and access token in Integrations.')
  }

  const cleanTo = formatWhatsAppNumber(options.to)
  if (!cleanTo) {
    throw new Error(`Invalid WhatsApp phone number: ${options.to}`)
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`

  let payload: any

  let sentText: string | undefined
  let templateUsed: string | undefined
  if (options.templateName) {
    let template: Record<string, unknown>
    if (options.templateName === 'hello_world') {
      // Meta's built-in sample, with no variables
      template = { name: 'hello_world', language: { code: 'en_US' } }
    } else {
      const t = await ourTemplate(options.templateName)
      if (!t) return { success: false, messageId: null, permanent: true, error: `"${options.templateName}" is not one of this product's Meta templates. Link an approved template in Templates → WhatsApp.` }
      if (t.status !== 'APPROVED') return { success: false, messageId: null, permanent: true, error: `Meta template "${t.name}" is not approved yet (${t.status.toLowerCase().replace(/_/g, ' ')}).` }
      const map: VariableMap = { body: [], ...(t.variable_map || {}) }
      const bodyText = (t.components.find(c => c.type === 'BODY') as { text?: string } | undefined)?.text ?? ''
      const headerText = (t.components.find(c => c.type === 'HEADER') as { text?: string } | undefined)?.text ?? ''
      const count = new Set(bodyText.match(/\{\{\d+\}\}/g) || []).size
      const values = { message: options.body, ...(options.vars || {}) }
      const body = paramsFor(map, count, values)
      const header = /\{\{1\}\}/.test(headerText) ? paramsFor({ body: [map.header || 'business_name'] }, 1, values)[0] : null
      const components = [
        ...(header ? [{ type: 'header', parameters: [{ type: 'text', text: header }] }] : []),
        ...(body.length ? [{ type: 'body', parameters: body.map(text => ({ type: 'text', text })) }] : []),
      ]
      template = { name: t.name, language: { code: options.templateLanguage || t.language }, ...(components.length ? { components } : {}) }
      sentText = renderTemplate(t.components, body, header)
      templateUsed = t.name
    }

    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template,
    }
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: options.body,
      },
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorDetail = json?.error?.error_data?.details
    const baseMsg = json?.error?.message || json?.error?.error_user_msg || `Meta API HTTP ${res.status}`
    const errorMsg = errorDetail ? `${baseMsg} (${errorDetail})` : baseMsg
    console.error('Meta WhatsApp send failed:', json)
    return {
      success: false,
      messageId: null,
      error: errorMsg,
    }
  }

  const messageId = json?.messages?.[0]?.id || null

  return {
    success: true,
    messageId,
    sentText,
    templateUsed,
  }
}
