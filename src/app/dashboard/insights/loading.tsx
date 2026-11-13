import { SkeletonPage, Skeleton, FilterBarSkeleton, StatCardsSkeleton } from '@/components/Skeleton'

const ROW_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-2/5']

function BarCard({ title = 'w-40', rows = 5 }: { title?: string; rows?: number }) {
  return (
    <div className="card space-y-3">
      <Skeleton className={`h-5 ${title}`} />
      {Array.from({ length: rows }, (_, j) => (
        <div key={j} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-24 shrink-0" />
          <Skeleton className={`h-3.5 ${ROW_WIDTHS[j % ROW_WIDTHS.length]}`} />
        </div>
      ))}
    </div>
  )
}

// Shown instantly while Insights loads: title, filters, 5 numbers, funnel,
// reply rate + which message, then wins
export default function InsightsLoading() {
  return (
    <SkeletonPage label="Loading insights" className="space-y-5">
      <Skeleton className="h-8 w-32" />
      <FilterBarSkeleton items={3} />
      <StatCardsSkeleton count={5} className="grid grid-cols-2 gap-3 sm:grid-cols-5" />
      <BarCard title="w-24" rows={6} />
      <div className="grid gap-5 md:grid-cols-2">
        <BarCard />
        <BarCard title="w-48" />
      </div>
      <BarCard title="w-20" rows={3} />
    </SkeletonPage>
  )
}
