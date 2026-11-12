'use client'

// Keeps the dashboard and status pages current: when a reply arrives, a stage or
// assignment changes, a chat's status changes or a campaign reply comes in
// (Supabase realtime, migration 71), the page data reloads quietly.
// A burst of changes reloads once; a hidden tab waits until it is shown again.

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TABLES: { table: string; event: 'INSERT' | 'UPDATE' | '*' }[] = [
  { table: 'messages', event: 'INSERT' },
  { table: 'opportunities', event: '*' },
  { table: 'threads', event: 'UPDATE' },
  { table: 'campaign_replies', event: '*' },
]
const WAIT_MS = 1500

export function LiveRefresh({ name }: { name: string }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stale = useRef(false)

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') {
        stale.current = true
        return
      }
      stale.current = false
      router.refresh()
    }
    const schedule = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(refresh, WAIT_MS)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stale.current) refresh()
    }

    const supabase = createClient()
    let ch = supabase.channel(`live-${name}`)
    for (const t of TABLES) {
      ch = ch.on('postgres_changes', { event: t.event, schema: 'sales-pipe', table: t.table }, schedule)
    }
    ch.subscribe()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(ch).catch(() => {})
    }
  }, [name, router])

  return null
}
