'use client'

// Thin bar along the top of the screen while moving between pages.
// It starts as soon as an internal link is clicked (or startNavigation() is
// called before router.push) and finishes once the new URL is in place and no
// page skeleton is still showing, so it covers the whole wait, not just the click.

import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

let clickPending = false
let skeletons = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const isLoading = () => clickPending || skeletons > 0
const isSkeletonShowing = () => skeletons > 0

// True while a page skeleton is on screen (the top bar's breadcrumb uses it)
export function useSkeletonShowing() {
  return useSyncExternalStore(subscribe, isSkeletonShowing, () => false)
}

// Call before router.push() so filter and tab changes show the bar too
export function startNavigation() {
  clickPending = true
  emit()
}

// Rendered inside each loading.tsx: keeps the bar going while the skeleton is up
export function SkeletonActive() {
  useEffect(() => {
    skeletons++
    emit()
    return () => {
      skeletons--
      emit()
    }
  }, [])
  return null
}

function ProgressBar() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const url = search ? `${pathname}?${search}` : pathname
  const loading = useSyncExternalStore(subscribe, isLoading, () => false)
  const [shown, setShown] = useState<'idle' | 'loading' | 'done'>('idle')

  // The new URL is in place: the click part of the wait is over
  useEffect(() => {
    if (!clickPending) return
    clickPending = false
    emit()
  }, [url])

  if (loading && shown !== 'loading') setShown('loading')
  if (!loading && shown === 'loading') setShown('done')

  useEffect(() => {
    if (shown !== 'done') return
    const t = setTimeout(() => setShown('idle'), 500)
    return () => clearTimeout(t)
  }, [shown])

  // Never leave the bar stuck if a navigation is cancelled
  useEffect(() => {
    if (shown !== 'loading') return
    const t = setTimeout(() => {
      clickPending = false
      emit()
    }, 15_000)
    return () => clearTimeout(t)
  }, [shown])

  // Start on any internal link click that will actually navigate. Listens in the
  // capture phase: Next's <Link> calls preventDefault() on its own clicks, so a
  // normal (bubbling) listener would see every in-app link as already handled.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return
      const next = new URL(a.href, window.location.href)
      if (next.origin !== window.location.origin) return
      if (next.pathname === window.location.pathname && next.search === window.location.search) return
      startNavigation()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return <div aria-hidden="true" className={`nav-progress ${shown === 'idle' ? '' : shown}`} />
}

export function NavigationProgress() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  )
}
