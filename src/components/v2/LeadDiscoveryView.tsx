'use client'

import React, { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  ArrowRight,
  CheckSquare,
  Square,
  RefreshCw,
  ExternalLink,
  X,
  Star,
  User,
  RotateCcw,
  Info,
  Building2,
  ShieldCheck,
  Sparkles,
  History,
  Trash2,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react'
import {
  importDiscoveredProspects,
  discoverProspectsWithFirecrawl,
  getSerpApiBalance,
  type DiscoveredProspect,
  type SerpApiAccountInfo,
} from '@/app/dashboard/discovery/actions'
import { toast } from '@/components/ui'
import type { ListCategory } from '@/lib/lists'

interface LeadDiscoveryViewProps {
  categories: ListCategory[]
  services: string[]
  existingBusinessCount: number
  isFirecrawlConfigured?: boolean
  initialSerpApiBalance?: SerpApiAccountInfo | null
}

type ResultFilter = 'all' | 'growing-sme' | 'with-phone' | 'with-email' | 'with-website' | 'no-website' | 'with-owner'

interface SearchHistoryItem {
  id: string
  timestamp: number
  query: string
  city: string
  postcode: string
  category: string
  prospects: DiscoveredProspect[]
  smeOnly?: boolean
}

const STORAGE_KEY = 'selfera_discovery_search_history_v1'

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatWebsiteDisplay(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./i, '')
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].split('?')[0]
  }
}

