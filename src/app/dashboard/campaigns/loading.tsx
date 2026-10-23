import { SkeletonPage, CampaignsPageSkeleton } from '@/components/Skeleton'

// Shown instantly while email campaigns loads; the sidebar and top bar stay usable
export default function EmailCampaignsLoading() {
  return (
    <SkeletonPage label="Loading email campaigns">
      <CampaignsPageSkeleton />
    </SkeletonPage>
  )
}
