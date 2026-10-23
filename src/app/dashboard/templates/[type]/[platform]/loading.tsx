import { SkeletonPage, Skeleton } from '@/components/Skeleton'

// Shown instantly while templates loads; the sidebar and top bar stay usable
export default function TemplateStepsLoading() {
  return (
    <SkeletonPage label="Loading templates">
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 !rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-72 max-w-[60vw]" />
          </div>
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card space-y-3 !p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
