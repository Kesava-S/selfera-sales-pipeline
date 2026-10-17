import { CONFIG, LEAD_CATEGORIES, LeadCategory } from '@/lib/config'
import { parseAndValidatePhone } from '@/lib/contact'

export type FieldKey =
  | 'business_name' | 'business_type' | 'services_to_pitch' | 'has_no_website' | 'existing_website'
  | 'address' | 'area' | 'postcode' | 'contact_name' | 'owner_contact'
  | 'email' | 'whatsapp_number' | 'phone' | 'instagram' | 'facebook'
  | 'existing_tech_partner' | 'gaps_found' | 'notes' | 'maps_link'
  | 'rating' | 'reviews_count' | 'company_type' | 'tier' | 'room_count' | 'demo_link'

export const FIELDS: { key: FieldKey; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: 'business_name', label: 'Business name', required: true, synonyms: ['business_name', 'business', 'name', 'business name', 'company', 'company name', 'hotel', 'venue'] },
  { key: 'business_type', label: 'Category', required: true, synonyms: ['business_type', 'category', 'type', 'business type', 'sector', 'industry'] },
  { key: 'services_to_pitch', label: 'Service to pitch', required: true, synonyms: ['services_to_pitch', 'services', 'service', 'pitch', 'offer', 'service to pitch', 'services to pitch'] },
  { key: 'email', label: 'Business Email', synonyms: ['email', 'business_email', 'business email', 'e-mail', 'mail', 'email address'] },
  { key: 'whatsapp_number', label: 'Business WhatsApp', synonyms: ['whatsapp_number', 'business_whatsapp', 'whatsapp', 'wa', 'business whatsapp', 'wa number'] },
  { key: 'instagram', label: 'Business Instagram', synonyms: ['instagram', 'business_instagram', 'ig', 'insta', 'instagram handle', 'business instagram'] },
  { key: 'facebook', label: 'Business Facebook', synonyms: ['facebook', 'business_facebook', 'fb', 'facebook page', 'business facebook'] },
  { key: 'phone', label: 'Business Phone (optional)', synonyms: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'contact number', 'business phone'] },
  { key: 'existing_website', label: 'Website', synonyms: ['existing_website', 'website', 'site', 'url', 'web', 'link'] },
  { key: 'has_no_website', label: 'No site (tick / yes)', synonyms: ['has_no_website', 'no_site', 'no site', 'no_website', 'no website', 'without website'] },
  { key: 'address', label: 'Location (address or branches)', synonyms: ['address', 'location', 'locations', 'branches', 'street', 'full address'] },
  { key: 'contact_name', label: 'Owner name', synonyms: ['contact_name', 'owner_name', 'owner name', 'owner', 'contact', 'manager', 'contact name'] },
  { key: 'owner_contact', label: 'Owner contact (email/WA/socials)', synonyms: ['owner_contact', 'owner contact', 'owner phone', 'owner email', 'owner socials', 'owner linkedin', 'owner whatsapp'] },
  { key: 'existing_tech_partner', label: 'Existing tech partner', synonyms: ['existing_tech_partner', 'tech_partner', 'existing tech partner', 'tech partner', 'agency', 'diy'] },
  { key: 'gaps_found', label: 'Gaps found', synonyms: ['gaps_found', 'gaps', 'gaps found', 'issues', 'audit', 'observations'] },
  { key: 'area', label: 'Area', synonyms: ['area', 'town', 'borough', 'city', 'neighbourhood'] },
  { key: 'postcode', label: 'Postcode', synonyms: ['postcode', 'post code', 'zip', 'postal code'] },
  { key: 'notes', label: 'Notes', synonyms: ['notes', 'comments', 'remarks'] },
  { key: 'maps_link', label: 'Google Maps link', synonyms: ['maps_link', 'maps', 'google maps', 'maps url', 'map link'] },
  { key: 'rating', label: 'Rating', synonyms: ['rating', 'google_rating', 'google rating', 'stars', 'note'] },
  { key: 'reviews_count', label: 'Reviews count', synonyms: ['reviews_count', 'reviews', 'review count', 'google_reviews_count'] },
  { key: 'company_type', label: 'Company type', synonyms: ['company_type', 'company type', 'legal type'] },
  { key: 'tier', label: 'Tier', synonyms: ['tier', 'star rating', 'stars class'] },
  { key: 'room_count', label: 'Rooms', synonyms: ['room_count', 'rooms', 'room count', 'number of rooms'] },
  { key: 'demo_link', label: 'Demo link', synonyms: ['demo_link', 'demo', 'demo url'] },
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

