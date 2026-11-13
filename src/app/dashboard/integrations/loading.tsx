import { SkeletonPage, Skeleton, RowListSkeleton } from '@/components/Skeleton'

// Shown instantly while Integrations loads: title + search, then one row per channel
export default function IntegrationsLoading() {
  return (
    <SkeletonPage label="Loading integrations">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>
      <RowListSkeleton rows={5} />
    </SkeletonPage>
  )
}
