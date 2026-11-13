// Links and validation for contacting a business outside the app

// ---------- Phone numbers ----------
// Any country's number is checked with libphonenumber-js (Google's phone rules):
// valid or not, mobile or landline. A number written without its country code is
// read as the default country from Settings (key 'phone_defaults'); nothing about
// countries is fixed in the code.

import { getCountries, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max'
import examples from 'libphonenumber-js/examples.mobile.json'

export type { CountryCode }

let defaultCountry: CountryCode | undefined

export function isCountryCode(c?: string | null): c is CountryCode {
  return !!c && (getCountries() as string[]).includes(c)
}

// Set once per page (browser) or request (server) from Settings
export function setPhoneDefaults(country?: string | null) {
  defaultCountry = isCountryCode(country) ? country : undefined
}

export type NumberKind = 'mobile' | 'landline' | 'mobile_or_landline' | 'other' | 'invalid' | 'empty'
export type NumberCheck = { valid: boolean; e164: string | null; country: CountryCode | null; kind: NumberKind; error?: string }

export function checkNumber(raw?: string | null, country: CountryCode | undefined = defaultCountry): NumberCheck {
  const value = (raw || '').trim()
  if (!value) return { valid: false, e164: null, country: null, kind: 'empty' }
  const tryParse = (v: string, c?: CountryCode) => {
    try { return parsePhoneNumberFromString(v, c) } catch { return undefined }
  }
  let p = tryParse(value.replace(/^00/, '+'), country)
  // Digits that already start with a country code (as WhatsApp sends them, e.g. 4479…)
  if ((!p || !p.isValid()) && /^[1-9][\d\s()-]{6,}$/.test(value)) {
    const intl = tryParse(`+${value.replace(/\D/g, '')}`)
    if (intl?.isValid()) p = intl
  }
  if (!p) {
    return { valid: false, e164: null, country: null, kind: 'invalid', error: value.startsWith('+') || country ? 'Not a valid phone number' : 'Add the country code (for example +…)' }
  }
  if (!p.isValid()) return { valid: false, e164: null, country: p.country ?? null, kind: 'invalid', error: 'Not a valid phone number' }
  const t = p.getType()
  const kind: NumberKind =
    t === 'MOBILE' ? 'mobile'
      : t === 'FIXED_LINE' ? 'landline'
        : t === 'FIXED_LINE_OR_MOBILE' ? 'mobile_or_landline'
          : 'other'
  return { valid: true, e164: p.number, country: p.country ?? null, kind }
}

// "GB" -> "United Kingdom" (falls back to the code)
export function countryName(code?: string | null): string {
  if (!code) return ''
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code } catch { return code }
}

// An example mobile number for the default country, for placeholders ("+44 7400 123456")
export function exampleNumber(format: 'international' | 'e164' = 'international', country: CountryCode | undefined = defaultCountry): string {
  if (!country) return '+<country code> <number>'
  try {
    const n = getExampleNumber(country, examples)
    if (!n) return '+<country code> <number>'
    return format === 'e164' ? n.number : n.formatInternational()
  } catch {
    return '+<country code> <number>'
  }
}

export type PhoneValidationResult =
  | { valid: true; normalized: string; error?: never }
  | { valid: true; normalized: null; error?: never }
  | { valid: false; normalized: null; error: string }

// Valid numbers come back in international form (+<country code><number>); empty is allowed
export function parseAndValidatePhone(raw?: string | null, country?: CountryCode): PhoneValidationResult {
  const c = checkNumber(raw, country ?? defaultCountry)
  if (c.kind === 'empty') return { valid: true, normalized: null }
  if (!c.valid || !c.e164) return { valid: false, normalized: null, error: c.error || 'Not a valid phone number' }
  return { valid: true, normalized: c.e164 }
}

// Digits only, with the country code (what wa.me and the WhatsApp API expect)
export function internationalDigits(phone?: string | null, country?: CountryCode): string | null {
  const c = checkNumber(phone, country ?? defaultCountry)
  return c.valid && c.e164 ? c.e164.replace(/^\+/, '') : null
}

export type PhoneTypeInfo = {
  type: 'whatsapp_mobile' | 'landline' | 'invalid' | 'empty'
  label: string
  isWhatsApp: boolean
  normalized: string | null
}

export function getPhoneType(phone?: string | null, country?: CountryCode): PhoneTypeInfo {
  const c = checkNumber(phone, country ?? defaultCountry)
  if (c.kind === 'empty') return { type: 'empty', label: 'No number', isWhatsApp: false, normalized: null }
  if (!c.valid) return { type: 'invalid', label: c.error || 'Not a valid phone number', isWhatsApp: false, normalized: null }
  if (c.kind === 'mobile') return { type: 'whatsapp_mobile', label: 'Mobile', isWhatsApp: true, normalized: c.e164 }
  if (c.kind === 'mobile_or_landline') return { type: 'whatsapp_mobile', label: 'Mobile or landline', isWhatsApp: true, normalized: c.e164 }
  return { type: 'landline', label: c.kind === 'landline' ? 'Landline' : 'Not a mobile', isWhatsApp: false, normalized: c.e164 }
}

export function isWhatsAppCapable(phone?: string | null): boolean {
  return getPhoneType(phone).isWhatsApp
}

export function whatsappLink(phone?: string | null, text?: string): string | null {
  const n = internationalDigits(phone)
  if (!n) return null
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function instagramLink(handle?: string | null): string | null {
  return handle ? `https://www.instagram.com/${handle.replace(/^@/, '')}/` : null
}

export function facebookLink(page?: string | null): string | null {
  if (!page) return null
  return /^https?:\/\//.test(page) ? page : `https://www.facebook.com/${page}`
}

export function mailtoLink(email?: string | null, subject?: string, body?: string): string | null {
  if (!email) return null
  const q = new URLSearchParams()
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  return `mailto:${email}?${q.toString().replace(/\+/g, '%20')}`
}

export function telLink(phone?: string | null): string | null {
  if (!phone) return null
  const c = checkNumber(phone)
  return `tel:${c.valid && c.e164 ? c.e164 : phone.replace(/[^\d+]/g, '')}`
}

export function websiteLink(site?: string | null): string | null {
  if (!site || !/\./.test(site) || /\s/.test(site)) return null
  return /^https?:\/\//.test(site) ? site : `https://${site}`
}
