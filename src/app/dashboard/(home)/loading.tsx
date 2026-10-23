import { SkeletonPage, Skeleton, PageHeaderSkeleton, StatCardsSkeleton } from '@/components/Skeleton'

// Shown instantly while dashboard loads; the sidebar and top bar stay usable
export default function DashboardLoading() {
  return (
    <SkeletonPage label="Loading dashboard">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={7} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7" />
      <div className="card space-y-1 !p-0">
        <div className="flex gap-2 border-b border-slate-100 px-3 pb-2 pt-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-7 w-24" />)}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 shrink-0 !rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
