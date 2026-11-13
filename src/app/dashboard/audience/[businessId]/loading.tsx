import { SkeletonPage, PageHeaderSkeleton, TabsSkeleton, TableSkeleton, Skeleton } from '@/components/Skeleton'

// Shown instantly while a client's customers load
export default function ClientCustomersLoading() {
  return (
    <SkeletonPage label="Loading customers" className="space-y-5">
      <PageHeaderSkeleton actions={3} />
      <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <div aria-hidden="true" className="h-8 w-28 rounded-lg bg-white shadow-sm" />
        <Skeleton className="h-8 w-28" />
      </div>
      <TabsSkeleton count={4} />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-full sm:w-80" />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10 w-32" />)}
      </div>
      <TableSkeleton rows={10} cols={6} />
    </SkeletonPage>
  )
}
