import { SkeletonPage } from '@/components/Skeleton'
import { StatusOverviewSkeleton } from '@/components/StatusSkeletons'

// Shown instantly while a status page loads; its shape follows the status
// (Off-target leads has its own layout)
export default function StatusLoading() {
  return (
    <SkeletonPage label="Loading pipeline status">
      <StatusOverviewSkeleton />
    </SkeletonPage>
  )
}
