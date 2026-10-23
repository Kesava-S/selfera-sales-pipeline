import { createServiceClient } from '@/lib/supabase/server'
import { CONFIG, LEAD_CATEGORIES, type LeadCategory } from '@/lib/config'

export interface DynamicCategory {
  id: string
  name: string
  slug: string
  icon_name: string
  description: string | null
  synonyms: string[]
  is_active: boolean
  sort_order: number
}

export interface DynamicService {
  id: string
  name: string
  code: string
  description: string | null
  price_range: string | null
  is_active: boolean
  sort_order: number
}

export interface DynamicPlatform {
  id: string
  name: string
  slug: string
  is_direct_send: boolean
  daily_limit: number
  is_active: boolean
  sort_order: number
}

export interface DynamicSetting<T = any> {
  key: string
  value: T
  description?: string | null
}

/**
 * Fetch dynamic business categories from database with static fallback
 */
export async function getDynamicCategories(): Promise<DynamicCategory[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('sales-pipe')
      .from('business_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      throw error || new Error('No categories returned')
    }

    return data as DynamicCategory[]
  } catch {
    // Fallback to static defaults
    return LEAD_CATEGORIES.map((cat, i) => ({
      id: `fallback-${i}`,
      name: cat,
      slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon_name: 'Building2',
      description: null,
      synonyms: [cat.toLowerCase()],
      is_active: true,
      sort_order: i + 1,
    }))
  }
}

/**
 * Fetch dynamic services from database with static fallback
 */
export async function getDynamicServices(): Promise<DynamicService[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('sales-pipe')
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      throw error || new Error('No services returned')
    }

    return data as DynamicService[]
  } catch {
    // Fallback to static defaults
    return CONFIG.SERVICES.map((s, i) => ({
      id: `fallback-${i}`,
      name: s,
      code: s.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      description: null,
      price_range: null,
      is_active: true,
      sort_order: i + 1,
    }))
  }
}

/**
 * Fetch dynamic outreach platforms from database with static fallback
 */
export async function getDynamicPlatforms(): Promise<DynamicPlatform[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('sales-pipe')
      .from('outreach_platforms')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      throw error || new Error('No platforms returned')
    }

    return data as DynamicPlatform[]
  } catch {
    // Fallback to static defaults
    return CONFIG.PLATFORMS.map((p, i) => ({
      id: `fallback-${i}`,
      name: p,
      slug: p.toLowerCase(),
      is_direct_send: p === 'WhatsApp' || p === 'Email',
      daily_limit: 100,
      is_active: true,
      sort_order: i + 1,
    }))
  }
}

/**
 * Fetch a pipeline setting by key with fallback
 */
export async function getPipelineSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('sales-pipe')
      .from('pipeline_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error || !data) return fallback
    return data.value as T
  } catch {
    return fallback
  }
}
