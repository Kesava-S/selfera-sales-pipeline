import { SkeletonPage, Skeleton, StatCardsSkeleton } from '@/components/Skeleton'

// Shown instantly while the dashboard loads: greeting, Pipeline Status (7 boxes),
// then Due today (3 tabs and the list)
export default function DashboardLoading() {
  return (
    <SkeletonPage label="Loading dashboard" className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-[70vw]" />
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="hidden h-3.5 w-64 sm:block" />
        </div>
        <StatCardsSkeleton count={7} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7" />
      </section>
      <section className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="card !p-0">
          <div className="flex gap-2 border-b border-slate-100 px-3 pb-2 pt-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-7 w-32" />)}
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-[18px] w-[18px] shrink-0 !rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className={`h-4 ${['w-48', 'w-40', 'w-56'][i % 3]}`} />
                <Skeleton className={`h-3 ${['w-64', 'w-52', 'w-60'][i % 3]} max-w-full`} />
              </div>
              <Skeleton className="h-8 w-16 !rounded-[8px]" />
            </div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  )
}
