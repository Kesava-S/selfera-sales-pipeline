// Skeleton placeholders for loading.tsx files: grey shimmering blocks in the
// shape of the page being opened, so content fills in without jumping.

import { SkeletonActive } from '@/components/NavigationProgress'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

// Wraps every page skeleton: announces loading and keeps the top bar running
export function SkeletonPage({ children, label = 'Loading', className = 'space-y-6' }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`skeleton-page ${className}`}>
      <span className="sr-only">{label}…</span>
      <SkeletonActive />
      {children}
    </div>
  )
}

export function PageHeaderSkeleton({ actions = 0, subtitle = true }: { actions?: number; subtitle?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        {subtitle && <Skeleton className="h-4 w-80 max-w-[70vw]" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => <Skeleton key={i} className="h-9 w-28 !rounded-[10px]" />)}
        </div>
      )}
    </div>
  )
}

export function StatCardsSkeleton({ count = 4, className = 'grid grid-cols-2 gap-3 lg:grid-cols-4' }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 !p-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  )
}

export function FilterBarSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="card flex flex-wrap items-center gap-2 !p-3">
      <Skeleton className="h-9 w-64 max-w-full" />
      {Array.from({ length: items }, (_, i) => <Skeleton key={i} className="h-9 w-32" />)}
    </div>
  )
}

export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 border-b border-slate-200 pb-2">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-8 w-28" />)}
    </div>
  )
}

// Widths vary per column so rows don't look like a barcode
const COL_WIDTHS = ['w-40', 'w-24', 'w-28', 'w-20', 'w-32', 'w-16']

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <div className="flex gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3">
        {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-28' : 'w-16'}`} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-4 w-4 shrink-0 !rounded" />
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-4 ${COL_WIDTHS[(c + r) % COL_WIDTHS.length]} ${c === 0 ? '' : 'hidden sm:block'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6, className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 !p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 !rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

export function CardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="card divide-y divide-slate-100 !p-0">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-14 !rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FormCardSkeleton({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="card space-y-4">
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  )
}

export function SectionTitleSkeleton() {
  return <Skeleton className="h-5 w-44" />
}

// Small cards with an icon, a name and a count (templates, team roles)
export function TileGridSkeleton({ count = 3, className = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex items-center gap-3 !p-4">
          <Skeleton className="h-10 w-10 shrink-0 !rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Email and WhatsApp campaign pages: title + pill, the Campaigns/Databases
// switch and New button beside it, then a card listing campaigns
export function CampaignsPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-20 !rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 max-w-[80vw]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            {/* Selected tab is a plain white pill, as on the real switch */}
            <div aria-hidden="true" className="h-7 w-28 rounded-lg bg-white shadow-sm" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-8 w-32 !rounded-[8px]" />
        </div>
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-64 max-w-[50vw]" />
          </div>
          <Skeleton className="h-8 w-32 !rounded-[8px]" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-14 !rounded-full" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-3.5 w-2/3" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="h-8 w-20 !rounded-[8px]" />
                <Skeleton className="h-8 w-16 !rounded-[8px]" />
                <Skeleton className="h-8 w-8 !rounded-[8px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
