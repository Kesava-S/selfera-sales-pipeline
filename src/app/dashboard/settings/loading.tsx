import { SkeletonPage, Skeleton, FormCardSkeleton, SectionTitleSkeleton, TileGridSkeleton } from '@/components/Skeleton'

// Shown instantly while settings loads; the sidebar and top bar stay usable
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading settings">
      <div className="w-full max-w-6xl space-y-6">
        <Skeleton className="h-8 w-32" />
        <FormCardSkeleton rows={1} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormCardSkeleton rows={3} />
          <FormCardSkeleton rows={2} />
        </div>
      </div>
    </SkeletonPage>
  )
}
