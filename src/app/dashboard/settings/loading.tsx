import { SkeletonPage, Skeleton, FormCardSkeleton, SectionTitleSkeleton, TileGridSkeleton } from '@/components/Skeleton'

// Shown instantly while settings loads; the sidebar and top bar stay usable
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading settings">
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-32" />
        <FormCardSkeleton rows={1} />
        <div className="space-y-4">
          <SectionTitleSkeleton />
          <TileGridSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3" />
        </div>
        <FormCardSkeleton rows={3} />
      </div>
    </SkeletonPage>
  )
}
