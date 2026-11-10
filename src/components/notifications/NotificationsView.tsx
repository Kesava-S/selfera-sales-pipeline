'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  Check,
  Search,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  CalendarCheck,
  CalendarX,
  UserCheck,
  UserPlus,
  TrendingUp,
  UserMinus,
  Inbox,
  Filter,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead } from '@/app/dashboard/actions'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/components/v2/Toast'
import { Spinner } from '@/components/ui'
import { Note, getNotificationVisuals, formatRelativeTime } from '@/components/NotificationBell'

export function NotificationsView({
  initialNotifications,
  userId,
}: {
  initialNotifications: Note[]
  userId: string
}) {
  const [items, setItems] = useState<Note[]>(initialNotifications)
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setItems(data as Note[])
  }, [userId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'sales-pipe', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [load, userId])

  const unreadCount = useMemo(() => items.filter(n => !n.is_read).length, [items])
  const readCount = useMemo(() => items.filter(n => n.is_read).length, [items])

  const handleMarkIndividualRead = async (id: string) => {
    setLoadingActionId(id)
    // Optimistic update
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    try {
      const res = await markNotificationRead(id)
      if (!res.ok) throw new Error(res.error)
      toast.success('Notification marked as read.')
    } catch {
      toast.error('Could not update notification. Please try again.')
      load()
    } finally {
      setLoadingActionId(null)
    }
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(n => {
      if (filterTab === 'unread' && n.is_read) return false
      if (filterTab === 'read' && !n.is_read) return false
      if (typeFilter !== 'all' && n.type !== typeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = n.title?.toLowerCase().includes(q)
        const matchMessage = n.message?.toLowerCase().includes(q)
        if (!matchTitle && !matchMessage) return false
      }
      return true
    })
  }, [items, filterTab, typeFilter, searchQuery])

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Notifications
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            View your personal alerts, customer replies, and assignment updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
              {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterTab === 'unread'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-600 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('read')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                filterTab === 'read'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Read ({readCount})
            </button>
          </div>

          {/* Search box & Type filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notifications…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input !py-1.5 !pl-8 text-xs w-full"
              />
            </div>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input !py-1.5 text-xs shrink-0 !w-auto"
            >
              <option value="all">All Types</option>
              <option value="new_reply">Customer Replies</option>
              <option value="booking_matched">Bookings Matched</option>
              <option value="booking_unmatched">Unmatched Bookings</option>
              <option value="needs_consultant">Consultations</option>
              <option value="assigned_to_you">Assignments</option>
              <option value="upsell_due">Upsell Alerts</option>
              <option value="unsubscribed">Opt-outs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card p-0 overflow-hidden shadow-xs border border-slate-200">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Inbox size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {filterTab === 'unread'
                ? 'No unread notifications'
                : searchQuery
                ? 'No matching notifications found'
                : 'No notifications'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {filterTab === 'unread'
                ? 'You have caught up with all your activity alerts.'
                : 'Activity alerts regarding pitches, consultations, and incoming responses will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map(n => {
              const visual = getNotificationVisuals(n.type)
              const Icon = visual.icon
              const isActionPending = loadingActionId === n.id

              return (
                <div
                  key={n.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors ${
                    n.is_read ? 'bg-white hover:bg-slate-50/60' : 'bg-primary/[0.025] hover:bg-primary/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visual.color} mt-0.5`}>
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs sm:text-sm font-semibold ${n.is_read ? 'text-slate-800' : 'text-slate-900 font-bold'}`}>
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-bold text-primary">
                            New
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          &middot; {visual.label}
                        </span>
                      </div>

                      {n.message && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                        <span title={formatDateTime(n.created_at)}>
                          {formatRelativeTime(n.created_at)}
                        </span>
                        <span>&middot;</span>
                        <span>{formatDateTime(n.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this individual item */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                    {!n.is_read ? (
                      <button
                        type="button"
                        onClick={() => handleMarkIndividualRead(n.id)}
                        disabled={isActionPending}
                        className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                      >
                        {isActionPending ? <Spinner size={12} /> : <Check size={13} className="text-emerald-600" />}
                        <span>Mark as read</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 font-medium">
                        <Check size={13} className="text-slate-400" /> Read
                      </span>
                    )}

                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.is_read) {
                            handleMarkIndividualRead(n.id)
                          }
                        }}
                        className="btn btn-primary btn-sm flex items-center gap-1 text-xs"
                      >
                        <span>Open</span>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

