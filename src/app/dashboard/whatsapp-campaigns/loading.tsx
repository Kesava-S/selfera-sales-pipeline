import { SkeletonPage, CampaignsPageSkeleton } from '@/components/Skeleton'

// Shown instantly while whatsapp campaigns loads; the sidebar and top bar stay usable
export default function WhatsAppCampaignsLoading() {
  return (
    <SkeletonPage label="Loading whatsapp campaigns">
      <CampaignsPageSkeleton />
    </SkeletonPage>
  )
}
