import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { CONFIG, LEAD_CATEGORIES } from '@/lib/config'
import { SUPPORTED_PLATFORMS, type SalesLists } from '@/lib/lists'

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
 * Services, platforms and categories that are switched on, in order.
 * Cached across requests for 5 minutes with fallback to static defaults.
 */
const fetchSalesLists = async (): Promise<SalesLists> => {
  const [services, platforms, categories] = await Promise.all([
    getDynamicServices(),
    getDynamicPlatforms(),
    getDynamicCategories(),
  ])
  return {
    services: services.map(s => s.name),
    platforms: platforms
      .filter(p => SUPPORTED_PLATFORMS.includes(p.name))
      .map(p => ({ name: p.name, slug: p.slug })),
    categories: categories.map(c => ({
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon_name: c.icon_name,
      synonyms: c.synonyms || [],
    })),
  }
}

export const getSalesLists = unstable_cache(
  fetchSalesLists,
  ['sales-lists'],
  { revalidate: 300, tags: ['sales-lists'] }
)

const fetchPipelineSetting = async (key: string): Promise<any> => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .schema('sales-pipe')
      .from('pipeline_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error || !data) return null
    return data.value
  } catch {
    return null
  }
}

const getCachedSetting = unstable_cache(
  fetchPipelineSetting,
  ['pipeline-setting'],
  { revalidate: 300 }
)

/**
 * Fetch a pipeline setting by key with fallback (cached for 5 minutes)
 */
export async function getPipelineSetting<T>(key: string, fallback: T): Promise<T> {
  const val = await getCachedSetting(key)
  return val !== null && val !== undefined ? (val as T) : fallback
}
