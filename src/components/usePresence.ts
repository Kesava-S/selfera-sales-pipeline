'use client'

import { useEffect, useState } from 'react'

// Keeps something mounted for `duration` ms after `open` turns false,
// so its exit animation can play before it is removed.
export function usePresence(open: boolean, duration = 160) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => setMounted(false), duration)
    return () => clearTimeout(t)
  }, [closing, duration])

  return { mounted: mounted || open, closing }
}
