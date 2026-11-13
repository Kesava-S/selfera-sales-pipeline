import { SkeletonPage, Skeleton, PageHeaderSkeleton, RowListSkeleton } from '@/components/Skeleton'

// Shown instantly while Notifications loads: title, filter bar (read tabs, search, type), list
export default function NotificationsLoading() {
  return (
    <SkeletonPage label="Loading notifications">
      <PageHeaderSkeleton />
      <div className="card flex flex-col gap-3 !p-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-9 w-64 !rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <RowListSkeleton rows={7} />
    </SkeletonPage>
  )
}