export function LeadDiscoveryView({
  categories,
  services,
  existingBusinessCount,
  initialSerpApiBalance,
}: LeadDiscoveryViewProps) {
  // Search parameters (Default location fixed to London)
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('London')
  const [postcode, setPostcode] = useState('')
  const [category, setCategory] = useState('All Categories')
  const [smeOnly, setSmeOnly] = useState(true)

  // SerpApi Search Balance State
  const [serpBalance, setSerpBalance] = useState<SerpApiAccountInfo | null>(initialSerpApiBalance || null)
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)

  const refreshBalance = async () => {
    setIsRefreshingBalance(true)
    try {
      const bal = await getSerpApiBalance()
      if (bal) {
        setSerpBalance(bal)
        toast.success(`SerpApi balance: ${bal.total_searches_left} searches remaining`)
      }
    } catch {
      toast.error('Unable to fetch SerpApi balance')
    } finally {
      setIsRefreshingBalance(false)
    }
  }

  // Detailed SME Growth & Quality Filters
  const [showFilters, setShowFilters] = useState(false)
  const [reviewRange, setReviewRange] = useState<'all' | '10-150' | '5-50' | '50-250' | 'under-10'>('all')
  const [ratingRange, setRatingRange] = useState<'all' | '3.5-4.8' | '4.0-plus' | 'under-4.2'>('all')
  const [companyAge, setCompanyAge] = useState<'all' | '1-5' | '1-10' | '10-plus'>('all')
  const [companyTypeFilter, setCompanyTypeFilter] = useState<'all' | 'ltd'>('all')
  const [requirePhone, setRequirePhone] = useState(false)
  const [requireWebsite, setRequireWebsite] = useState(false)
  const [requireDirector, setRequireDirector] = useState(false)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (reviewRange !== 'all') count++
    if (ratingRange !== 'all') count++
    if (companyAge !== 'all') count++
    if (companyTypeFilter !== 'all') count++
    if (requirePhone) count++
    if (requireWebsite) count++
    if (requireDirector) count++
    return count
  }, [reviewRange, ratingRange, companyAge, companyTypeFilter, requirePhone, requireWebsite, requireDirector])

  const clearAllFilters = () => {
    setReviewRange('all')
    setRatingRange('all')
    setCompanyAge('all')
    setCompanyTypeFilter('all')
    setRequirePhone(false)
    setRequireWebsite(false)
    setRequireDirector(false)
  }

  // Search History State (persisted in localStorage)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [showHistoryMenu, setShowHistoryMenu] = useState(false)

  // Scraped Prospects & State
  const [prospects, setProspects] = useState<DiscoveredProspect[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isLastSearch, setIsLastSearch] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [pitchedService, setPitchedService] = useState(services[0] || 'Website')

  // Result quick filtering
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')

  // Modal inspection state
  const [modalProspect, setModalProspect] = useState<DiscoveredProspect | null>(null)

  // Async States
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Load persistent search history on mount and restore last search
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: SearchHistoryItem[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed)
          // Automatically restore latest search on initial load
          const latest = parsed[0]
          if (latest.prospects && latest.prospects.length > 0) {
            setProspects(latest.prospects)
            setQuery(latest.query || '')
            setCity(latest.city || 'London')
            setPostcode(latest.postcode || '')
            setCategory(latest.category || 'All Categories')
            if (typeof latest.smeOnly === 'boolean') {
              setSmeOnly(latest.smeOnly)
            }
            setHasSearched(true)
            setIsLastSearch(true)
          }
        }
      }
    } catch {
      // Non-fatal if localStorage is restricted
    }
  }, [])

  const saveToHistory = (item: SearchHistoryItem) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (h) =>
          !(
            h.query.toLowerCase() === item.query.toLowerCase() &&
            h.city.toLowerCase() === item.city.toLowerCase() &&
            h.postcode.toLowerCase() === item.postcode.toLowerCase() &&
            h.category === item.category &&
            h.smeOnly === item.smeOnly
          )
      )
      const updated = [item, ...filtered].slice(0, 10)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // quota safety
      }
      return updated
    })
  }

  const restoreHistoryItem = (item: SearchHistoryItem) => {
    setQuery(item.query)
    setCity(item.city)
    setPostcode(item.postcode)
    setCategory(item.category)
    if (typeof item.smeOnly === 'boolean') {
      setSmeOnly(item.smeOnly)
    }
    setProspects(item.prospects)
    setSelectedIds(new Set())
    setHasSearched(true)
    setIsLastSearch(true)
    setShowHistoryMenu(false)
    toast.success(`Restored ${item.prospects.length} prospects from history.`)
  }

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    setShowHistoryMenu(false)
    toast.info('Search history cleared.')
  }

  const availableCategories = useMemo(() => {
    return ['All Categories', ...categories.map((c) => c.name)]
  }, [categories])

  const hasFilters = query.trim() !== '' || city.trim() !== 'London' || postcode.trim() !== '' || category !== 'All Categories'

  // Search action
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSearching) return
    if (!query.trim() && !city.trim() && !postcode.trim() && category === 'All Categories') {
      toast.error('Please enter a search keyword, city, postcode, or directory URL.')
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    setIsLastSearch(false)

    try {
      const res = await discoverProspectsWithFirecrawl({
        query: query.trim(),
        city: city.trim() || undefined,
        postcode: postcode.trim() || undefined,
        category,
        url: query.trim().startsWith('http') ? query.trim() : undefined,
        smeOnly,
      })

      if (res.success) {
        setProspects(res.prospects)
        setSelectedIds(new Set())
        if (res.serpApiBalance) {
          setSerpBalance(res.serpApiBalance)
        }
        if (res.prospects.length > 0) {
          saveToHistory({
            id: `search-${Date.now()}`,
            timestamp: Date.now(),
            query: query.trim(),
            city: city.trim() || 'London',
            postcode: postcode.trim(),
            category,
            prospects: res.prospects,
            smeOnly,
          })
          toast.success(`Found ${res.prospects.length} prospects.`)
        } else {
          toast.error(res.message || 'No prospects found matching your search.')
        }
      } else {
        toast.error(res.error || 'Search failed.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error executing search.')
    } finally {
      setIsSearching(false)
    }
  }

  // Reset inputs only (preserves extracted prospects data)
  const handleReset = () => {
    setQuery('')
    setCity('London')
    setPostcode('')
    setCategory('All Categories')
    setSmeOnly(true)
    clearAllFilters()
    setIsLastSearch(true)
    toast.info('Search inputs reset to London default. Last extracted scrape results are kept.')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const unimported = prospects.filter((p) => !importedIds.has(p.id))
    if (selectedIds.size === unimported.length && unimported.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unimported.map((p) => p.id)))
    }
  }

  const handleImport = (prospectsToImport: DiscoveredProspect[]) => {
    if (prospectsToImport.length === 0) return

    startTransition(async () => {
      try {
        const res = await importDiscoveredProspects(prospectsToImport, pitchedService)
        if (res.success) {
          toast.success(
            `Imported ${res.importedCount} ${res.importedCount === 1 ? 'prospect' : 'prospects'} to Needs Review.`
          )
          setImportedIds((prev) => {
            const next = new Set(prev)
            prospectsToImport.forEach((p) => next.add(p.id))
            return next
          })
          setSelectedIds((prev) => {
            const next = new Set(prev)
            prospectsToImport.forEach((p) => next.delete(p.id))
            return next
          })
        } else {
          toast.error(res.error || 'Failed to import prospects.')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error importing prospects.')
      }
    })
  }

  // Filtered prospects list based on quick filter selection & detailed growth filters
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      // 1. Quick pill filter tab
      if (resultFilter === 'growing-sme' && !p.is_sme) return false
      if (resultFilter === 'with-phone' && !p.phone) return false
      if (resultFilter === 'with-email' && !p.email) return false
      if (resultFilter === 'with-website' && !p.existing_website) return false
      if (resultFilter === 'no-website' && p.existing_website) return false
      if (resultFilter === 'with-owner' && !p.contact_name) return false

      // 2. Growing SME general toggle
      if (smeOnly && !p.is_sme) return false

      // 3. Review Count Range
      const reviews = typeof p.google_reviews_count === 'number' ? p.google_reviews_count : 0
      if (reviewRange === '10-150' && (reviews < 10 || reviews > 150)) return false
      if (reviewRange === '5-50' && (reviews < 5 || reviews > 50)) return false
      if (reviewRange === '50-250' && (reviews < 50 || reviews > 250)) return false
      if (reviewRange === 'under-10' && reviews >= 10) return false

      // 4. Rating Range
      const rating = typeof p.google_rating === 'number' ? p.google_rating : 0
      if (ratingRange === '3.5-4.8' && (rating < 3.5 || rating > 4.8)) return false
      if (ratingRange === '4.0-plus' && rating < 4.0) return false
      if (ratingRange === 'under-4.2' && (rating === 0 || rating >= 4.2)) return false

      // 5. Company Age
      const age = typeof p.company_age_years === 'number' ? p.company_age_years : null
      if (companyAge === '1-5' && (age === null || age < 1 || age > 5)) return false
      if (companyAge === '1-10' && (age === null || age < 1 || age > 10)) return false
      if (companyAge === '10-plus' && (age === null || age < 10)) return false

      // 6. Business Structure
      if (companyTypeFilter === 'ltd') {
        const ct = p.company_type?.toLowerCase() || ''
        if (!ct.includes('limited') && !ct.includes('ltd')) return false
      }

      // 7. Contact Must Haves
      if (requirePhone && !p.phone) return false
      if (requireWebsite && !p.existing_website) return false
      if (requireDirector && !p.contact_name) return false

      return true
    })
  }, [
    prospects,
    resultFilter,
    smeOnly,
    reviewRange,
    ratingRange,
    companyAge,
    companyTypeFilter,
    requirePhone,
    requireWebsite,
    requireDirector,
  ])

  // Counts for filter pills
  const filterCounts = useMemo(() => {
    return {
      all: prospects.length,
      growingSme: prospects.filter((p) => Boolean(p.is_sme)).length,
      withPhone: prospects.filter((p) => Boolean(p.phone)).length,
      withEmail: prospects.filter((p) => Boolean(p.email)).length,
      withWebsite: prospects.filter((p) => Boolean(p.existing_website)).length,
      noWebsite: prospects.filter((p) => !p.existing_website).length,
      withOwner: prospects.filter((p) => Boolean(p.contact_name)).length,
    }
  }, [prospects])

  return (
    <div className={`space-y-6 ${selectedIds.size > 0 ? 'pb-24' : ''}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead Discovery</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Discover local businesses and import verified prospects directly into your sales pipeline.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/dashboard/discovery/history"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <History size={14} className="text-slate-500" />
            <span>Search History</span>
          </Link>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-xs">
            <span className="text-sm font-medium text-slate-500">Pipeline Leads:</span>
            <span className="text-lg font-bold text-slate-900">
              {existingBusinessCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Search Area with London default, Postcode & Category filters */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs"
      >
        {/* Row 1: Aligned Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          {/* 1. Keyword search (4 cols on lg) */}
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search keyword (e.g. Dentist, Plumber, Cafe) or website URL..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* 2. City: London as default (2 cols on lg) */}
          <div className="relative sm:col-span-1 lg:col-span-2">
            <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (default: London)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* 3. Postcode (2 cols on lg) */}
          <div className="relative sm:col-span-1 lg:col-span-2">
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Postcode (e.g. NW1)"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* 4. Category Dropdown (2 cols on lg) */}
          <div className="relative sm:col-span-1 lg:col-span-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Actions: Reset & Search (2 cols on lg) */}
          <div className="flex items-center gap-2 sm:col-span-1 lg:col-span-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSearching}
              className="h-10 px-3 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
              title="Reset search inputs and filters to default"
            >
              <RotateCcw size={13} className="text-slate-400" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              disabled={isSearching}
              className="h-10 flex-1 min-w-[90px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover active:scale-[0.98] disabled:opacity-75 disabled:cursor-wait transition-all"
            >
              {isSearching ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={13} />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Toolbar (Toggles & Filter Status) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Growing SME Filter Toggle */}
            <button
              type="button"
              onClick={() => setSmeOnly(!smeOnly)}
              className={`h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold border transition-all ${
                smeOnly
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs ring-1 ring-emerald-400/30'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title={smeOnly ? 'Filtering for growing SMEs (5-150 reviews, excluding chains)' : 'Showing all businesses including large chains'}
            >
              <TrendingUp size={12} className={smeOnly ? 'text-emerald-700' : 'text-slate-400'} />
              <span>Growing SMEs Only</span>
              <span className={`h-1.5 w-1.5 rounded-full ${smeOnly ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>

            {/* More Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold border transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-2xs ring-1 ring-sky-400/30'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Toggle detailed filters for reviews, rating, age, and contact requirements"
            >
              <SlidersHorizontal size={12} className={showFilters || activeFilterCount > 0 ? 'text-sky-700' : 'text-slate-500'} />
              <span>More Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-sky-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-1"
              >
                Clear all filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* SerpApi Balance badge in the filters toolbar */}
          {serpBalance && (
            <div
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-700 shadow-2xs"
              title={`SerpApi: ${serpBalance.total_searches_left} remaining of ${serpBalance.searches_per_month} searches (${serpBalance.plan_name}). Reset date: ${serpBalance.plan_renewal_date || 'Monthly'}`}
            >
              <span className="text-[11px] font-medium text-slate-500">SerpApi Balance:</span>
              <span className={`font-bold ${serpBalance.total_searches_left <= 25 ? 'text-amber-600' : 'text-slate-900'}`}>
                {serpBalance.total_searches_left.toLocaleString()} / {serpBalance.searches_per_month}
              </span>
              <button
                type="button"
                onClick={refreshBalance}
                disabled={isRefreshingBalance}
                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded cursor-pointer ml-0.5"
                title="Refresh SerpApi search balance"
              >
                <RefreshCw size={11} className={isRefreshingBalance ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        {/* Detailed SME & Quality Filters Panel */}
        {showFilters && (
          <div className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3.5 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                SME Growth and Quality Filters
              </span>
              <div className="flex items-center gap-3">
                {serpBalance && (
                  <span className="text-[11px] text-slate-500">
                    Remaining Quota: <strong className="text-slate-800">{serpBalance.total_searches_left}</strong> / {serpBalance.searches_per_month} searches
                  </span>
                )}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Reset all ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Review Count Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Review Count Range
                </label>
                <select
                  value={reviewRange}
                  onChange={(e) => setReviewRange(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All Review Counts</option>
                  <option value="10-150">10 - 150 reviews (SME Sweet Spot)</option>
                  <option value="5-50">5 - 50 reviews (Early Traction)</option>
                  <option value="50-250">50 - 250 reviews (Scaling)</option>
                  <option value="under-10">Under 10 reviews (New/Emerging)</option>
                </select>
              </div>

              {/* 2. Rating Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Google Star Rating
                </label>
                <select
                  value={ratingRange}
                  onChange={(e) => setRatingRange(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All Star Ratings</option>
                  <option value="3.5-4.8">3.5 - 4.8 stars (Opportunity Sweet Spot)</option>
                  <option value="4.0-plus">4.0+ stars (High Rated)</option>
                  <option value="under-4.2">Under 4.2 stars (Review Pitch Target)</option>
                </select>
              </div>

              {/* 3. Company Age (Companies House) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Company Age (UK Registry)
                </label>
                <select
                  value={companyAge}
                  onChange={(e) => setCompanyAge(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All Company Ages</option>
                  <option value="1-5">1 - 5 Years (Growth Phase)</option>
                  <option value="1-10">1 - 10 Years (Established SME)</option>
                  <option value="10-plus">Over 10 Years (Legacy)</option>
                </select>
              </div>

              {/* 4. Company Structure */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Business Structure
                </label>
                <select
                  value={companyTypeFilter}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All Business Structures</option>
                  <option value="ltd">Active LTD (Private Limited) Only</option>
                </select>
              </div>
            </div>

            {/* Verification & Must-Have Toggles */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                  Contact Must-Haves:
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                    requirePhone
                      ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-2xs font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={requirePhone}
                      onChange={(e) => setRequirePhone(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                    />
                    <span>Phone / WhatsApp</span>
                  </label>

                  <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                    requireWebsite
                      ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-2xs font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={requireWebsite}
                      onChange={(e) => setRequireWebsite(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                    />
                    <span>Website</span>
                  </label>

                  <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                    requireDirector
                      ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-2xs font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={requireDirector}
                      onChange={(e) => setRequireDirector(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                    />
                    <span>Director / Owner on record</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Results Container with subtle thin accent line when viewing previous search */}
      <div
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all ${
          prospects.length > 0 && isLastSearch ? 'border-t-2 border-t-primary' : ''
        }`}
      >
        {/* Minimal thin-line indicator for previous search */}
        {prospects.length > 0 && isLastSearch && (
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-medium text-slate-600">Previous search results</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {prospects.length} {prospects.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
        )}

        {/* Quick Filter Bar & Bulk Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={prospects.length === 0}
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
            >
              {selectedIds.size > 0 && selectedIds.size === prospects.filter((p) => !importedIds.has(p.id)).length ? (
                <CheckSquare size={16} className="text-sky-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>Select All</span>
            </button>

            {/* Quick Result Filter Tabs */}
            {prospects.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => setResultFilter('all')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({filterCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('growing-sme')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'growing-sme'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/70 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Growing SMEs ({filterCounts.growingSme})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('with-phone')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'with-phone'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  With Phone ({filterCounts.withPhone})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('with-email')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'with-email'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  With Email ({filterCounts.withEmail})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('with-website')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'with-website'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  With Website ({filterCounts.withWebsite})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('no-website')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'no-website'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  No Website ({filterCounts.noWebsite})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('with-owner')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    resultFilter === 'with-owner'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  With Owner ({filterCounts.withOwner})
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 shrink-0">
            {importedIds.size > 0 && (
              <span className="font-semibold text-emerald-700 mr-2">
                {importedIds.size} imported
              </span>
            )}
            <span>
              {filteredProspects.length} {filteredProspects.length === 1 ? 'business' : 'businesses'}
            </span>
          </div>
        </div>

        {/* Prospects Card Grid */}
        <div>
          {filteredProspects.length === 0 ? (
            <div className="p-14 text-center">
              {hasSearched ? (
                <div>
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2.5">
                    <Search size={18} />
                  </div>
                  <p className="font-semibold text-slate-700 text-sm">No businesses found</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                    Try adjusting your keyword, postcode, or city to discover more prospects.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-bg text-primary mb-2.5">
                    <Search size={18} />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">Ready to Discover Leads</p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Enter a keyword, business name, or directory URL above to scrape and discover live prospects.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5 p-4 bg-slate-50/50">
              {filteredProspects.map((p) => {
                const isSelected = selectedIds.has(p.id)
                const isImported = importedIds.has(p.id)

                return (
                  <div
                    key={p.id}
                    className={`w-full rounded-xl border p-4 transition-all shadow-2xs ${
                      isSelected
                        ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/30'
                        : isImported
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Checkbox, Business Name, Badges, Rating & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          disabled={isImported}
                          onClick={() => toggleSelect(p.id)}
                          className="text-slate-400 hover:text-slate-600 disabled:opacity-40 shrink-0"
                          title={isImported ? 'Already imported' : isSelected ? 'Deselect' : 'Select'}
                        >
                          {isImported ? (
                            <CheckCircle2 size={18} className="text-emerald-600" />
                          ) : isSelected ? (
                            <CheckSquare size={18} className="text-sky-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <h3 className="font-bold text-slate-900 text-base" title={p.business_name}>
                            {p.business_name}
                          </h3>
                          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            {p.category}
                          </span>
                          <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                            Verified Lead
                          </span>
                          {p.is_sme && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200/60">
                              <TrendingUp size={11} className="text-emerald-700" /> Growing SME
                            </span>
                          )}
                          {typeof p.company_age_years === 'number' && p.company_age_years > 0 && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Est. {p.company_incorporated?.slice(0, 4)} ({p.company_age_years} yrs)
                            </span>
                          )}
                          {typeof p.google_rating === 'number' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200/50">
                              <Star size={12} className="fill-amber-400 text-amber-400" />
                              {p.google_rating}
                              {p.google_reviews_count ? ` (${p.google_reviews_count} reviews)` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Card Actions */}
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setModalProspect(p)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="View complete details and registry profile"
                        >
                          <Info size={13} className="text-slate-400" />
                          <span>Details</span>
                        </button>

                        {isImported ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} />
                            Added to Leads
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleImport([p])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors"
                          >
                            <span>Push to Leads</span>
                            <ArrowRight size={13} className="text-slate-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Details Grid across the full row: One by One arrangement */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 pt-3.5 text-xs">
                      {/* 1. Owner / Director (Prioritized first, never hidden) */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <User size={15} className="text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Owner / Director
                          </span>
                          {p.contact_name ? (
                            <span
                              className="inline-block rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-900 text-xs break-words border border-slate-200/70"
                              title={p.contact_name}
                            >
                              {p.contact_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not on public record</span>
                          )}
                        </div>
                      </div>

                      {/* 2. Phone Number */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Phone size={15} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Phone
                          </span>
                          {p.phone ? (
                            <a
                              href={`tel:${p.phone}`}
                              className="font-semibold text-slate-800 hover:text-primary transition-colors block break-words"
                            >
                              {p.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No phone available</span>
                          )}
                        </div>
                      </div>

                      {/* 3. Email */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Mail size={15} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Email
                          </span>
                          {p.email ? (
                            <a
                              href={`mailto:${p.email}`}
                              className="font-semibold text-slate-800 hover:text-primary transition-colors block break-all"
                              title={p.email}
                            >
                              {p.email}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">No email on file</span>
                          )}
                        </div>
                      </div>

                      {/* 4. Website */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Globe size={15} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Website
                          </span>
                          {p.existing_website ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="font-semibold text-slate-800 break-words"
                                title={p.existing_website}
                              >
                                {formatWebsiteDisplay(p.existing_website)}
                              </span>
                              <a
                                href={p.existing_website.startsWith('http') ? p.existing_website : `https://${p.existing_website}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium transition-colors shrink-0"
                                title={`Direct to website: ${p.existing_website}`}
                              >
                                <span>Direct in website</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No website</span>
                          )}
                        </div>
                      </div>

                      {/* 5. Location with Postcode */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Location
                          </span>
                          <span className="text-slate-700 font-medium leading-relaxed block break-words" title={p.address || p.area}>
                            {p.address || p.area}
                            {p.postcode ? (
                              <strong className="text-slate-900 ml-1">({p.postcode})</strong>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Opportunity Strip (if signal present) */}
                    {p.opportunity_signal && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={13} className="text-amber-500 shrink-0" />
                          <span className="font-semibold text-amber-900">Opportunity:</span>
                          <span className="text-amber-800">{p.opportunity_signal}</span>
                        </div>
                        {p.opportunity_pitch && (
                          <span className="text-[11px] text-amber-700 italic hidden md:inline">
                            {p.opportunity_pitch}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Batch Import Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 min-[901px]:left-[280px] min-[901px]:right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white/95 px-5 py-3 text-slate-800 shadow-xl ring-1 ring-slate-900/5 backdrop-blur-md flex-nowrap whitespace-nowrap overflow-x-auto">
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-primary-bg px-2 text-xs font-bold text-primary">
                {selectedIds.size}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {selectedIds.size === 1 ? 'prospect selected' : 'prospects selected'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 ml-1 transition-colors"
              >
                Deselect
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <label htmlFor="batch-pitch-service" className="text-sm font-medium text-slate-600">
                  Pitch Service:
                </label>
                <select
                  id="batch-pitch-service"
                  value={pitchedService}
                  onChange={(e) => setPitchedService(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                >
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const selectedList = prospects.filter((p) => selectedIds.has(p.id))
                  handleImport(selectedList)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 transition-all shrink-0"
              >
                {isPending ? 'Importing...' : `Import ${selectedIds.size} to Leads`}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal View for Google Places & Companies House Enrichment */}
      {modalProspect && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{modalProspect.business_name}</h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {modalProspect.category}
                  </span>
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                    Verified Lead
                  </span>
                  {modalProspect.is_sme && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/60 inline-flex items-center gap-1">
                      <TrendingUp size={12} className="text-emerald-700" /> Growing SME
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed inspection of verified business records and company registration.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalProspect(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Structured Cards */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Card 1: Core Contact & Location */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  <span>Contact & Location</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Address:</span>
                    <span className="font-medium text-slate-800">{modalProspect.address || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Postcode:</span>
                    <span className="font-semibold text-slate-800">{modalProspect.postcode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone:</span>
                    {modalProspect.phone ? (
                      <a href={`tel:${modalProspect.phone}`} className="font-semibold text-slate-800 hover:underline">
                        {modalProspect.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not available</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email:</span>
                    {modalProspect.email ? (
                      <a href={`mailto:${modalProspect.email}`} className="font-semibold text-slate-800 hover:underline">
                        {modalProspect.email}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">No direct email found</span>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Official Website:</span>
                    {modalProspect.existing_website ? (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className="font-semibold text-slate-800 break-words"
                          title={modalProspect.existing_website}
                        >
                          {formatWebsiteDisplay(modalProspect.existing_website)}
                        </span>
                        <a
                          href={modalProspect.existing_website.startsWith('http') ? modalProspect.existing_website : `https://${modalProspect.existing_website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-2 py-0.5 text-xs font-medium transition-colors shrink-0"
                          title={`Direct to website: ${modalProspect.existing_website}`}
                        >
                          <span>Direct in website</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-rose-600 font-medium">No active website detected</span>
                    )}
                  </div>
                  {modalProspect.maps_link && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Google Maps:</span>
                      <a
                        href={modalProspect.maps_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline"
                      >
                        View profile on Google Maps
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Google Reputation & Signals */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Star size={14} className="text-amber-500 fill-amber-400" />
                  <span>Google Reputation & Opportunity</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Google Rating:</span>
                    <span className="font-bold text-slate-800">
                      {typeof modalProspect.google_rating === 'number'
                        ? `${modalProspect.google_rating} / 5.0`
                        : 'No rating available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Reviews:</span>
                    <span className="font-bold text-slate-800">
                      {typeof modalProspect.google_reviews_count === 'number'
                        ? `${modalProspect.google_reviews_count} Google reviews`
                        : 'No reviews'}
                    </span>
                  </div>
                  {modalProspect.opportunity_signal && (
                    <div className="sm:col-span-2 rounded-lg bg-amber-50/70 border border-amber-200/60 p-3">
                      <span className="text-amber-800 font-semibold block text-xs">Identified Opportunity:</span>
                      <p className="text-amber-900 text-xs mt-0.5">{modalProspect.opportunity_signal}</p>
                      <p className="text-amber-700 text-[11px] mt-1 font-medium italic">
                        {modalProspect.opportunity_pitch}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Companies House Registry Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Companies House UK Registry</span>
                </h4>

                {modalProspect.company_number || modalProspect.contact_name ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Company Number:</span>
                      <span className="font-semibold text-slate-800">
                        {modalProspect.company_number || 'Registered Entity'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Company Status:</span>
                      <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {modalProspect.company_status || 'Active'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Company Type:</span>
                      <span className="font-medium text-slate-800">
                        {modalProspect.company_type || 'Private Limited Company'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Active Directors:</span>
                      <span className="font-semibold text-slate-900">
                        {modalProspect.directors_list && modalProspect.directors_list.length > 0
                          ? modalProspect.directors_list.join(', ')
                          : modalProspect.contact_name || 'Not on public record'}
                      </span>
                    </div>
                    {modalProspect.company_incorporated && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Incorporation Date:</span>
                        <span className="font-semibold text-slate-800">
                          {modalProspect.company_incorporated}
                          {typeof modalProspect.company_age_years === 'number' && ` (${modalProspect.company_age_years} yrs)`}
                        </span>
                      </div>
                    )}
                    {modalProspect.registered_address && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[11px]">Registered Office Address:</span>
                        <span className="font-medium text-slate-700">{modalProspect.registered_address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No active Companies House registration matched. Business may operate as an unincorporated sole trader or partnership.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setModalProspect(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                {importedIds.has(modalProspect.id) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    Already In Pipeline
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      handleImport([modalProspect])
                      setModalProspect(null)
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    Push to Leads
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
