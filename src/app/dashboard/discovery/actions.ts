'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireProfile } from '@/lib/auth'
import { parseAndValidatePhone } from '@/lib/contact'
import { applyPhoneDefaults } from '@/lib/dynamicData'

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
}

export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  error?: string
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
          source: `Lead Discovery (${p.source_provider || 'Scraper API'})`,
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
