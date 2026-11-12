'use client'

import { useSyncExternalStore } from 'react'
import { DEFAULT_TZ } from '@/lib/format'

const noSubscribe = () => () => {}

// The viewer's time zone from their browser. While the server renders it is London,
// and the browser switches to local time right after, so pages hydrate cleanly.
export function useTimeZone(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ,
    () => DEFAULT_TZ,
  )
}
