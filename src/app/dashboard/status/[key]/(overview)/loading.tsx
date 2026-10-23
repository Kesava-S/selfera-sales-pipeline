import { SkeletonPage, PageHeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

// Shown instantly while pipeline status loads; the sidebar and top bar stay usable
export default function StatusLoading() {
  return (
    <SkeletonPage label="Loading pipeline status">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
    </SkeletonPage>
  )
}
