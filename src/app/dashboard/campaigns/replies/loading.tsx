import { SkeletonPage, RepliesPageSkeleton } from '@/components/Skeleton'

// Shown instantly while email campaign replies load (the campaigns list skeleton has a different shape)
export default function RepliesLoading() {
  return (
    <SkeletonPage label="Loading replies" className="space-y-5">
      <RepliesPageSkeleton />
    </SkeletonPage>
  )
}