// Synonyms mapped strictly into our 4 categories
const CATEGORY_SYNONYMS: Record<string, LeadCategory> = {
  // Hotel
  hotel: 'Hotel',
  hotels: 'Hotel',
  'boutique hotel': 'Hotel',
  'b b': 'Hotel',
  bnb: 'Hotel',
  'b&b': 'Hotel',
  guesthouse: 'Hotel',
  'guest house': 'Hotel',
  inn: 'Hotel',
  'pub with rooms': 'Hotel',
  'barge b b': 'Hotel',
  hostel: 'Hotel',
  resort: 'Hotel',
  motel: 'Hotel',
  lodging: 'Hotel',
  accommodation: 'Hotel',

  // Restaurant or cafe
  'restaurant or cafe': 'Restaurant or cafe',
  'restaurants and cafes': 'Restaurant or cafe',
  'restaurants & cafes': 'Restaurant or cafe',
  restaurant: 'Restaurant or cafe',
  restaurants: 'Restaurant or cafe',
  cafe: 'Restaurant or cafe',
  cafes: 'Restaurant or cafe',
  'coffee shop': 'Restaurant or cafe',
  coffee: 'Restaurant or cafe',
  'park cafe': 'Restaurant or cafe',
  'cafe bar': 'Restaurant or cafe',
  'tea room': 'Restaurant or cafe',
  bistro: 'Restaurant or cafe',
  bakery: 'Restaurant or cafe',
  takeaway: 'Restaurant or cafe',
  diner: 'Restaurant or cafe',
  eatery: 'Restaurant or cafe',
  'food & drink': 'Restaurant or cafe',
  food: 'Restaurant or cafe',

  // Pub
  pub: 'Pub',
  pubs: 'Pub',
  bar: 'Pub',
  bars: 'Pub',
  'pub bar': 'Pub',
  'pub / bar': 'Pub',
  'public house': 'Pub',
  tavern: 'Pub',
  gastropub: 'Pub',

  // Property management
  'property management': 'Property management',
  'property manager': 'Property management',
  property: 'Property management',
  properties: 'Property management',
  airbnb: 'Property management',
  'airbnb host': 'Property management',
  'short let': 'Property management',
  'short-let': 'Property management',
  'short-let / airbnb host': 'Property management',
  'serviced apartments': 'Property management',
  'serviced apartment': 'Property management',
  'co living': 'Property management',
  aparthotel: 'Property management',
  'estate agent': 'Property management',
  'letting agent': 'Property management',
  'real estate': 'Property management',
}

export function guessType(value: string): LeadCategory | null {
  const v = (value || '').trim()
  if (!v) return null
  const exact = (LEAD_CATEGORIES as readonly string[]).find(t => t.toLowerCase() === v.toLowerCase())
  if (exact) return exact as LeadCategory
  return CATEGORY_SYNONYMS[norm(v)] ?? null
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
  return parseAndValidatePhone(p).valid
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
// Exactly 4 required checks decide whether a row is accepted:
// 1. Business name
// 2. Category: Hotel, Restaurant or cafe, Pub, or Property management
// 3. Service to pitch: Website, Micro Automation, End-to-End Automation, Custom Dashboard, or Cold Outreach
// 4. At least one contact: email, WhatsApp, Instagram, or Facebook (or phone)
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
      notes.push(rating)
      rating = ''
    }
  }

  const rawPhone = get('phone')
  let cleanPhone = rawPhone
  if (rawPhone) {
    const pCheck = parseAndValidatePhone(rawPhone)
    if (pCheck.valid && pCheck.normalized) {
      cleanPhone = pCheck.normalized
    }
  }

  const rawWa = get('whatsapp_number')
  let cleanWa = rawWa
  if (rawWa) {
    const waCheck = parseAndValidatePhone(rawWa)
    if (waCheck.valid && waCheck.normalized) {
      cleanWa = waCheck.normalized
    }
  }

  const rawNoSite = get('has_no_website')
  const hasNoWebsite = /^(yes|y|true|1|tick|checked|no site|no website|none)$/i.test(rawNoSite)
  const rawWebsite = get('existing_website')
  const existingWebsite = hasNoWebsite ? '' : rawWebsite

  const location = get('address') || area

  const ig = get('instagram')
  const fb = get('facebook')

  const svc = parseServices(get('services_to_pitch'), defaultServices)

  // --- 4 REQUIRED CHECKS ---
  // 1. Business name
  if (!name) {
    errors.push('Business name is missing')
  }

  // 2. Category (Hotel, Restaurant or cafe, Pub, or Property management)
  if (!rawType && !type) {
    errors.push('Category is missing')
  } else if (!type || !(LEAD_CATEGORIES as readonly string[]).includes(type)) {
    errors.push(`Unknown category "${rawType}". Must be Hotel, Restaurant or cafe, Pub, or Property management`)
  }

  // 3. Service to pitch
  if (!svc.services.length) {
    errors.push('Pick at least one service to pitch')
  }
  if (svc.unknown.length) {
    errors.push(`Unknown service "${svc.unknown.join(', ')}"`)
  }

  // 4. At least one contact (email, WhatsApp, Instagram, or Facebook / phone)
  const hasContact = Boolean(email || cleanWa || cleanPhone || ig || fb)
  if (!hasContact) {
    errors.push('At least one contact is required (email, WhatsApp, Instagram, or Facebook)')
  }

  if (email && !EMAIL_RE.test(email)) {
    errors.push('Email looks wrong')
  }

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
      existing_website: existingWebsite,
      has_no_website: hasNoWebsite ? 'true' : 'false',
      address: location,
      area,
      postcode,
      contact_name: get('contact_name'),
      owner_contact: get('owner_contact'),
      email,
      whatsapp_number: cleanWa,
      phone: cleanPhone,
      instagram: /^(instagram|yes|y|check|instagram \(check\))$/i.test(ig) ? '' : ig,
      facebook: /^(facebook|yes|y)$/i.test(fb) ? '' : fb,
      existing_tech_partner: get('existing_tech_partner'),
      gaps_found: get('gaps_found'),
      maps_link: get('maps_link'),
      google_rating: rating,
      google_reviews_count: reviews.replace(/\D/g, ''),
      company_type: (CONFIG.COMPANY_TYPES as readonly string[]).find(c => c.toLowerCase() === get('company_type').toLowerCase()) || '',
      tier,
      room_count: get('room_count').replace(/\D/g, ''),
      demo_link: get('demo_link'),
      notes: notes.join('. '),
    },
  }
}

export const TEMPLATE_HEADERS = [
  'business_name',
  'category',
  'service_to_pitch',
  'email',
  'whatsapp_number',
  'instagram',
  'facebook',
  'website',
  'no_site',
  'location',
  'owner_name',
  'owner_contact',
  'existing_tech_partner',
  'gaps_found',
]
