import { CONFIG, LEAD_CATEGORIES, LeadCategory } from '@/lib/config'
import { parseAndValidatePhone, isUkMobile } from '@/lib/contact'

export type FieldKey =
  | 'business_name'
  | 'website'
  | 'no_site'
  | 'address'
  | 'postcode'
  | 'branches'
  | 'business_type'
  | 'services'
  | 'owner_name'
  | 'owner_email'
  | 'owner_whatsapp'
  | 'owner_social'
  | 'business_email'
  | 'business_whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tech_partner_type'
  | 'tech_partner_name'
  | 'gaps_found'
  | 'source'
  // Legacy and extra aliases
  | 'linkedin'
  | 'owner_contact'
  | 'existing_tech_partner'
  | 'area'
  | 'notes'
  | 'maps_link'
  | 'rating'
  | 'reviews_count'
  | 'company_type'
  | 'tier'
  | 'room_count'
  | 'demo_link'

export const PROBLEM_LABELS: Record<string, string> = {
  name: 'Business name',
  website: 'Website',
  location: 'Location',
  postcode: 'Postcode',
  category: 'Category',
  service: 'Service',
  owner_name: 'Owner name',
  owner_contact: 'Owner contact',
  business_contact: 'Business contact',
  tech_partner: 'Tech partner',
  gaps: 'Gaps found',
}

export const FIELDS: { key: FieldKey; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: 'business_name', label: 'Business name', required: true, synonyms: ['business_name', 'business', 'name', 'business name', 'company', 'company name', 'hotel', 'venue'] },
  { key: 'website', label: 'Website', synonyms: ['website', 'existing_website', 'site', 'url', 'web', 'link'] },
  { key: 'no_site', label: 'No site (tick / yes)', synonyms: ['no_site', 'has_no_website', 'no site', 'no_website', 'no website', 'without website'] },
  { key: 'address', label: 'Address', synonyms: ['address', 'location', 'street', 'full address'] },
  { key: 'postcode', label: 'Postcode', synonyms: ['postcode', 'post code', 'zip', 'postal code'] },
  { key: 'branches', label: 'Branches (Name | Address | Postcode; ...)', synonyms: ['branches', 'branch list', 'locations', 'group branches'] },
  { key: 'business_type', label: 'Category', required: true, synonyms: ['business_type', 'category', 'type', 'business type', 'sector', 'industry'] },
  { key: 'services', label: 'Services to pitch', required: true, synonyms: ['services', 'services_to_pitch', 'service_to_pitch', 'service', 'pitch', 'offer', 'services pitched'] },
  { key: 'owner_name', label: 'Owner name', synonyms: ['owner_name', 'contact_name', 'owner', 'contact', 'manager', 'contact name', 'owner contact name'] },
  { key: 'owner_email', label: 'Owner email', synonyms: ['owner_email', 'owner email', 'owner e-mail'] },
  { key: 'owner_whatsapp', label: 'Owner WhatsApp', synonyms: ['owner_whatsapp', 'owner whatsapp', 'owner mobile', 'owner phone'] },
  { key: 'owner_social', label: 'Owner social / LinkedIn', synonyms: ['owner_social', 'owner social', 'owner linkedin', 'owner socials', 'owner social link'] },
  { key: 'business_email', label: 'Business email', synonyms: ['business_email', 'email', 'business email', 'e-mail', 'mail', 'email address'] },
  { key: 'business_whatsapp', label: 'Business WhatsApp', synonyms: ['business_whatsapp', 'whatsapp_number', 'whatsapp', 'wa', 'business whatsapp', 'wa number', 'mobile'] },
  { key: 'instagram', label: 'Instagram', synonyms: ['instagram', 'business_instagram', 'ig', 'insta', 'instagram handle'] },
  { key: 'facebook', label: 'Facebook', synonyms: ['facebook', 'business_facebook', 'fb', 'facebook page'] },
  { key: 'tech_partner_type', label: 'Tech partner type (Agency/DIY/None)', synonyms: ['tech_partner_type', 'tech partner type', 'partner type'] },
  { key: 'tech_partner_name', label: 'Tech partner name', synonyms: ['tech_partner_name', 'tech partner name', 'agency name', 'diy tool', 'partner name'] },
  { key: 'gaps_found', label: 'Gaps found', synonyms: ['gaps_found', 'gaps', 'gaps found', 'issues', 'audit', 'observations'] },
  { key: 'source', label: 'Source', synonyms: ['source', 'lead source', 'channel', 'campaign'] },

  // Legacy mappings
  { key: 'owner_contact', label: 'Owner contact (all-in-one)', synonyms: ['owner_contact', 'owner contact'] },
  { key: 'existing_tech_partner', label: 'Existing tech partner (legacy)', synonyms: ['existing_tech_partner', 'tech_partner', 'tech partner'] },
  { key: 'linkedin', label: 'Business LinkedIn', synonyms: ['linkedin', 'business_linkedin', 'li'] },
  { key: 'area', label: 'Area', synonyms: ['area', 'town', 'borough', 'city', 'neighbourhood'] },
  { key: 'notes', label: 'Notes', synonyms: ['notes', 'comments', 'remarks'] },
  { key: 'maps_link', label: 'Google Maps link', synonyms: ['maps_link', 'maps', 'google maps'] },
  { key: 'rating', label: 'Rating', synonyms: ['rating', 'google_rating', 'google rating', 'stars'] },
  { key: 'reviews_count', label: 'Reviews count', synonyms: ['reviews_count', 'reviews', 'review count'] },
  { key: 'company_type', label: 'Company type', synonyms: ['company_type', 'company type'] },
  { key: 'tier', label: 'Tier', synonyms: ['tier', 'star rating'] },
  { key: 'room_count', label: 'Rooms', synonyms: ['room_count', 'rooms', 'room count'] },
  { key: 'demo_link', label: 'Demo link', synonyms: ['demo_link', 'demo'] },
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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i

