import { SkeletonPage, PageHeaderSkeleton } from '@/components/Skeleton'
import { LeadCardsSkeleton } from '@/components/StatusSkeletons'

// Shown instantly while the lead list loads: one card per lead
export default function StatusListLoading() {
  return (
    <SkeletonPage label="Loading leads">
      <PageHeaderSkeleton />
      <LeadCardsSkeleton count={7} />
    </SkeletonPage>
  )
}
