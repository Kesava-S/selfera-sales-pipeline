import { SkeletonPage, Skeleton } from '@/components/Skeleton'

// Shown instantly while one channel's settings load: header card, sandbox/realtime
// switch, then the settings form (left) and the test panel (right)
export default function ChannelLoading() {
  return (
    <SkeletonPage label="Loading integration">
      <div className="card flex flex-col gap-4 !p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-12 w-12 shrink-0 !rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64 max-w-[60vw]" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-28 !rounded-full" />
          <Skeleton className="h-6 w-11 !rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="card space-y-4 !p-5 lg:col-span-7">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex justify-end"><Skeleton className="h-9 w-32" /></div>
        </div>
        <div className="card space-y-3.5 !p-5 lg:col-span-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </SkeletonPage>
  )
}
