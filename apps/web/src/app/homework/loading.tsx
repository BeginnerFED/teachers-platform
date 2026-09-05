import { Skeleton } from '@/components/ui/skeleton'

/** The page's own shape while it loads: three rows in the frame the real ones will use. */
export default function HomeworkLoading() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-36 rounded-full" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-80 rounded-full" />
          <Skeleton className="h-8 w-56 rounded-full" />
        </div>

        <div className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-1.5 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-80" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
