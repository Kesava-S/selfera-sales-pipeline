// Client Audience: shared types, phone checks and CSV fields.
// Used by both the screens (preview) and the server actions (which decide).

import type { EmailStatus } from '@/lib/emailCheck'
import { checkNumber } from '@/lib/contact'

// A customer's country is read from their phone number (two-letter code, e.g. "GB"); null when unknown
export type Country = string

export type PhoneType = 'mobile' | 'landline' | 'mobile_or_landline' | 'other' | 'invalid'
export type WhatsAppStatus = 'unknown' | 'likely' | 'confirmed' | 'not_on_whatsapp' | 'no_mobile'

export const PHONE_TYPE_LABEL: Record<PhoneType, string> = {
  mobile: 'Mobile',
  landline: 'Landline',
  mobile_or_landline: 'Mobile or landline',
  other: 'Other (free-phone, etc.)',
  invalid: 'Not a valid number',
}

export const WHATSAPP_LABEL: Record<WhatsAppStatus, string> = {
  unknown: 'Unknown',
  likely: 'Mobile (WhatsApp not checked yet)',
  confirmed: 'On WhatsApp',
  not_on_whatsapp: 'Not on WhatsApp',
  no_mobile: 'No mobile',
}

export type PhoneCheck = { e164: string | null; type: PhoneType; country: Country | null }

// What kind of number this is (any country). Numbers without a country code are
// read as the default country from Settings.
export function checkPhone(raw: string | null | undefined): PhoneCheck | null {
  const c = checkNumber(raw)
  if (c.kind === 'empty') return null
  if (!c.valid) return { e164: null, type: 'invalid', country: null }
  return { e164: c.e164, type: c.kind === 'invalid' ? 'invalid' : c.kind, country: c.country }
}

// Meta has no lookup for whether a number is on WhatsApp: a mobile is "likely"
// until a message to it is delivered.
export function whatsappFrom(...checks: (PhoneCheck | null)[]): WhatsAppStatus {
  if (checks.some(c => c?.type === 'mobile')) return 'likely'
  if (checks.some(c => c?.type === 'mobile_or_landline')) return 'unknown'
  return 'no_mobile'
}

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

export type CustomerLead = {
  // Email check (see emailCheck.ts); null = not checked
  email_status?: EmailStatus | null
  email_reason?: string | null
  email_suggestion?: string | null
  email_role?: boolean | null
  id: string
  business_id: string
  country: Country | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  phone_e164: string | null
  phone_type: PhoneType | null
  phone2: string | null
  phone2_e164: string | null
  phone2_type: PhoneType | null
  whatsapp_status: WhatsAppStatus
  town: string | null
  postcode: string | null
  last_purchase_on: string | null
  purchased: string | null
  birthday_month: number | null
  tags: string[]
  notes: string | null
  consent_confirmed: boolean
  consent_confirmed_at: string | null
  do_not_contact: boolean
  do_not_contact_reason: string | null
  do_not_contact_at: string | null
  source: 'form' | 'csv'
  is_ready: boolean
  created_at: string
}

// What a customer lead still needs before it can be marketed to
export function missingFor(c: Pick<CustomerLead, 'first_name' | 'email' | 'phone_type' | 'phone2_type' | 'consent_confirmed' | 'phone'>): string[] {
  const reachable = ['mobile', 'landline', 'mobile_or_landline']
  const out: string[] = []
  if (!c.first_name?.trim()) out.push('First name')
  if (!c.email && !reachable.includes(c.phone_type || '') && !reachable.includes(c.phone2_type || '')) {
    out.push(c.phone ? 'A valid phone or an email' : 'An email or phone')
  }
  if (!c.consent_confirmed) out.push('Consent')
  return out
}

// ---------- Input (form and CSV) ----------

export type CustomerInput = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  phone2?: string | null
  town?: string | null
  postcode?: string | null
  last_purchase_on?: string | null
  purchased?: string | null
  birthday_month?: number | string | null
  tags?: string[] | string | null
  notes?: string | null
}

export const CSV_FIELDS: { key: keyof CustomerInput; label: string; hints: string[]; required?: boolean }[] = [
  { key: 'first_name', label: 'Name', hints: ['name', 'full name', 'customer name', 'customer', 'first name', 'firstname', 'given name', 'forename'], required: true },
  { key: 'email', label: 'Email', hints: ['email', 'e-mail', 'email address', 'mail'], required: true },
  { key: 'phone', label: 'Phone number (WhatsApp)', hints: ['phone number (whatsapp)', 'phone number(whatsapp)', 'whatsapp', 'phone number', 'phone', 'mobile number', 'mobile', 'cell', 'contact number', 'tel', 'telephone'], required: true },
  { key: 'postcode', label: 'Postcode', hints: ['postcode', 'post code', 'zip', 'zipcode', 'postal code'], required: false },
  { key: 'town', label: 'City', hints: ['city', 'town', 'area', 'location'], required: false },
]

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()

