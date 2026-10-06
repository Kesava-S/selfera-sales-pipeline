import { parseAndValidatePhone } from '@/lib/contact'

/**
 * Meta WhatsApp Cloud API Client
 * Sends messages directly via Meta Graph API v21.0
 */

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN)
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
}

export interface SendWhatsAppResult {
  success: boolean
  messageId: string | null
  error?: string
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<SendWhatsAppResult> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneId || !token) {
    throw new Error('WhatsApp is not configured. Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN.')
  }

  const cleanTo = formatWhatsAppNumber(options.to)
  if (!cleanTo) {
    throw new Error(`Invalid WhatsApp phone number: ${options.to}`)
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`

  let payload: any

  if (options.templateName) {
    const lang = options.templateLanguage || process.env.WHATSAPP_DEFAULT_TEMPLATE_LANG || 'en'
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: options.templateName,
        language: { code: lang },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: options.body,
              },
            ],
          },
        ],
      },
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
    const errorMsg = json?.error?.message || json?.error?.error_user_msg || `Meta API HTTP ${res.status}`
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
  }
}
