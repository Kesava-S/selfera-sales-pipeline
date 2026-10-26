// Services, outreach platforms and lead categories, as loaded from the
// database ("sales-pipe".services, outreach_platforms, business_categories).
// Safe to use in the browser: loading happens in src/lib/dynamicData.ts and the
// lists reach screens through ListsProvider (src/components/ListsContext.tsx).

import { CONFIG, LEAD_CATEGORIES } from '@/lib/config'

export type ListCategory = {
  name: string
  slug: string
  description: string | null
  icon_name: string | null
  synonyms: string[]
}

export type ListPlatform = { name: string; slug: string }

export type SalesLists = {
  services: string[]
  platforms: ListPlatform[]
  categories: ListCategory[]
}

// The channels the app can send on (the database checks the same set).
// outreach_platforms decides which of these are switched on, and their order.
export const SUPPORTED_PLATFORMS: readonly string[] = CONFIG.PLATFORMS

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Used only if the database can't be reached
export const DEFAULT_LISTS: SalesLists = {
  services: [...CONFIG.SERVICES],
  platforms: CONFIG.PLATFORMS.map(name => ({ name, slug: name.toLowerCase() })),
  categories: LEAD_CATEGORIES.map(name => ({ name, slug: slugify(name), description: null, icon_name: null, synonyms: [name.toLowerCase()] })),
}

export const categoryNames = (lists: SalesLists) => lists.categories.map(c => c.name)

export function categoryFromSlug(lists: SalesLists, slug: string): string | null {
  const clean = decodeURIComponent(slug).toLowerCase().trim()
  const hit = lists.categories.find(c => c.slug === clean || c.name.toLowerCase() === clean || slugify(c.name) === slugify(clean))
  // Older links used other spellings ("hotels", "restaurants-and-cafes")
  return hit?.name ?? matchCategory(lists, clean.replace(/-/g, ' '))
}

export function categorySlug(lists: SalesLists, name: string): string {
  return lists.categories.find(c => c.name === name)?.slug ?? slugify(name)
}

export function platformFromSlug(lists: SalesLists, slug: string): string | null {
  const clean = decodeURIComponent(slug).toLowerCase().trim()
  return lists.platforms.find(p => p.slug === clean || p.name.toLowerCase() === clean)?.name ?? null
}

/** The category a typed business type means (name, slug or a known spelling), or null. */
export function matchCategory(lists: SalesLists, value: string): string | null {
  const v = norm(value || '')
  if (!v) return null
  const hit = lists.categories.find(c =>
    norm(c.name) === v || norm(c.slug) === v || c.synonyms.some(s => norm(s) === v)
  )
  return hit?.name ?? null
}
