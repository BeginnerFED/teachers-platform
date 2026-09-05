import { Skeleton } from '@/components/ui/skeleton'
import { MaterialGridSkeleton } from '@/features/library/components/material-grid'

export default function Loading() {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-56 rounded-full" />
          <Skeleton className="h-8 flex-1 rounded-full sm:max-w-[260px]" />
          <Skeleton className="h-8 w-[130px] rounded-full" />
        </div>

        <MaterialGridSkeleton />
      </div>
    </>
  )
}
