import { SkeletonPage, PageHeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

// Shown instantly while Client Audience loads; the sidebar and top bar stay usable
export default function CustomerLeadsLoading() {
  return (
    <SkeletonPage label="Loading client audience">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </SkeletonPage>
  )
}