export function isValidUkPostcode(pc?: string | null): boolean {
  if (!pc) return false
  return UK_POSTCODE_RE.test(pc.trim())
}

export function isValidUkMobileDigits(raw?: string | null): boolean {
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  return /^(07\d{9}|447\d{9})$/.test(digits)
}

export type BranchItem = {
  name: string
  address: string
  postcode: string
}

export function parseBranches(raw?: string | null): BranchItem[] {
  if (!raw || !raw.trim()) return []
  return raw
    .split(';')
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => {
      const parts = b.split('|').map(p => p.trim())
      return {
        name: parts[0] || '',
        address: parts[1] || '',
        postcode: (parts[2] || '').toUpperCase(),
      }
    })
}

export function parseRating(v: string): { rating: string; reviews: string } {
  const m = clean(v).match(/^(\d(?:\.\d)?)\s*(?:\(([\d,]+)\))?/)
  return m ? { rating: m[1], reviews: (m[2] || '').replace(/,/g, '') } : { rating: '', reviews: '' }
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
  line: number
  data: Record<string, string>
  services: string[]
  branches: BranchItem[]
  problems: string[]
  isReady: boolean
  isCannotImport: boolean
  isMissingData: boolean
  errors: string[]
  warnings: string[]
}

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
  const problems: string[] = []

  const name = get('business_name')
  const rawType = get('business_type')
  const type = typeOverrides[rawType] || guessType(rawType) || ''

  // Website & No site
  const rawNoSite = get('no_site')
  const hasNoWebsite = /^(yes|y|true|1|tick|checked|no site|no website|none)$/i.test(rawNoSite)
  const rawWebsite = get('website')
  const website = hasNoWebsite ? '' : rawWebsite

  // Location / address / postcode / branches
  const address = get('address')
  const postcode = get('postcode').toUpperCase()
  const rawBranches = get('branches')
  const branches = parseBranches(rawBranches)

  // Services
  const svc = parseServices(get('services'), defaultServices)

  // Owner info
  const ownerName = get('owner_name')
  const ownerEmail = get('owner_email')
  const rawOwnerWa = get('owner_whatsapp')
  const ownerSocial = get('owner_social')
  const legacyOwnerContact = get('owner_contact')

  // Business contacts
  const businessEmail = get('business_email')
  const rawBizWa = get('business_whatsapp')
  const instagram = get('instagram')
  const facebook = get('facebook')
  const linkedin = get('linkedin')

  // Normalise WhatsApp
  let cleanBizWa = rawBizWa
  if (rawBizWa) {
    const waCheck = parseAndValidatePhone(rawBizWa)
    if (waCheck.valid && waCheck.normalized) {
      cleanBizWa = waCheck.normalized
    }
  }

  let cleanOwnerWa = rawOwnerWa
  if (rawOwnerWa) {
    const waCheck = parseAndValidatePhone(rawOwnerWa)
    if (waCheck.valid && waCheck.normalized) {
      cleanOwnerWa = waCheck.normalized
    }
  }

  // Tech partner
  let techType = get('tech_partner_type')
  let techName = get('tech_partner_name')
  const legacyTech = get('existing_tech_partner')
  if (!techType && legacyTech) {
    if (legacyTech.toLowerCase() === 'none') {
      techType = 'None'
    } else if (/^Agency/i.test(legacyTech)) {
      techType = 'Agency'
      techName = legacyTech.replace(/^Agency\s*\(?|\)?$/gi, '').trim()
    } else if (/^DIY/i.test(legacyTech)) {
      techType = 'DIY'
      techName = legacyTech.replace(/^DIY\s*\(?|\)?$/gi, '').trim()
    }
  }
  if (techType && !['Agency', 'DIY', 'None'].includes(techType)) {
    techType = ''
  }

  const gapsFound = get('gaps_found')
  const source = get('source')

  // --- Check 1: Business name ---
  if (!name) {
    problems.push('name')
    errors.push('Business name is missing')
  }

  // --- Check 2: Website ---
  if (!hasNoWebsite) {
    if (!website || !/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(website)) {
      problems.push('website')
      errors.push('Valid website URL (http/https) or "No site" tick is required')
    }
  }

  // --- Check 3: Location & Postcode ---
  if (branches.length > 0) {
    const allBranchesHaveNameAndAddress = branches.every(b => b.name && b.address)
    const allBranchesHaveValidPostcode = branches.every(b => isValidUkPostcode(b.postcode))
    if (!allBranchesHaveNameAndAddress) {
      problems.push('location')
      errors.push('Every branch must have a name and address')
    }
    if (!allBranchesHaveValidPostcode) {
      problems.push('postcode')
      errors.push('Every branch must have a valid UK postcode')
    }
  } else {
    if (!address) {
      problems.push('location')
      errors.push('Address is missing')
    }
    if (!isValidUkPostcode(postcode)) {
      problems.push('postcode')
      errors.push('Valid UK postcode is required')
    }
  }

  // --- Check 4: Category ---
  if (!type || !(LEAD_CATEGORIES as readonly string[]).includes(type)) {
    problems.push('category')
    errors.push('Category must be Hotel, Restaurant or cafe, Pub, or Property management')
  }

  // --- Check 5: Service ---
  if (!svc.services.length) {
    problems.push('service')
    errors.push('At least one service to pitch is required')
  }

  // --- Check 6: Owner name ---
  if (!ownerName) {
    problems.push('owner_name')
    errors.push('Owner name is required')
  }

  // --- Check 7: Owner contact ---
  const hasValidOwnerEmail = !!ownerEmail && EMAIL_RE.test(ownerEmail)
  const hasValidOwnerMobile = isValidUkMobileDigits(cleanOwnerWa) || isUkMobile(cleanOwnerWa)
  const hasValidOwnerSocial = !!ownerSocial && ownerSocial.trim().length > 1
  const hasValidLegacyOwnerContact = !!legacyOwnerContact && (
    EMAIL_RE.test(legacyOwnerContact) ||
    isValidUkMobileDigits(legacyOwnerContact) ||
    /(linkedin|http|instagram|facebook|twitter|x\.com)/i.test(legacyOwnerContact)
  )
  if (!hasValidOwnerEmail && !hasValidOwnerMobile && !hasValidOwnerSocial && !hasValidLegacyOwnerContact) {
    problems.push('owner_contact')
    errors.push('Owner contact (email, UK mobile 07/+447, or LinkedIn/social) is required')
  }

  // --- Check 8: Business contact ---
  const hasValidBizEmail = !!businessEmail && EMAIL_RE.test(businessEmail)
  const hasValidBizWa = isValidUkMobileDigits(cleanBizWa) || isUkMobile(cleanBizWa)
  const hasValidIg = !!instagram && !/^(instagram|yes|y|check)$/i.test(instagram)
  const hasValidFb = !!facebook && !/^(facebook|yes|y)$/i.test(facebook)
  if (!hasValidBizEmail && !hasValidBizWa && !hasValidIg && !hasValidFb) {
    problems.push('business_contact')
    errors.push('Business contact (email, UK mobile, Instagram, or Facebook) is required')
  }

  // --- Check 9: Tech partner ---
  const hasValidTechPartner =
    techType === 'None' ||
    ((techType === 'Agency' || techType === 'DIY') && !!techName) ||
    (legacyTech && (legacyTech.toLowerCase() === 'none' || (/^(Agency|DIY)/i.test(legacyTech) && legacyTech.length > 4)))
  if (!hasValidTechPartner) {
    problems.push('tech_partner')
    errors.push('Tech partner (None, or Agency/DIY with name) is required')
  }

  // --- Check 10: Gaps found ---
  if (!gapsFound || !gapsFound.trim()) {
    problems.push('gaps')
    errors.push('Gaps found is required')
  }

  const isCannotImport = !name
  const isReady = problems.length === 0
  const isMissingData = !isCannotImport && !isReady

  return {
    idx,
    line: idx + 2,
    services: svc.services,
    branches,
    problems,
    isReady,
    isCannotImport,
    isMissingData,
    errors,
    warnings,
    data: {
      business_name: name,
      business_type: type,
      existing_website: website,
      has_no_website: hasNoWebsite ? 'true' : 'false',
      address,
      postcode,
      branches: rawBranches,
      contact_name: ownerName,
      owner_email: ownerEmail,
      owner_whatsapp: cleanOwnerWa,
      owner_social: ownerSocial,
      owner_contact: legacyOwnerContact,
      email: businessEmail,
      whatsapp_number: cleanBizWa,
      instagram: /^(instagram|yes|y|check)$/i.test(instagram) ? '' : instagram,
      facebook: /^(facebook|yes|y)$/i.test(facebook) ? '' : facebook,
      linkedin,
      tech_partner_type: techType,
      tech_partner_name: techName,
      existing_tech_partner: legacyTech,
      gaps_found: gapsFound,
      source,
      area: get('area'),
      notes: get('notes'),
      maps_link: get('maps_link'),
      company_type: (CONFIG.COMPANY_TYPES as readonly string[]).find(c => c.toLowerCase() === get('company_type').toLowerCase()) || '',
      tier: guessTier(get('tier') || rawType) || '',
      room_count: get('room_count').replace(/\D/g, ''),
      demo_link: get('demo_link'),
    },
  }
}

export const TEMPLATE_HEADERS = [
  'business_name',
  'website',
  'no_site',
  'address',
  'postcode',
  'branches',
  'business_type',
  'services',
  'owner_name',
  'owner_email',
  'owner_whatsapp',
  'owner_social',
  'business_email',
  'business_whatsapp',
  'instagram',
  'facebook',
  'tech_partner_type',
  'tech_partner_name',
  'gaps_found',
  'source',
]
