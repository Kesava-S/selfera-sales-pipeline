import { SkeletonPage } from '@/components/Skeleton'
import { StatusTypeSkeleton } from '@/components/StatusSkeletons'

// Shown instantly while a status + business type loads: platform boxes for
// Needs reply, the lead list for every other status
export default function StatusTypeLoading() {
  return (
    <SkeletonPage label="Loading leads">
      <StatusTypeSkeleton />
    </SkeletonPage>
  )
}
