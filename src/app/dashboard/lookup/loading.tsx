import { SkeletonPage, Skeleton, PageHeaderSkeleton } from '@/components/Skeleton'

// Shown instantly while lead lookup loads; the sidebar and top bar stay usable
export default function LeadLookupLoading() {
  return (
    <SkeletonPage label="Loading lead lookup">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 !rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <Skeleton className="h-40 w-full !rounded-[14px]" />
        </div>
      </div>
    </SkeletonPage>
  )
}
