import { SkeletonPage, Skeleton, PageHeaderSkeleton, FilterBarSkeleton, StatCardsSkeleton } from '@/components/Skeleton'

// Shown instantly while insights loads; the sidebar and top bar stay usable
export default function InsightsLoading() {
  return (
    <SkeletonPage label="Loading insights">
      <PageHeaderSkeleton subtitle={false} />
      <FilterBarSkeleton items={3} />
      <StatCardsSkeleton count={5} className="grid grid-cols-2 gap-3 sm:grid-cols-5" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card space-y-3">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className={`h-3.5 ${['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-2/5'][j]}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
