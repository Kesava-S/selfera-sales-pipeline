// CSV import helpers: column matching, cleaning messy values, validation.
import { BUSINESS_TYPES, CONFIG } from '@/lib/config'

export type FieldKey =
  | 'business_name' | 'business_type' | 'services_to_pitch' | 'area' | 'address' | 'postcode' | 'maps_link'
  | 'rating' | 'reviews_count' | 'phone' | 'whatsapp_number' | 'email' | 'instagram' | 'facebook'
  | 'existing_website' | 'company_type' | 'contact_name' | 'tier' | 'room_count' | 'demo_link' | 'notes'

export const FIELDS: { key: FieldKey; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: 'business_name', label: 'Business name', required: true, synonyms: ['business_name', 'business', 'name', 'business name', 'company', 'company name', 'hotel', 'venue'] },
  { key: 'business_type', label: 'Business type', required: true, synonyms: ['business_type', 'type', 'category', 'business type', 'sector'] },
  { key: 'services_to_pitch', label: 'Services to pitch', synonyms: ['services_to_pitch', 'services', 'service', 'pitch', 'offer'] },
  { key: 'area', label: 'Area', synonyms: ['area', 'location', 'town', 'borough', 'city', 'neighbourhood'] },
  { key: 'address', label: 'Address', synonyms: ['address', 'street', 'full address'] },
  { key: 'postcode', label: 'Postcode', synonyms: ['postcode', 'post code', 'zip', 'postal code'] },
  { key: 'maps_link', label: 'Google Maps link', synonyms: ['maps_link', 'maps', 'google maps', 'maps url', 'map link'] },
  { key: 'rating', label: 'Rating', synonyms: ['rating', 'google_rating', 'google rating', 'stars', 'note'] },
  { key: 'reviews_count', label: 'Reviews count', synonyms: ['reviews_count', 'reviews', 'review count', 'google_reviews_count'] },
  { key: 'phone', label: 'Phone', synonyms: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'contact number'] },
  { key: 'whatsapp_number', label: 'WhatsApp number', synonyms: ['whatsapp_number', 'whatsapp', 'wa'] },
  { key: 'email', label: 'Email', synonyms: ['email', 'e-mail', 'mail', 'email address'] },
  { key: 'instagram', label: 'Instagram', synonyms: ['instagram', 'ig', 'insta', 'instagram handle'] },
  { key: 'facebook', label: 'Facebook', synonyms: ['facebook', 'fb', 'facebook page'] },
  { key: 'existing_website', label: 'Website', synonyms: ['existing_website', 'website', 'site', 'url', 'web'] },
  { key: 'company_type', label: 'Company type', synonyms: ['company_type', 'company type', 'legal type'] },
  { key: 'contact_name', label: 'Contact name', synonyms: ['contact_name', 'contact', 'owner', 'contact name', 'manager'] },
  { key: 'tier', label: 'Tier', synonyms: ['tier', 'star rating', 'stars class'] },
  { key: 'room_count', label: 'Rooms', synonyms: ['room_count', 'rooms', 'room count', 'number of rooms'] },
  { key: 'demo_link', label: 'Demo link', synonyms: ['demo_link', 'demo', 'demo url'] },
  { key: 'notes', label: 'Notes', synonyms: ['notes', 'comments', 'remarks'] },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function autoMap(headers: string[]): Partial<Record<FieldKey, string>> {
  const map: Partial<Record<FieldKey, string>> = {}
  const used = new Set<string>()
  for (const f of FIELDS) {
    const h = headers.find(h => !used.has(h) && f.synonyms.some(s => norm(s) === norm(h)))
    if (h) {
      map[f.key] = h
      used.add(h)
    }
  }
  return map
}

