'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireProfile } from '@/lib/auth'
import { parseAndValidatePhone } from '@/lib/contact'
import { applyPhoneDefaults } from '@/lib/dynamicData'
import { searchPlaces, searchCompanies, type PlaceResult } from '@/lib/enrich'

export interface DiscoveredProspect {
  id: string
  business_name: string
  category: string
  business_type: string
  area: string
  address: string
  postcode: string
  phone: string | null
  whatsapp_number?: string | null
  email: string | null
  existing_website: string | null
  has_no_website?: boolean
  maps_link: string | null
  google_rating: number | null
  google_reviews_count: number | null
  contact_name: string | null
  opportunity_signal: string
  opportunity_pitch: string
  source_provider: string
  company_number?: string | null
  company_status?: string | null
  company_type?: string | null
  registered_address?: string | null
  directors_list?: string[]
  is_sme?: boolean
  company_incorporated?: string | null
  company_age_years?: number | null
}

export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  error?: string
}

export interface DiscoveryQuery {
  query?: string
  city?: string
  postcode?: string
  category?: string
  url?: string
  mode?: 'query' | 'url'
  smeOnly?: boolean
  minReviews?: number
  maxReviews?: number
  minRating?: number
  maxRating?: number
}

export interface SerpApiAccountInfo {
  total_searches_left: number
  searches_per_month: number
  this_month_usage: number
  plan_name: string
  plan_renewal_date?: string
}

export interface DiscoveryResponse {
  success: boolean
  isLive: boolean
  prospects: DiscoveredProspect[]
  message?: string
  error?: string
  serpApiBalance?: SerpApiAccountInfo | null
}

/**
 * Fetch current SerpApi account balance and remaining searches.
 */
export async function getSerpApiBalance(): Promise<SerpApiAccountInfo | null> {
  const serpKey = process.env.SERPAPI_API_KEY
  if (!serpKey) return null

  try {
    const res = await fetch(`https://serpapi.com/account?api_key=${serpKey}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return {
      total_searches_left: typeof data.total_searches_left === 'number' ? data.total_searches_left : (data.plan_searches_left ?? 0),
      searches_per_month: typeof data.searches_per_month === 'number' ? data.searches_per_month : 0,
      this_month_usage: typeof data.this_month_usage === 'number' ? data.this_month_usage : 0,
      plan_name: data.plan_name || 'Free Plan',
      plan_renewal_date: data.plan_renewal_date,
    }
  } catch (err) {
    console.warn('[SerpApi] Failed to fetch account balance:', err)
    return null
  }
}

/**
 * Retrieve allocated Firecrawl API keys with support for comma-separated, single, or backup keys.
 */
function getFirecrawlKeys(): string[] {
  const primary = process.env.FIRECRAWL_API_KEY || ''
  const backup = process.env.FIRECRAWL_BACKUP_API_KEY || ''
  const all = `${primary},${backup}`
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  return Array.from(new Set(all))
}

const FIRECRAWL_BASE_URL = (process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev').replace(/\/+$/, '')

function extractUkPhone(text: string): string | null {
  const match = text.match(/(?:(?:\+44\s?\(0\)\s?|\+44\s?|0)(?:1\d{8,9}|2\d{8,9}|3\d{8,9}|7\d{9}|800\d{6}|808\d{6}))/)
  return match ? match[0].trim() : null
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].trim() : null
}

function extractUkPostcode(text: string): string {
  const match = text.match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})\b/i)
  return match ? match[0].toUpperCase() : ''
}

function cleanBusinessTitle(rawTitle: string): string {
  if (!rawTitle) return ''
  return rawTitle
    .replace(/\s*[-–|:]\s*(Tripadvisor|Yelp|Google Maps|Home|Official Site|Facebook|LinkedIn|Instagram|Twitter|X).*/i, '')
    .trim()
}

// Known national franchise brands and enterprise chains to exclude from SME targeting
const KNOWN_CHAINS = [
  'mcdonald', 'subway', 'starbucks', 'costa', 'greggs', 'kfc', 'burger king',
  'pizza hut', 'domino', 'nando', 'wetherspoon', 'premier inn', 'travelodge',
  'hilton', 'marriott', 'tesco', 'sainsbury', 'asda', 'morrisons', 'aldi', 'lidl',
  'waitrose', 'boots', 'superdrug', 'currys', 'argos', 'b&q', 'screwfix',
  'toolstation', 'halfords', 'marks & spencer', 'm&s', 'primark', 'specsavers',
  'vision express', 'holland & barrett', 'anytime fitness', 'puregym', 'the gym group',
  'david lloyd', 'nuffield health', 'harvester', 'toby carvery', 'frankie & benny',
  'zizzi', 'prezzo', 'pizzaexpress', 'bella italia', 'caffè nero', 'caffe nero'
]

function isNationalChain(title: string): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return KNOWN_CHAINS.some((chain) => lower.includes(chain))
}

function evaluateIsSme(p: {
  business_name: string
  reviews?: number | null
  rating?: number | null
  phone?: string | null
  website?: string | null
  company_type?: string | null
}): boolean {
  // 1. Exclude national chains and large franchises
  if (isNationalChain(p.business_name)) return false

  // 2. Exclude public limited companies (large corporate PLCs)
  const cType = p.company_type?.toLowerCase() || ''
  if (cType === 'plc' || cType.includes('public limited')) return false

  // 3. Exclude massive enterprises with huge review counts (> 250 reviews)
  if (typeof p.reviews === 'number' && p.reviews > 250) return false

  // 4. Exclude ghost or unverified listings that have neither phone nor website
  if (!p.phone && !p.website) return false

  // 5. Exclude single-review forged listings (e.g. 5.0 rating with 1 review and no website)
  if (p.reviews === 1 && !p.website) return false

  return true
}

/**
 * Scrape a target webpage using ZenRows with stealth anti-bot bypass and JS rendering.
 */
async function scrapeWithZenRows(targetUrl: string): Promise<{
  success: boolean
  title?: string
  phone?: string | null
  email?: string | null
  error?: string
}> {
  const zenKey = process.env.ZENROWS_API_KEY
  if (!zenKey) return { success: false, error: 'ZENROWS_API_KEY is not configured.' }

  try {
    const endpoint = `https://api.zenrows.com/v1/?apikey=${zenKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&mode=auto`
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `ZenRows HTTP ${res.status}: ${err}` }
    }

    const html = await res.text()
    const phone = extractUkPhone(html)
    const email = extractEmail(html)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? cleanBusinessTitle(titleMatch[1]) : ''

    return {
      success: true,
      title,
      phone,
      email,
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'ZenRows scrape failed.' }
  }
}

