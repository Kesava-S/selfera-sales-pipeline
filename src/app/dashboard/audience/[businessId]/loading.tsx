import { SkeletonPage, PageHeaderSkeleton, TabsSkeleton, FilterBarSkeleton, TableSkeleton } from '@/components/Skeleton'

// Shown instantly while a client's customers load
export default function ClientCustomersLoading() {
  return (
    <SkeletonPage label="Loading customers">
      <PageHeaderSkeleton actions={2} />
      <TabsSkeleton count={4} />
      <FilterBarSkeleton items={3} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonPage>
  )
}