export function autoMapColumns(headers: string[]): Partial<Record<keyof CustomerInput, string>> {
  const map: Partial<Record<keyof CustomerInput, string>> = {}
  const used = new Set<string>()
  for (const f of CSV_FIELDS) {
    const h = headers.find(x => !used.has(x) && f.hints.some(hint => norm(hint) === norm(x)))
    if (h) { map[f.key] = h; used.add(h) }
  }
  return map
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// 1-12 from "3", "March", "Mar" or a date like 1990-03-14 / 14/03/1990
export function monthFrom(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim().toLowerCase()
  if (/^\d{1,2}$/.test(s)) { const n = Number(s); return n >= 1 && n <= 12 ? n : null }
  const name = MONTHS.findIndex(m => s.startsWith(m))
  if (name >= 0) return name + 1
  const iso = s.match(/^\d{4}-(\d{1,2})-\d{1,2}/)
  if (iso) return monthFrom(iso[1])
  const uk = s.match(/^\d{1,2}[/.-](\d{1,2})[/.-]\d{2,4}$/)
  if (uk) return monthFrom(uk[1])
  return null
}

// yyyy-mm-dd from yyyy-mm-dd or dd/mm/yyyy (UK and India write the day first)
export function dateFrom(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3], dmy[2], dmy[1]] : null
  if (!parts) return null
  const [y, m, d] = parts
  const out = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const t = new Date(`${out}T00:00:00Z`)
  return Number.isNaN(t.getTime()) || t.getUTCDate() !== Number(d) ? null : out
}

export const tagsFrom = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String).map(s => s.trim()).filter(Boolean)
    : typeof v === 'string' ? v.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : []

const text = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim()
  return s || null
}

// A full name in "first name" with no last name is split on the first space
function names(first: unknown, last: unknown): [string | null, string | null] {
  const f = text(first)
  const l = text(last)
  if (f && !l && f.includes(' ')) {
    const i = f.indexOf(' ')
    return [f.slice(0, i), f.slice(i + 1).trim() || null]
  }
  return [f, l]
}

export type CleanCustomer = {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  phone_e164: string | null
  phone_type: PhoneType | null
  phone2: string | null
  phone2_e164: string | null
  phone2_type: PhoneType | null
  whatsapp_status: WhatsAppStatus
  country: Country | null
  town: string | null
  postcode: string | null
  last_purchase_on: string | null
  purchased: string | null
  birthday_month: number | null
  tags: string[]
  notes: string | null
}

// Tidies one customer and works out the phone details. Null when there is nothing to save.
export function cleanCustomer(input: CustomerInput): { row: CleanCustomer | null; problems: string[] } {
  const problems: string[] = []
  const [first_name, last_name] = names(input.first_name, input.last_name)
  let email = text(input.email)?.toLowerCase() ?? null
  if (email && !isEmail(email)) { problems.push(`"${email}" is not an email address`); email = null }

  const phone = text(input.phone)
  const phone2 = text(input.phone2)
  const p1 = checkPhone(phone)
  const p2 = checkPhone(phone2)
  if (p1?.type === 'invalid') problems.push(`"${phone}" is not a valid phone number`)
  if (p2?.type === 'invalid') problems.push(`"${phone2}" is not a valid phone number`)

  if (!first_name && !email && !phone && !phone2) return { row: null, problems: ['Empty row'] }

  const lastPurchase = text(input.last_purchase_on)
  const last_purchase_on = dateFrom(lastPurchase)
  if (lastPurchase && !last_purchase_on) problems.push(`"${lastPurchase}" is not a date`)

  return {
    problems,
    row: {
      first_name, last_name, email,
      phone, phone_e164: p1?.type === 'invalid' ? null : p1?.e164 ?? null, phone_type: p1?.type ?? null,
      phone2, phone2_e164: p2?.type === 'invalid' ? null : p2?.e164 ?? null, phone2_type: p2?.type ?? null,
      whatsapp_status: whatsappFrom(p1, p2),
      // Read from the phone number
      country: p1?.country ?? p2?.country ?? null,
      town: text(input.town),
      postcode: text(input.postcode)?.toUpperCase() ?? null,
      last_purchase_on,
      purchased: text(input.purchased),
      birthday_month: monthFrom(input.birthday_month),
      tags: tagsFrom(input.tags),
      notes: text(input.notes),
    },
  }
}
