// Lead lookup: finds a business on Google Places and Companies House and
// turns the results into suggested values for our `businesses` fields.
// Server only: both API keys stay on the server.
//
//   GOOGLE_PLACES_API_KEY    Google Cloud key with "Places API (New)" enabled (billed per search)
//   COMPANIES_HOUSE_API_KEY  free key from developer.company-information.service.gov.uk
import { getSalesLists } from '@/lib/dynamicData'
import { matchCategory, type SalesLists } from '@/lib/lists'

export type LookupField =
  | 'address' | 'postcode' | 'area' | 'phone' | 'existing_website' | 'maps_link'
  | 'google_rating' | 'google_reviews_count' | 'business_type' | 'company_type' | 'contact_name'

export type Suggestion = Partial<Record<LookupField, string | number>>

export type PlaceResult = {
  id: string
  name: string
  address: string | null
  status: string | null
  category: string | null
  suggestion: Suggestion
}

export type CompanyResult = {
  number: string
  name: string
  status: string | null
  type: string | null
  address: string | null
  incorporated: string | null
  directors: string[]
  suggestion: Suggestion
}

export const lookupConfig = () => ({
  places: Boolean(process.env.GOOGLE_PLACES_API_KEY),
  companiesHouse: Boolean(process.env.COMPANIES_HOUSE_API_KEY),
})

// Google place types (e.g. "bed_and_breakfast", "italian_restaurant") -> one of
// our categories, using each category's known spellings (business_categories)
function businessTypeFromGoogle(lists: SalesLists, types: string[] = []): string | undefined {
  for (const t of types) {
    const words = t.replace(/_/g, ' ')
    const hit = matchCategory(lists, words) || matchCategory(lists, words.split(' ').pop() || '')
    if (hit) return hit
  }
  return undefined
}

// Companies House company types -> our company_type values (sole traders aren't registered there)
function companyTypeFromCH(type?: string): string | undefined {
  if (!type) return undefined
  if (['ltd', 'plc', 'private-unlimited', 'private-limited-guarant-nsc', 'private-limited-guarant-nsc-limited-exemption', 'private-limited-shares-section-30-exemption'].includes(type)) return 'Limited company'
  if (['llp', 'limited-partnership', 'scottish-partnership'].includes(type)) return 'Partnership'
  return undefined
}

type GooglePlace = {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  addressComponents?: { longText: string; shortText: string; types: string[] }[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  rating?: number
  userRatingCount?: number
  types?: string[]
  primaryTypeDisplayName?: { text: string }
  businessStatus?: string
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('Google Places is not set up: add GOOGLE_PLACES_API_KEY to .env.local.')
  const lists = await getSalesLists()

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      // Only the fields we use, which also keeps each search on the cheaper billing tier
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
        'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri',
        'places.rating', 'places.userRatingCount', 'places.types', 'places.primaryTypeDisplayName', 'places.businessStatus',
      ].join(','),
    },
    body: JSON.stringify({ textQuery: query, regionCode: 'GB', maxResultCount: 5 }),
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google Places: ${json?.error?.message || `HTTP ${res.status}`}`)

  return ((json.places || []) as GooglePlace[]).map(p => {
    const part = (type: string) => p.addressComponents?.find(c => c.types.includes(type))?.longText
    const suggestion: Suggestion = {
      address: p.formattedAddress,
      postcode: part('postal_code')?.toUpperCase(),
      area: part('postal_town') || part('locality'),
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
      existing_website: p.websiteUri,
      maps_link: p.googleMapsUri,
      google_rating: p.rating,
      google_reviews_count: p.userRatingCount,
      business_type: businessTypeFromGoogle(lists, p.types),
    }
    return {
      id: p.id,
      name: p.displayName?.text || 'Unnamed place',
      address: p.formattedAddress || null,
      status: p.businessStatus || null,
      category: p.primaryTypeDisplayName?.text || null,
      suggestion: Object.fromEntries(Object.entries(suggestion).filter(([, v]) => v !== undefined && v !== '')) as Suggestion,
    }
  })
}

const chAuth = () => 'Basic ' + Buffer.from(`${process.env.COMPANIES_HOUSE_API_KEY}:`).toString('base64')

async function chGet(path: string) {
  const res = await fetch(`https://api.company-information.service.gov.uk${path}`, {
    headers: { Authorization: chAuth() },
    signal: AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Companies House: ${json?.error || json?.errors?.[0]?.error || `HTTP ${res.status}`}`)
  return json
}

// "SMITH, John Andrew" -> "John Andrew Smith"
const tidyName = (n: string) => {
  const [last, first] = n.split(',').map(s => s.trim())
  const cap = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  return first ? `${cap(first)} ${cap(last)}` : cap(n)
}

export async function searchCompanies(query: string): Promise<CompanyResult[]> {
  if (!process.env.COMPANIES_HOUSE_API_KEY) throw new Error('Companies House is not set up: add COMPANIES_HOUSE_API_KEY to .env.local.')

  const json = await chGet(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=5`)
  const items = (json.items || []) as {
    title: string; company_number: string; company_status?: string; company_type?: string
    address_snippet?: string; date_of_creation?: string; address?: { postal_code?: string }
  }[]

  return Promise.all(items.map(async c => {
    // Current directors give a likely owner name; a failure here shouldn't hide the company
    let directors: string[] = []
    try {
      const officers = await chGet(`/company/${c.company_number}/officers?items_per_page=10`)
      directors = ((officers.items || []) as { name: string; officer_role?: string; resigned_on?: string }[])
        .filter(o => !o.resigned_on && /director/.test(o.officer_role || ''))
        .map(o => tidyName(o.name))
    } catch {}

    const suggestion: Suggestion = {
      company_type: companyTypeFromCH(c.company_type),
      contact_name: directors[0],
    }
    return {
      number: c.company_number,
      name: c.title,
      status: c.company_status || null,
      type: c.company_type || null,
      address: c.address_snippet || null,
      incorporated: c.date_of_creation || null,
      directors,
      suggestion: Object.fromEntries(Object.entries(suggestion).filter(([, v]) => v !== undefined)) as Suggestion,
    }
  }))
}
