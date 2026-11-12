'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  Check,
  ChevronRight,
  MessageSquare,
  CalendarCheck,
  CalendarX,
  UserCheck,
  UserPlus,
  TrendingUp,
  UserMinus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead } from '@/app/dashboard/actions'
import { toast } from '@/components/v2/Toast'
import { usePresence } from '@/components/usePresence'

export type Note = {
  id: string
  type: string
  title: string
  message?: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export function getNotificationVisuals(type: string) {
  switch (type) {
    case 'new_reply':
      return {
        icon: MessageSquare,
        color: 'text-sky-600 bg-sky-50 border-sky-100',
        label: 'Reply',
      }
    case 'booking_matched':
      return {
        icon: CalendarCheck,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        label: 'Booking',
      }
    case 'booking_unmatched':
      return {
        icon: CalendarX,
        color: 'text-amber-600 bg-amber-50 border-amber-100',
        label: 'Unmatched',
      }
    case 'needs_consultant':
      return {
        icon: UserCheck,
        color: 'text-purple-600 bg-purple-50 border-purple-100',
        label: 'Consultant',
      }
    case 'assigned_to_you':
      return {
        icon: UserPlus,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        label: 'Assigned',
      }
    case 'upsell_due':
      return {
        icon: TrendingUp,
        color: 'text-rose-600 bg-rose-50 border-rose-100',
        label: 'Upsell',
      }
    case 'consultation_reminder':
      return {
        icon: CalendarCheck,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        label: 'Consultation',
      }
    case 'reply_waiting':
      return {
        icon: MessageSquare,
        color: 'text-amber-600 bg-amber-50 border-amber-100',
        label: 'Reply waiting',
      }
    case 'unsubscribed':
      return {
        icon: UserMinus,
        color: 'text-slate-500 bg-slate-100 border-slate-200',
        label: 'Opt-out',
      }
    default:
      return {
        icon: Bell,
        color: 'text-primary bg-primary/10 border-primary/20',
        label: 'Notice',
      }
  }
}

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 45) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 86400 * 2) return 'Yesterday'
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Note[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panel = usePresence(open, 120)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setItems(data as Note[])
  }, [userId])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'sales-pipe', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe()
    const timer = setInterval(load, 60_000)
    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [load, userId])

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = items.filter(i => !i.is_read).length
  const displayItems = items.slice(0, 5)

  const handleMarkIndividualRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setItems(prev => prev.map(i => (i.id === id ? { ...i, is_read: true } : i)))
    try {
      const res = await markNotificationRead(id)
      if (!res.ok) throw new Error(res.error)
    } catch {
      toast.error('Could not mark notification as read.')
      load()
    }
  }

  const openItem = (n: Note) => {
    setOpen(false)
    if (!n.is_read) {
      setItems(prev => prev.map(i => (i.id === n.id ? { ...i, is_read: true } : i)))
      markNotificationRead(n.id).catch(() => {})
    }
    if (n.link) router.push(n.link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="btn btn-ghost btn-sm relative !p-2 transition-transform active:scale-95"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell size={19} className="text-slate-600" />
        {unread > 0 && (
          <span
            key={unread}
            className="motion-badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {panel.mounted && (
        <div
          className={`fixed sm:absolute right-3 sm:right-0 top-16 sm:top-[calc(100%+8px)] z-50 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm sm:max-w-md rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden ${
            panel.closing ? 'motion-dropdown-out' : 'motion-dropdown-in'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {unread} unread
                </span>
              )}
            </div>
          </div>

          {/* List (Latest 5 only) */}
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You are all caught up.</p>
              </div>
            ) : (
              displayItems.map(n => {
                const visual = getNotificationVisuals(n.type)
                const Icon = visual.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`group relative flex items-start gap-3 px-3.5 py-3 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                      n.is_read ? 'bg-white' : 'bg-primary/[0.03]'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${visual.color} mt-0.5`}>
                      <Icon size={14} />
                    </div>

                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={`block text-xs font-semibold truncate ${n.is_read ? 'text-slate-800' : 'text-slate-900'}`}>
                          {n.title}
                        </span>
                      </div>

                      {n.message && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {n.message}
                        </p>
                      )}

                      <span className="block text-[10px] text-slate-400 font-medium mt-1">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>

                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={e => handleMarkIndividualRead(e, n.id)}
                        className="absolute right-3 top-3.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer - Link to separate view all page */}
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-primary transition-colors hover:bg-slate-100 hover:text-primary-hover"
          >
            <span>View all notifications</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
