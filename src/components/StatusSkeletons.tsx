'use client'

// Skeletons for the dashboard status pages. The same address shows different
// layouts depending on the status, so these read the address to pick the shape.

import { usePathname } from 'next/navigation'
import { PageHeaderSkeleton, CardGridSkeleton, StatCardsSkeleton, TableSkeleton, Skeleton } from '@/components/Skeleton'

// The status lead list: one card per lead (name, latest message, date) with an Open button
export function LeadCardsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex flex-col justify-between gap-2 !p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-4 ${['w-48', 'w-40', 'w-56'][i % 3]}`} />
            <Skeleton className={`h-3.5 ${['w-2/3', 'w-1/2', 'w-3/5'][i % 3]}`} />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 !rounded-[8px]" />
        </div>
      ))}
    </div>
  )
}

// /dashboard/status/<key>
export function StatusOverviewSkeleton() {
  const key = usePathname().split('/')[3]
  if (key === 'off-target-leads') {
    // Title, 4 reason boxes, two filters, table
    return (
      <>
        <Skeleton className="h-8 w-48" />
        <StatCardsSkeleton count={4} className="grid grid-cols-2 gap-3 sm:grid-cols-4" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </>
    )
  }
  // One box per business type
  return (
    <>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
    </>
  )
}

// /dashboard/status/<key>/<type>
export function StatusTypeSkeleton() {
  const key = usePathname().split('/')[3]
  return (
    <>
      <PageHeaderSkeleton />
      {key === 'needs-reply'
        // Needs reply: one box per platform
        ? <CardGridSkeleton count={5} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" />
        // Every other status: the leads straight away
        : <LeadCardsSkeleton count={7} />}
    </>
  )
}
