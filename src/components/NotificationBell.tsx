'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markNotificationsRead } from '@/app/dashboard/actions'
import { formatDateTime } from '@/lib/format'

type Note = { id: string; type: string; title: string; link: string | null; is_read: boolean; created_at: string }

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Note[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, link, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setItems(data as Note[])
  }, [userId])

  useEffect(() => {
    load()
    const supabase = createClient()
    // Live updates when Realtime is on; a slow poll as a fallback
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'sales-pipe', table: 'notifications', filter: `user_id=eq.${userId}` }, () => load())
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

  const openItem = async (n: Note) => {
    setOpen(false)
    if (!n.is_read) {
      setItems(prev => prev.map(i => (i.id === n.id ? { ...i, is_read: true } : i)))
      await markNotificationsRead([n.id])
    }
    if (n.link) router.push(n.link)
  }

  const readAll = async () => {
    setItems(prev => prev.map(i => ({ ...i, is_read: true })))
    await markNotificationsRead('all')
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="btn btn-ghost btn-sm relative !p-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={readAll} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 ${n.is_read ? '' : 'bg-sky-50/60'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-primary'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="block text-xs text-slate-500">{formatDateTime(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
