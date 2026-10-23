import { SkeletonPage, PageHeaderSkeleton, CardListSkeleton } from '@/components/Skeleton'

// Shown instantly while leads loads; the sidebar and top bar stay usable
export default function StatusListLoading() {
  return (
    <SkeletonPage label="Loading leads">
      <PageHeaderSkeleton />
      <CardListSkeleton count={7} />
    </SkeletonPage>
  )
}