/**
 * Search local businesses via SerpApi Google Maps engine.
 */
async function searchSerpApi(
  query: string,
  fallbackCategory?: string,
  fallbackCity?: string,
  fallbackPostcode?: string,
  smeOnly: boolean = false
): Promise<DiscoveredProspect[]> {
  const serpKey = process.env.SERPAPI_API_KEY
  if (!serpKey) return []

  try {
    const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&api_key=${serpKey}`
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      console.warn(`SerpApi failed with status ${res.status}`)
      return []
    }

    const json = await res.json()
    const results = json.local_results || []
    if (!Array.isArray(results) || results.length === 0) return []

    const mapped = results.slice(0, 20).map((item: any, idx: number) => {
      const bName = cleanBusinessTitle(item.title) || `Local Business ${idx + 1}`
      const fullAddress = item.address || ''
      const postcode = extractUkPostcode(fullAddress) || fallbackPostcode || ''
      const phone = item.phone || null
      const website = item.website || item.links?.website || null
      const rating = typeof item.rating === 'number' ? item.rating : null
      const reviews = typeof item.reviews === 'number' ? item.reviews : null

      const isSme = evaluateIsSme({
        business_name: bName,
        reviews,
        rating,
        phone,
        website,
      })

      const hasSite = Boolean(website)
      let signal = isSme ? 'Verified Growing SME' : 'Verified Local Business'
      let pitch = 'Pitches 24/7 WhatsApp consultation & booking agent'
      if (!hasSite) {
        signal = 'No website detected on public profile'
        pitch = 'Pitches modern responsive website and online direct booking'
      } else if (rating && rating < 4.2) {
        signal = `Low rating: ${rating} / 5.0 (${reviews || 0} reviews)`
        pitch = 'Pitches automated customer review accelerator & retention'
      } else if (reviews && reviews > 50) {
        signal = `Growing volume: ${reviews} reviews (${rating || '4.5'} / 5.0)`
        pitch = 'Pitches automated WhatsApp review concierge & workflow automation'
      }

      return {
        id: `serp-${item.place_id || Date.now()}-${idx}`,
        business_name: bName,
        category: item.type || (Array.isArray(item.types) ? item.types[0] : (fallbackCategory || 'General Business')),
        business_type: item.type || (Array.isArray(item.types) ? item.types[0] : (fallbackCategory || 'General Business')),
        area: postcode ? `UK, ${postcode}` : (fallbackCity || 'United Kingdom'),
        address: fullAddress,
        postcode: postcode,
        phone: phone,
        whatsapp_number: phone,
        email: null,
        existing_website: website,
        has_no_website: !hasSite,
        maps_link: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null,
        google_rating: rating,
        google_reviews_count: reviews,
        contact_name: null,
        opportunity_signal: signal,
        opportunity_pitch: pitch,
        source_provider: 'Verified Lead',
        is_sme: isSme,
      }
    })

    if (smeOnly) {
      const smes = mapped.filter((p) => p.is_sme)
      if (smes.length > 0) return smes.slice(0, 12)
    }

    return mapped.slice(0, 10)
  } catch (err: any) {
    console.warn('SerpApi search failed:', err?.message)
    return []
  }
}

/**
 * Check whether any discovery API key is allocated in environment variables.
 */
export async function isFirecrawlConfigured(): Promise<boolean> {
  return Boolean(
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.COMPANIES_HOUSE_API_KEY ||
    process.env.SERPAPI_API_KEY ||
    process.env.ZENROWS_API_KEY ||
    getFirecrawlKeys().length > 0
  )
}

/**
 * Execute lead discovery using Google Places, SerpApi, Companies House, Firecrawl, and ZenRows.
 */
export async function discoverProspectsWithFirecrawl(params: DiscoveryQuery): Promise<DiscoveryResponse> {
  const apiKeys = getFirecrawlKeys()
  const hasGooglePlaces = Boolean(process.env.GOOGLE_PLACES_API_KEY)
  const hasCompaniesHouse = Boolean(process.env.COMPANIES_HOUSE_API_KEY)
  const hasZenRows = Boolean(process.env.ZENROWS_API_KEY)
  const hasSerpApi = Boolean(process.env.SERPAPI_API_KEY)

  if (!hasGooglePlaces && !hasCompaniesHouse && !hasZenRows && !hasSerpApi && apiKeys.length === 0) {
    return {
      success: false,
      isLive: false,
      prospects: [],
      error: 'No search API key configured. Please ensure GOOGLE_PLACES_API_KEY, SERPAPI_API_KEY, FIRECRAWL_API_KEY, or ZENROWS_API_KEY is in your environment.',
    }
  }

  // 1. Direct URL Scrape via Firecrawl or ZenRows
  if (params.url) {
    if (apiKeys.length === 0 && !hasZenRows) {
      return {
        success: false,
        isLive: false,
        prospects: [],
        error: 'FIRECRAWL_API_KEY or ZENROWS_API_KEY is required to scrape direct website URLs.',
      }
    }

    let lastError = ''
    if (apiKeys.length > 0) {
      for (const apiKey of apiKeys) {
        try {
          const response = await fetch(`${FIRECRAWL_BASE_URL}/v1/scrape`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              url: params.url,
              formats: ['markdown', 'extract'],
              extract: {
                schema: {
                  type: 'object',
                  properties: {
                    business_name: { type: 'string' },
                    category: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    address: { type: 'string' },
                    postcode: { type: 'string' },
                    owner_name: { type: 'string' },
                    gaps_found: { type: 'string' },
                  },
                },
              },
            }),
          })

          if (!response.ok) {
            const errText = await response.text()
            lastError = `Status ${response.status}: ${errText}`
            console.warn(`Firecrawl key failed (${lastError}), attempting next key if available...`)
            continue
          }

          const json = await response.json()
          const extracted = json.data?.extract || json.data || {}
          const prospect: DiscoveredProspect = {
            id: `firecrawl-${Date.now()}`,
            business_name: extracted.business_name || new URL(params.url).hostname,
            category: extracted.category || params.category || 'Restaurant or cafe',
            business_type: extracted.category || params.category || 'Restaurant or cafe',
            area: params.city && params.city !== 'All Cities' ? params.city : 'United Kingdom',
            address: extracted.address || '',
            postcode: extracted.postcode || '',
            phone: extracted.phone || null,
            whatsapp_number: extracted.phone || null,
            email: extracted.email || null,
            existing_website: params.url,
            has_no_website: false,
            maps_link: null,
            google_rating: null,
            google_reviews_count: null,
            contact_name: extracted.owner_name || null,
            opportunity_signal: extracted.gaps_found || 'Live Web Extraction',
            opportunity_pitch: 'Pitches Website + Automation Optimization',
            source_provider: 'Verified Lead',
          }

          return {
            success: true,
            isLive: true,
            prospects: [prospect],
            message: 'Successfully extracted prospect from target URL.',
          }
        } catch (err: any) {
          lastError = err?.message || 'Network error'
          console.warn('Firecrawl request failed with error:', err)
        }
      }
    }

    // Fallback to ZenRows if Firecrawl failed or if no Firecrawl key
    if (hasZenRows) {
      try {
        const zenResult = await scrapeWithZenRows(params.url)
        if (zenResult.success) {
          const prospect: DiscoveredProspect = {
            id: `zenrows-${Date.now()}`,
            business_name: zenResult.title || new URL(params.url).hostname,
            category: params.category && params.category !== 'All Categories' ? params.category : 'General Business',
            business_type: params.category && params.category !== 'All Categories' ? params.category : 'General Business',
            area: params.city && params.city !== 'All Cities' ? params.city : 'United Kingdom',
            address: '',
            postcode: '',
            phone: zenResult.phone || null,
            whatsapp_number: zenResult.phone || null,
            email: zenResult.email || null,
            existing_website: params.url,
            has_no_website: false,
            maps_link: null,
            google_rating: null,
            google_reviews_count: null,
            contact_name: null,
            opportunity_signal: 'Live Web Extraction',
            opportunity_pitch: 'Pitches Website + Automation Optimization',
            source_provider: 'Verified Lead',
          }

          return {
            success: true,
            isLive: true,
            prospects: [prospect],
            message: 'Successfully extracted prospect from target URL.',
          }
        } else if (zenResult.error) {
          lastError = (lastError ? `${lastError}; ` : '') + `ZenRows: ${zenResult.error}`
        }
      } catch (zenErr: any) {
        lastError = (lastError ? `${lastError}; ` : '') + `ZenRows error: ${zenErr?.message || 'Failed'}`
      }
    }

    if (lastError) {
      return {
        success: false,
        isLive: true,
        prospects: [],
        error: `Scraping error: ${lastError}`,
      }
    }
  }

  // 2. Build search query terms
  const searchTerms = [
    params.query?.trim(),
    params.category && params.category !== 'All Categories' ? params.category : '',
    params.city?.trim() && params.city !== 'All Cities' ? params.city : '',
    params.postcode?.trim(),
  ]
    .filter(Boolean)
    .join(' ')

  if (!searchTerms) {
    return {
      success: true,
      isLive: true,
      prospects: [],
      message: 'Enter a search keyword, city, or website URL to discover prospects.',
    }
  }

  // Primary Query Search via SerpApi Google Maps Engine (if SerpApi key is provided)
  if (hasSerpApi) {
    try {
      const serpProspects = await searchSerpApi(
        searchTerms,
        params.category && params.category !== 'All Categories' ? params.category : undefined,
        params.city && params.city !== 'All Cities' ? params.city : undefined,
        params.postcode?.trim() || undefined,
        Boolean(params.smeOnly)
      )

      if (serpProspects && serpProspects.length > 0) {
        if (hasCompaniesHouse) {
          await Promise.all(
            serpProspects.map(async (p) => {
              try {
                const chQuery = p.business_name.split(/[|:]/)[0].trim()
                const companies = await searchCompanies(chQuery)
                if (companies && companies.length > 0) {
                  const match = companies[0]
                  if (match.directors?.length) {
                    p.contact_name = `${match.directors[0]} (Director)`
                    p.directors_list = match.directors
                  }
                  p.company_number = match.number || null
                  p.company_status = match.status || null
                  p.company_type = match.type || null
                  p.registered_address = match.address || null
                  p.source_provider = 'Verified Lead'

                  if (match.incorporated) {
                    p.company_incorporated = match.incorporated
                    const year = parseInt(match.incorporated.slice(0, 4), 10)
                    if (!isNaN(year)) {
                      p.company_age_years = Math.max(0, new Date().getFullYear() - year)
                    }
                  }

                  if (match.type?.toLowerCase() === 'plc' || match.status?.toLowerCase() === 'dissolved') {
                    p.is_sme = false
                  }
                }
              } catch {
                // Non-fatal if no exact registered company match
              }
            })
          )
        }

        const finalProspects = params.smeOnly
          ? (serpProspects.filter((p) => p.is_sme).length > 0 ? serpProspects.filter((p) => p.is_sme) : serpProspects)
          : serpProspects

        const balance = await getSerpApiBalance()

        return {
          success: true,
          isLive: true,
          prospects: finalProspects,
          message: `Discovered ${finalProspects.length} verified businesses.`,
          serpApiBalance: balance,
        }
      }
    } catch (serpErr: any) {
      console.warn('SerpApi lookup failed, attempting Google Places fallback:', serpErr?.message)
    }
  }

  // 3. Fallback: Google Places API & Companies House Director Lookup
  if (hasGooglePlaces) {
    try {
      const places = await searchPlaces(searchTerms)
      if (places && places.length > 0) {
        const enrichedProspects: DiscoveredProspect[] = await Promise.all(
          places.map(async (p, idx) => {
            let directorName: string | null = null
            let companyNumber: string | null = null
            let companyStatus: string | null = null
            let companyType: string | null = null
            let registeredAddress: string | null = null
            let directorsList: string[] = []
            let companyIncorporated: string | null = null
            let companyAgeYears: number | null = null

            if (hasCompaniesHouse && p.name) {
              try {
                const chQuery = p.name.split(/[|:]/)[0].trim()
                const companies = await searchCompanies(chQuery)
                if (companies && companies.length > 0) {
                  const match = companies[0]
                  if (match.directors?.length) {
                    directorName = match.directors[0]
                    directorsList = match.directors
                  }
                  companyNumber = match.number || null
                  companyStatus = match.status || null
                  companyType = match.type || null
                  registeredAddress = match.address || null

                  if (match.incorporated) {
                    companyIncorporated = match.incorporated
                    const year = parseInt(match.incorporated.slice(0, 4), 10)
                    if (!isNaN(year)) {
                      companyAgeYears = Math.max(0, new Date().getFullYear() - year)
                    }
                  }
                }
              } catch {
                // Non-fatal if Companies House has no exact company match
              }
            }

            const hasSite = Boolean(p.suggestion.existing_website)
            const rating = typeof p.suggestion.google_rating === 'number' ? p.suggestion.google_rating : null
            const reviews = typeof p.suggestion.google_reviews_count === 'number' ? p.suggestion.google_reviews_count : null

            const isSme = evaluateIsSme({
              business_name: p.name,
              reviews,
              rating,
              phone: (p.suggestion.phone as string) || null,
              website: (p.suggestion.existing_website as string) || null,
              company_type: companyType,
            })

            let signal = isSme ? 'Verified Growing SME' : 'Verified Local Business'
            let pitch = 'Pitches 24/7 WhatsApp consultation & booking agent'
            if (!hasSite) {
              signal = 'No website detected on public profile'
              pitch = 'Pitches modern responsive website and online direct booking'
            } else if (rating && rating < 4.2) {
              signal = `Low rating: ${rating} / 5.0 (${reviews || 0} reviews)`
              pitch = 'Pitches automated customer review accelerator & retention'
            } else if (reviews && reviews > 50) {
              signal = `Growing volume: ${reviews} reviews (${rating || '4.5'} / 5.0)`
              pitch = 'Pitches automated WhatsApp review concierge & workflow automation'
            }

            return {
              id: `place-${p.id || Date.now()}-${idx}`,
              business_name: p.name,
              category: (p.suggestion.business_type as string) || p.category || params.category || 'General Business',
              business_type: (p.suggestion.business_type as string) || p.category || params.category || 'General Business',
              area: (p.suggestion.area as string) || params.city || 'United Kingdom',
              address: (p.suggestion.address as string) || '',
              postcode: (p.suggestion.postcode as string) || params.postcode || '',
              phone: (p.suggestion.phone as string) || null,
              whatsapp_number: (p.suggestion.phone as string) || null,
              email: null,
              existing_website: (p.suggestion.existing_website as string) || null,
              has_no_website: !hasSite,
              maps_link: (p.suggestion.maps_link as string) || null,
              google_rating: rating,
              google_reviews_count: reviews,
              contact_name: directorName ? `${directorName} (Director)` : null,
              opportunity_signal: signal,
              opportunity_pitch: pitch,
              source_provider: 'Verified Lead',
              company_number: companyNumber,
              company_status: companyStatus,
              company_type: companyType,
              registered_address: registeredAddress,
              directors_list: directorsList,
              is_sme: isSme,
              company_incorporated: companyIncorporated,
              company_age_years: companyAgeYears,
            }
          })
        )

        const finalProspects = params.smeOnly
          ? (enrichedProspects.filter((p) => p.is_sme).length > 0 ? enrichedProspects.filter((p) => p.is_sme) : enrichedProspects)
          : enrichedProspects

        return {
          success: true,
          isLive: true,
          prospects: finalProspects,
          message: `Discovered ${finalProspects.length} verified businesses.`,
        }
      }
    } catch (placesErr: any) {
      console.warn('Google Places lookup failed, attempting Firecrawl fallback:', placesErr?.message)
    }
  }

  // 4. Fallback to Firecrawl Search via /v1/search (if Firecrawl key is provided)
  if (apiKeys.length > 0) {
    let searchError = ''
    for (const apiKey of apiKeys) {
      try {
        const response = await fetch(`${FIRECRAWL_BASE_URL}/v1/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: `${searchTerms} local business website contact`,
            limit: 10,
            scrapeOptions: {
              formats: ['markdown'],
            },
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          searchError = `Status ${response.status}: ${errText}`
          console.warn(`Firecrawl search key failed (${searchError}), trying next key...`)
          continue
        }

        const json = await response.json()
        const rawResults = Array.isArray(json.data) ? json.data : (json.data?.web || [])

        if (Array.isArray(rawResults) && rawResults.length > 0) {
          const liveProspects: DiscoveredProspect[] = rawResults.map((item: any, idx: number) => {
            const rawText = `${item.title || ''} ${item.description || ''} ${item.markdown || ''}`
            const phone = extractUkPhone(rawText)
            const email = extractEmail(rawText)
            const postcode = extractUkPostcode(rawText)
            const bName = cleanBusinessTitle(item.title) || `Local Business ${idx + 1}`

            return {
              id: `fc-search-${Date.now()}-${idx}`,
              business_name: bName,
              category: params.category && params.category !== 'All Categories' ? params.category : 'General Business',
              business_type: params.category && params.category !== 'All Categories' ? params.category : 'General Business',
              area: params.city && params.city !== 'All Cities' ? params.city : 'UK',
              address: postcode ? `United Kingdom, ${postcode}` : 'United Kingdom',
              postcode: postcode,
              phone: phone,
              whatsapp_number: phone,
              email: email,
              existing_website: item.url || null,
              has_no_website: !item.url,
              maps_link: null,
              google_rating: null,
              google_reviews_count: null,
              contact_name: null,
              opportunity_signal: item.description?.slice(0, 100) || 'Live directory web lead',
              opportunity_pitch: 'Pitches Website + AI Booking Automation',
              source_provider: 'Verified Lead',
            }
          })

          return {
            success: true,
            isLive: true,
            prospects: liveProspects,
            message: `Discovered ${liveProspects.length} live prospects.`,
          }
        }
      } catch (err: any) {
        searchError = err?.message || 'Search failed'
        console.warn('Firecrawl search failed with error:', err)
      }
    }

    if (searchError) {
      return {
        success: false,
        isLive: true,
        prospects: [],
        error: `Search error: ${searchError}`,
      }
    }
  }

  return {
    success: true,
    isLive: true,
    prospects: [],
    message: 'No businesses found matching your criteria. Try adjusting your keyword or city.',
  }
}

