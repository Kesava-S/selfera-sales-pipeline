import { SkeletonPage, PageHeaderSkeleton, SectionTitleSkeleton, TileGridSkeleton } from '@/components/Skeleton'

// Shown instantly while templates loads; the sidebar and top bar stay usable
export default function TemplatesLoading() {
  return (
    <SkeletonPage label="Loading templates">
      <div className="space-y-8">
        <PageHeaderSkeleton />
        {/* The platform section only appears after a business type is picked */}
        <div className="space-y-3">
          <SectionTitleSkeleton />
          <TileGridSkeleton count={5} />
        </div>
      </div>
    </SkeletonPage>
  )
}
