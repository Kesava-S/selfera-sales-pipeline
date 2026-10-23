import { SkeletonPage, PageHeaderSkeleton, TabsSkeleton, CardGridSkeleton, FilterBarSkeleton, TableSkeleton } from '@/components/Skeleton'

// Shown instantly while lead management loads; the sidebar and top bar stay usable
export default function LeadsLoading() {
  return (
    <SkeletonPage label="Loading lead management">
      <PageHeaderSkeleton actions={3} />
      <TabsSkeleton count={3} />
      <CardGridSkeleton count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
      <FilterBarSkeleton items={4} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonPage>
  )
}
