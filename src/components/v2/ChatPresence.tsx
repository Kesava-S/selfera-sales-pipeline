'use client'

// "In use by …" in the chat header: other staff who have this lead open right now
// (Supabase realtime presence, any of its chats) or who sent in this chat in the
// last 24 hours. A heads-up only; sending is never blocked.

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InfoTip } from '@/components/ui'
import { formatRelativeTime } from '@/components/NotificationBell'

type Viewer = { user_id: string; name: string; platform: string; opened_at: string }
type SentMsg = { direction: string; sent_by: string | null; created_at: string }

const DAY_MS = 24 * 60 * 60 * 1000

export function ChatPresence({ oppId, platform, me, messages, people }: {
  oppId: string
  platform: string
  me: { id: string; full_name: string }
  messages: SentMsg[]
  people: { id: string; full_name: string }[]
}) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  // Re-render each minute so "5m ago" stays right and old sends drop off
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const openedAt = new Date().toISOString()
    const ch = supabase.channel(`lead-presence-${oppId}`, { config: { presence: { key: me.id } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<Viewer>()
      const list: Viewer[] = []
      for (const [key, metas] of Object.entries(state)) {
        if (key === me.id || !metas.length) continue
        // Earliest open per person
        const first = [...metas].sort((a, z) => (a.opened_at < z.opened_at ? -1 : 1))[0]
        list.push({ user_id: key, name: first.name, platform: first.platform, opened_at: first.opened_at })
      }
      setViewers(list)
    }).subscribe(status => {
      if (status === 'SUBSCRIBED') ch.track({ user_id: me.id, name: me.full_name, platform, opened_at: openedAt }).catch(() => {})
    })
    return () => { supabase.removeChannel(ch).catch(() => {}) }
  }, [oppId, platform, me.id, me.full_name])

  // Latest send by someone else in this chat, in the last 24 hours
  const recentSend = useMemo(() => {
    const last = [...messages]
      .filter(m => m.direction === 'outbound' && m.sent_by && m.sent_by !== me.id && now - new Date(m.created_at).getTime() < DAY_MS)
      .sort((a, z) => (a.created_at < z.created_at ? 1 : -1))[0]
    if (!last) return null
    return { name: people.find(p => p.id === last.sent_by)?.full_name || 'Someone', at: last.created_at }
  }, [messages, me.id, people, now])

  const sentByViewer = recentSend && viewers.some(v => v.name === recentSend.name)
  if (!viewers.length && !recentSend) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-amber-700">
      <Users size={13} />
      {viewers.map(v => (
        <span key={v.user_id}>
          In use by {v.name}{v.platform !== platform ? ` (${v.platform})` : ''}, opened {formatRelativeTime(v.opened_at).toLowerCase()}
        </span>
      ))}
      {recentSend && !sentByViewer && (
        <span>{recentSend.name} sent a message {formatRelativeTime(recentSend.at).toLowerCase()}</span>
      )}
      {recentSend && sentByViewer && <span>· sent {formatRelativeTime(recentSend.at).toLowerCase()}</span>}
      <InfoTip align="left" text="Someone else is working on this lead. Check with them before sending so the lead doesn't get two replies." />
    </div>
  )
}
