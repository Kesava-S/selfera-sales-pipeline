'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  History,
  ArrowLeft,
  Trash2,
  Search,
  ExternalLink,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import type { DiscoveredProspect } from '@/app/dashboard/discovery/actions'
import { toast } from '@/components/ui'

interface SearchHistoryItem {
  id: string
  timestamp: number
  query: string
  city: string
  postcode: string
  category: string
  prospects: DiscoveredProspect[]
}

const STORAGE_KEY = 'selfera_discovery_search_history_v1'

export function DiscoveryHistoryView() {
  const router = useRouter()
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch (e) {
      console.warn('Failed to read search history:', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const deleteItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      toast.success('Search removed from history.')
    } catch {
      // Non-fatal
    }
  }

  const clearAll = () => {
    setHistory([])
    try {
      localStorage.removeItem(STORAGE_KEY)
      toast.info('Search history cleared.')
    } catch {
      // Non-fatal
    }
  }

  const loadSearch = (item: SearchHistoryItem) => {
    // Put selected item at the top of history so LeadDiscoveryView restores it
    const reordered = [item, ...history.filter((h) => h.id !== item.id)]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reordered))
    } catch {
      // Non-fatal
    }
    router.push('/dashboard/discovery')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/discovery"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Lead Discovery</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Search History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review past scraped searches, inspect discovered businesses, and reload results without re-consuming API credits.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 transition-colors shrink-0 self-start sm:self-auto"
          >
            <Trash2 size={13} />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* History Items Container */}
      {!isLoaded ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          Loading history...
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <History size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Search History Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Your Lead Discovery searches and their results are saved here.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/discovery"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
            >
              <Search size={14} />
              <span>Start a Discovery Search</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {history.map((h) => {
            const dateStr = new Date(h.timestamp).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            const queryLabel = h.query ? `"${h.query}"` : 'All Businesses'
            const locationLabel = [h.city, h.postcode].filter(Boolean).join(', ')

            return (
              <div
                key={h.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-2 min-w-0">
                  {/* Title Line */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {queryLabel}
                    </span>
                    {locationLabel && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                        <MapPin size={12} className="text-slate-400" />
                        {locationLabel}
                      </span>
                    )}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {h.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 ml-1">
                      <Calendar size={11} />
                      {dateStr}
                    </span>
                  </div>

                  {/* Discovered Leads Preview */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 text-[11px]">
                      {h.prospects.length} {h.prospects.length === 1 ? 'lead saved' : 'leads saved'}
                    </span>
                    {h.prospects.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className="rounded bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 truncate max-w-[200px]"
                      >
                        {p.business_name}
                      </span>
                    ))}
                    {h.prospects.length > 3 && (
                      <span className="text-[11px] text-slate-400 italic">
                        +{h.prospects.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2 self-start md:self-center">
                  <button
                    type="button"
                    onClick={() => deleteItem(h.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                    title="Remove from history"
                  >
                    <Trash2 size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => loadSearch(h)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover active:scale-[0.98] transition-all"
                  >
                    <span>View in Discovery</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