/**
 * Check which discovered business names or postcodes already exist in the pipeline.
 */
export async function checkExistingPipeline(prospectNames: string[]) {
  try {
    const { supabase } = await requireUser()
    if (!prospectNames || prospectNames.length === 0) return []

    const cleanNames = prospectNames.map(n => n.trim()).filter(Boolean)
    const { data } = await supabase
      .from('businesses')
      .select('id, business_name, postcode, business_type')
      .in('business_name', cleanNames)
      .eq('archived', false)

    return (data || []).map(b => ({
      id: b.id,
      business_name: b.business_name,
      postcode: b.postcode,
      business_type: b.business_type,
    }))
  } catch (err: any) {
    console.error('Error checking existing pipeline:', err)
    return []
  }
}

/**
 * Import selected discovered prospects directly into the Leads approval queue (stage = 'Needs review').
 */
export async function importDiscoveredProspects(
  prospects: DiscoveredProspect[],
  servicePitched: string = 'Website'
): Promise<ImportResult> {
  try {
    const { supabase, user } = await requireUser()
    const { profile } = await requireProfile()

    if (!profile) {
      return { success: false, importedCount: 0, skippedCount: 0, error: 'Your account is not configured.' }
    }

    if (!prospects || prospects.length === 0) {
      return { success: false, importedCount: 0, skippedCount: 0, error: 'No prospects selected for import.' }
    }

    await applyPhoneDefaults()

    let importedCount = 0
    let skippedCount = 0

    for (const p of prospects) {
      const name = p.business_name.trim()
      if (!name) {
        skippedCount++
        continue
      }

      // Check if business with exact same name already exists
      const { data: existing } = await supabase
        .from('businesses')
        .select('id')
        .eq('business_name', name)
        .eq('archived', false)
        .maybeSingle()

      if (existing) {
        skippedCount++
        continue
      }

      let normalizedWa: string | null = null
      if (p.whatsapp_number?.trim()) {
        const waCheck = parseAndValidatePhone(p.whatsapp_number.trim())
        if (waCheck.valid) normalizedWa = waCheck.normalized
      } else if (p.phone?.trim()) {
        const pCheck = parseAndValidatePhone(p.phone.trim())
        if (pCheck.valid) normalizedWa = pCheck.normalized
      }

      // 1. Insert into businesses
      const { data: business, error: bErr } = await supabase
        .from('businesses')
        .insert({
          business_name: name,
          category: p.category || p.business_type || 'Restaurant or cafe',
          business_type: p.business_type || p.category || 'Restaurant or cafe',
          area: p.area?.trim() || null,
          address: p.address?.trim() || null,
          postcode: p.postcode?.trim() || null,
          phone: p.phone?.trim() || null,
          whatsapp_number: normalizedWa,
          email: p.email?.trim() || null,
          existing_website: p.existing_website?.trim() || null,
          has_no_website: Boolean(p.has_no_website || !p.existing_website),
          maps_link: p.maps_link?.trim() || null,
          google_rating: p.google_rating ?? null,
          google_reviews_count: p.google_reviews_count ?? null,
          contact_name: p.contact_name?.trim() || null,
          source: `Lead Discovery (${p.source_provider || 'Verified Lead'})`,
        })
        .select('id')
        .single()

      if (bErr || !business) {
        console.error('Failed to insert discovered business:', bErr)
        skippedCount++
        continue
      }

      // 2. Insert into opportunities (Needs review stage)
      const { data: opp, error: oErr } = await supabase
        .from('opportunities')
        .insert({
          business_id: business.id,
          stage: 'Needs review',
          services_pitched: [servicePitched || 'Website'],
          assigned_sales_id: user.id,
        })
        .select('id')
        .single()

      if (oErr || !opp) {
        console.error('Failed to insert opportunity for discovered business:', oErr)
        skippedCount++
        continue
      }

      // 3. Create communication threads for provided channels
      const platforms: string[] = []
      if (p.email?.trim()) platforms.push('Email')
      if (normalizedWa) platforms.push('WhatsApp')

      for (const platform of platforms) {
        await supabase.from('threads').insert({
          opportunity_id: opp.id,
          platform,
          status: 'Not contacted',
          step: 0,
          next_due_on: new Date().toISOString().split('T')[0],
        })
      }

      importedCount++
    }

    revalidatePath('/dashboard/leads')
    revalidatePath('/dashboard/discovery')
    revalidatePath('/dashboard')

    return {
      success: true,
      importedCount,
      skippedCount,
    }
  } catch (err: any) {
    console.error('importDiscoveredProspects error:', err)
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      error: err.message || 'Failed to import discovered prospects.',
    }
  }
}