// Common words in scraped data mapped to our business types
const TYPE_SYNONYMS: Record<string, string> = {
  cafe: 'Cafe', 'coffee shop': 'Cafe', coffee: 'Cafe', 'park cafe': 'Cafe', 'cafe bar': 'Cafe', 'tea room': 'Cafe',
  restaurant: 'Restaurant', bistro: 'Restaurant', bakery: 'Bakery', takeaway: 'Takeaway', pub: 'Pub / Bar', bar: 'Pub / Bar',
  hotel: 'Hotel', '3 star': 'Hotel', '4 star': 'Hotel', '5 star': 'Hotel', 'boutique hotel': 'Boutique hotel',
  'b b': 'B&B / Guesthouse', bnb: 'B&B / Guesthouse', guesthouse: 'B&B / Guesthouse', 'guest house': 'B&B / Guesthouse', inn: 'B&B / Guesthouse',
  'pub with rooms': 'B&B / Guesthouse', 'barge b b': 'B&B / Guesthouse', airbnb: 'Short-let / Airbnb host', 'short let': 'Short-let / Airbnb host',
  'serviced apartments': 'Serviced apartments', 'co living': 'Serviced apartments', aparthotel: 'Serviced apartments', hostel: 'Hostel',
  hairdresser: 'Hair salon', 'hair salon': 'Hair salon', salon: 'Hair salon', 'hair beauty': 'Hair salon', 'hair colour head spa': 'Hair salon',
  barber: 'Barber', barbers: 'Barber', barbershop: 'Barber',
  beauty: 'Beauty', 'beauty salon': 'Beauty', 'beauty therapist': 'Beauty', beautician: 'Beauty',
  'nail salon': 'Nails & Lashes', 'nail studio': 'Nails & Lashes', nails: 'Nails & Lashes', lashes: 'Nails & Lashes',
  'lashes pmu': 'Nails & Lashes', 'lashes beauty': 'Nails & Lashes', 'beauty nails': 'Nails & Lashes',
  aesthetics: 'Medical aesthetics', 'medical aesthetics': 'Medical aesthetics', 'facialist laser': 'Medical aesthetics', clinic: 'Medical aesthetics',
  spa: 'Spa', gym: 'Fitness / Training studio', fitness: 'Fitness / Training studio', 'personal trainer': 'Fitness / Training studio', yoga: 'Fitness / Training studio',
  boutique: 'Fashion boutique', 'fashion boutique': 'Fashion boutique', florist: 'Florist', other: 'Other',
}

export function guessType(value: string): string | null {
  const v = (value || '').trim()
  if (!v) return null
  const exact = BUSINESS_TYPES.find(t => t.toLowerCase() === v.toLowerCase())
  if (exact) return exact
  return TYPE_SYNONYMS[norm(v)] ?? null
}

export function guessTier(value: string): string | null {
  const v = norm(value)
  if (/^[12] star/.test(v)) return '1-2 star'
  if (/^3 star/.test(v)) return '3 star'
  if (/^[45] star/.test(v)) return '4-5 star'
  return null
}

const EMPTY = /^(not found|not listed|not searched|not captured|none|none found|n\/?a|na|-|\u2014|null|unknown|tbc|\?)$/i

export function clean(v: unknown): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return EMPTY.test(s) ? '' : s
}

export function parseRating(v: string): { rating: string; reviews: string } {
  const m = clean(v).match(/^(\d(?:\.\d)?)\s*(?:\(([\d,]+)\))?/)
  return m ? { rating: m[1], reviews: (m[2] || '').replace(/,/g, '') } : { rating: '', reviews: '' }
}

export function parseEmail(v: string): { email: string; note: string } {
  const s = clean(v)
  const m = s.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)
  if (!m) return { email: '', note: s ? `Email note: ${s}` : '' }
  const rest = s.replace(m[0], '').replace(/[()]/g, '').trim()
  if (/check|unverified|not verified|staff/i.test(rest)) return { email: '', note: `Possible email ${m[0]} (${rest}, not verified)` }
  return { email: m[0].toLowerCase(), note: rest ? `Email note: ${rest}` : '' }
}

const POSTCODE_END = /\s([A-Z]{1,2}\d[A-Z\d]?(?:\s?\d[A-Z]{2})?)$/i

