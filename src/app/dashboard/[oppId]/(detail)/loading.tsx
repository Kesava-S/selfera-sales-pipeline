import { SkeletonPage, Skeleton } from '@/components/Skeleton'

// Shown instantly while business loads; the sidebar and top bar stay usable
export default function BusinessLoading() {
  return (
    <SkeletonPage label="Loading business">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-20 !rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-32 !rounded-[10px]" />)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="card space-y-4">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="card space-y-3 !p-4">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="card space-y-4">
            <Skeleton className="h-5 w-20" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="mt-1 h-2 w-2 shrink-0 !rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonPage>
  )
}
