// Client Audience: shared types, phone checks and CSV fields.
// Used by both the screens (preview) and the server actions (which decide).

import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

export type Country = 'UK' | 'India'
export const COUNTRIES: Country[] = ['UK', 'India']
const REGION: Record<Country, 'GB' | 'IN'> = { UK: 'GB', India: 'IN' }

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

// What kind of number this is. Numbers without +44 / +91 are read as the given country.
export function checkPhone(raw: string | null | undefined, country: Country): PhoneCheck | null {
  const value = raw?.trim()
  if (!value) return null
  const p = parsePhoneNumberFromString(value.replace(/^00/, '+'), REGION[country])
  if (!p || !p.isValid()) return { e164: null, type: 'invalid', country: null }
  // +44 also covers Guernsey, Jersey and the Isle of Man
  const found: Country | null = p.countryCallingCode === '44' ? 'UK' : p.countryCallingCode === '91' ? 'India' : null
  if (!found) return { e164: p.number, type: 'invalid', country: null }
  const t = p.getType()
  const type: PhoneType =
    t === 'MOBILE' ? 'mobile'
      : t === 'FIXED_LINE' ? 'landline'
        : t === 'FIXED_LINE_OR_MOBILE' ? 'mobile_or_landline'
          : 'other'
  return { e164: p.number, type, country: found }
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
  id: string
  business_id: string
  country: Country
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

export const CSV_FIELDS: { key: keyof CustomerInput; label: string; hints: string[] }[] = [
  { key: 'first_name', label: 'First name', hints: ['first name', 'firstname', 'first', 'forename', 'given name', 'name', 'full name', 'customer name', 'customer'] },
  { key: 'last_name', label: 'Last name', hints: ['last name', 'lastname', 'surname', 'family name'] },
  { key: 'email', label: 'Email', hints: ['email', 'e-mail', 'email address', 'mail'] },
  { key: 'phone', label: 'Phone / mobile', hints: ['mobile', 'phone', 'mobile number', 'phone number', 'whatsapp', 'cell', 'contact number', 'tel', 'telephone'] },
  { key: 'phone2', label: 'Second phone', hints: ['landline', 'home phone', 'work phone', 'phone 2', 'second phone', 'other phone', 'alternate phone'] },
  { key: 'town', label: 'Town / city', hints: ['town', 'city', 'area', 'location'] },
  { key: 'postcode', label: 'Postcode / PIN', hints: ['postcode', 'post code', 'zip', 'pincode', 'pin code', 'pin'] },
  { key: 'last_purchase_on', label: 'Last visit / purchase', hints: ['last visit', 'last purchase', 'last order', 'visit date', 'purchase date', 'last booking'] },
  { key: 'purchased', label: 'What they bought', hints: ['purchased', 'product', 'service', 'bought', 'item'] },
  { key: 'birthday_month', label: 'Birthday month', hints: ['birthday', 'birthday month', 'dob', 'date of birth'] },
  { key: 'tags', label: 'Tags', hints: ['tags', 'tag', 'segment', 'group', 'type'] },
  { key: 'notes', label: 'Notes', hints: ['notes', 'note', 'comments', 'comment'] },
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
  country: Country
  town: string | null
  postcode: string | null
  last_purchase_on: string | null
  purchased: string | null
  birthday_month: number | null
  tags: string[]
  notes: string | null
}

// Tidies one customer and works out the phone details. Null when there is nothing to save.
export function cleanCustomer(input: CustomerInput, country: Country): { row: CleanCustomer | null; problems: string[] } {
  const problems: string[] = []
  const [first_name, last_name] = names(input.first_name, input.last_name)
  let email = text(input.email)?.toLowerCase() ?? null
  if (email && !isEmail(email)) { problems.push(`"${email}" is not an email address`); email = null }

  const phone = text(input.phone)
  const phone2 = text(input.phone2)
  const p1 = checkPhone(phone, country)
  const p2 = checkPhone(phone2, country)
  if (p1?.type === 'invalid') problems.push(`"${phone}" is not a valid ${country} number`)
  if (p2?.type === 'invalid') problems.push(`"${phone2}" is not a valid ${country} number`)

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
      // A number with +44 / +91 decides the country; otherwise the one picked
      country: p1?.country ?? p2?.country ?? country,
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
