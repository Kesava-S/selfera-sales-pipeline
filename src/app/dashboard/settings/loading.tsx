import { SkeletonPage, Skeleton, FormCardSkeleton, TableSkeleton } from '@/components/Skeleton'

// Shown instantly while Settings loads: My account, Team, follow-up timings (two
// cards side by side), then the do-not-contact list
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading settings">
      <div className="w-full max-w-6xl space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="card space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-72 max-w-[70vw]" />
          </div>
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-32 !rounded-[10px]" />
          </div>
          <TableSkeleton rows={5} cols={4} />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FormCardSkeleton rows={4} />
          <FormCardSkeleton rows={3} />
        </div>
        <div className="card space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-[50vw]" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
