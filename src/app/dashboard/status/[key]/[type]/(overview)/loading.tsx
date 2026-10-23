import { SkeletonPage, PageHeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

// Shown instantly while platforms loads; the sidebar and top bar stay usable
export default function StatusTypeLoading() {
  return (
    <SkeletonPage label="Loading platforms">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={5} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" />
    </SkeletonPage>
  )
}
