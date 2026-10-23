import { SkeletonPage, Skeleton } from '@/components/Skeleton'

// Shown instantly while conversation loads; the sidebar and top bar stay usable
export default function ThreadLoading() {
  return (
    <SkeletonPage label="Loading conversation">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="card space-y-4">
        {[['w-2/3', ''], ['w-1/2', 'ml-auto'], ['w-3/5', ''], ['w-2/5', 'ml-auto']].map(([w, side], i) => (
          <Skeleton key={i} className={`h-14 ${w} ${side} !rounded-2xl`} />
        ))}
      </div>
      <div className="card space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </SkeletonPage>
  )
}
