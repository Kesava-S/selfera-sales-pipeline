import { SkeletonPage, PageHeaderSkeleton, Skeleton } from '@/components/Skeleton'

// Fallback for any dashboard page without its own skeleton: keeps the sidebar and
// top bar on screen (the app-wide loader would cover the whole dashboard)
export default function DashboardSectionLoading() {
  return (
    <SkeletonPage label="Loading">
      <PageHeaderSkeleton />
      <div className="card space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </SkeletonPage>
  )
}
