'use server'

// Lead Lookup: search Google Places and Companies House
// for a business, then copy the chosen values onto a lead.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { searchCompanies, searchPlaces, type CompanyResult, type LookupField, type PlaceResult, type Suggestion } from '@/lib/enrich'
import type { ActionResult } from '@/app/dashboard/actions'
import { getSalesLists } from '@/lib/dynamicData'
import { categoryNames } from '@/lib/lists'

export type LookupResults = {
  places: PlaceResult[]
  companies: CompanyResult[]
  errors: { places?: string; companies?: string }
}

async function isStaff() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_user_role')
  return Boolean(data)
}

export async function lookupBusiness(query: string): Promise<ActionResult<LookupResults>> {
  const q = query.trim()
  if (q.length < 2) return { ok: false, error: 'Type a business name to search.' }
  if (!(await isStaff())) return { ok: false, error: 'You do not have permission to do this.' }

  // Each source can fail on its own (no key, quota, outage) without hiding the other
  const [places, companies] = await Promise.allSettled([searchPlaces(q), searchCompanies(q)])
  const message = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : 'Lookup failed.')
  return {
    ok: true,
    data: {
      places: places.status === 'fulfilled' ? places.value : [],
      companies: companies.status === 'fulfilled' ? companies.value : [],
      errors: {
        places: places.status === 'rejected' ? message(places) : undefined,
        companies: companies.status === 'rejected' ? message(companies) : undefined,
      },
    },
  }
}

const COMPANY_TYPES = ['Limited company', 'Sole trader', 'Partnership', 'Unknown']
const TEXT_FIELDS: LookupField[] = ['address', 'postcode', 'area', 'phone', 'existing_website', 'maps_link', 'contact_name']

export async function applyLookup(businessId: string, values: Suggestion): Promise<ActionResult> {
  const clean: Record<string, string | number | boolean | null> = {}

  for (const f of TEXT_FIELDS) {
    const v = values[f]
    if (typeof v === 'string' && v.trim()) clean[f] = f === 'postcode' ? v.trim().toUpperCase() : v.trim()
  }
  if (values.google_rating !== undefined) {
    const n = Number(values.google_rating)
    if (Number.isFinite(n) && n >= 0 && n <= 5) clean.google_rating = n
  }
  if (values.google_reviews_count !== undefined) {
    const n = Math.round(Number(values.google_reviews_count))
    if (Number.isFinite(n) && n >= 0) clean.google_reviews_count = n
  }
  if (typeof values.business_type === 'string' && categoryNames(await getSalesLists()).includes(values.business_type)) clean.business_type = values.business_type
  if (typeof values.company_type === 'string' && COMPANY_TYPES.includes(values.company_type)) clean.company_type = values.company_type
  // A website was found, so the lead no longer counts as "no website"
  if (clean.existing_website) clean.has_no_website = false

  if (!Object.keys(clean).length) return { ok: false, error: 'Pick at least one value to apply.' }

  const supabase = await createClient()
  const { error, count } = await supabase.from('businesses').update(clean, { count: 'exact' }).eq('id', businessId)
  if (error) {
    if (/duplicate key/i.test(error.message)) return { ok: false, error: 'Another lead already uses this phone number.' }
    if (/postcode/i.test(error.message)) return { ok: false, error: 'The postcode was not accepted.' }
    return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/i, '') }
  }
  if (count === 0) return { ok: false, error: 'You cannot edit this lead.' }

  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