export function splitAreaPostcode(area: string, postcode: string): { area: string; postcode: string } {
  let a = clean(area)
  let p = clean(postcode).toUpperCase()
  const m = a.match(POSTCODE_END)
  if (m) {
    if (!p) p = m[1].toUpperCase()
    a = a.slice(0, m.index).trim()
  }
  if (!a && p) a = ''
  return { area: a, postcode: p }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function phoneLooksValid(p: string): boolean {
  const d = p.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 13
}

export function parseServices(v: string, fallback: string[]): { services: string[]; unknown: string[] } {
  const parts = clean(v).split(/[;,/|]/).map(s => s.trim()).filter(Boolean)
  if (!parts.length) return { services: fallback, unknown: [] }
  const services: string[] = []
  const unknown: string[] = []
  for (const p of parts) {
    const match = CONFIG.SERVICES.find(s => s.toLowerCase() === p.toLowerCase() || norm(s) === norm(p))
    if (match) services.push(match)
    else unknown.push(p)
  }
  return { services: Array.from(new Set(services)), unknown }
}

export type ImportRow = {
  idx: number
  line: number // row number in the file (header = 1)
  data: Record<string, string>
  services: string[]
  errors: string[]
  warnings: string[]
}

// Turn a raw CSV row into clean fields for the database
export function buildRow(
  raw: Record<string, string>,
  map: Partial<Record<FieldKey, string>>,
  typeOverrides: Record<string, string>,
  defaultServices: string[],
  idx: number
): ImportRow {
  const get = (k: FieldKey) => (map[k] ? clean(raw[map[k]!]) : '')
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []

  const name = get('business_name')
  const rawType = get('business_type')
  const type = typeOverrides[rawType] || guessType(rawType) || ''
  const tier = guessTier(get('tier') || rawType) || ''
  const { area, postcode } = splitAreaPostcode(get('area'), get('postcode'))
  const { email, note: emailNote } = parseEmail(get('email'))
  if (emailNote) notes.push(emailNote)

  let rating = get('rating')
  let reviews = get('reviews_count')
  if (rating) {
    const r = parseRating(rating)
    if (r.rating) {
      rating = r.rating
      reviews = reviews || r.reviews
    } else {
      notes.push(rating) // e.g. "Owner: Sylwia" in a notes-like column
      rating = ''
    }
  }

  const phone = get('phone')
  const svc = parseServices(get('services_to_pitch'), defaultServices)

  if (!name) errors.push('Business name is missing')
  if (!rawType && !type) errors.push('Business type is missing')
  else if (!type) errors.push(`Unknown business type "${rawType}"`)
  if (!svc.services.length) errors.push('No service to pitch')
  if (svc.unknown.length) errors.push(`Unknown service "${svc.unknown.join(', ')}"`)
  if (email && !EMAIL_RE.test(email)) errors.push('Email looks wrong')
  if (phone && !phoneLooksValid(phone)) errors.push('Phone looks wrong')
  if (rawType && type && rawType.toLowerCase() !== type.toLowerCase() && !typeOverrides[rawType]) notes.push(`Sheet type: ${rawType}`)

  const ig = get('instagram')
  const fb = get('facebook')
  if (!phone && !email && !ig && !fb && !area && !postcode && !get('address')) warnings.push('No way to contact yet')

  const extraNotes = get('notes')
  if (extraNotes) notes.unshift(extraNotes)

  return {
    idx,
    line: idx + 2,
    services: svc.services,
    errors,
    warnings,
    data: {
      business_name: name,
      business_type: type,
      tier,
      room_count: get('room_count').replace(/\D/g, ''),
      area,
      address: get('address'),
      postcode,
      maps_link: get('maps_link'),
      google_rating: rating,
      google_reviews_count: reviews.replace(/\D/g, ''),
      phone,
      whatsapp_number: get('whatsapp_number'),
      email,
      instagram: /^(instagram|yes|y|check|instagram \(check\))$/i.test(ig) ? '' : ig,
      facebook: /^(facebook|yes|y)$/i.test(fb) ? '' : fb,
      existing_website: get('existing_website'),
      company_type: (CONFIG.COMPANY_TYPES as readonly string[]).find(c => c.toLowerCase() === get('company_type').toLowerCase()) || '',
      contact_name: get('contact_name'),
      demo_link: get('demo_link'),
      notes: notes.join('. '),
    },
  }
}

export const TEMPLATE_HEADERS = [
  'business_name', 'business_type', 'services_to_pitch', 'area', 'address', 'postcode', 'phone', 'whatsapp_number', 'email',
  'instagram', 'facebook', 'existing_website', 'maps_link', 'rating', 'reviews_count', 'company_type', 'contact_name',
  'tier', 'room_count', 'demo_link', 'notes',
]
