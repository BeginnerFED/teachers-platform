import { Skeleton } from '@/components/ui/skeleton'

/** Same column rhythm as the real table, so nothing shifts when the rows arrive. */
export function TeachersTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
      </div>

      <div className="rounded-md border">
        <div className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>

        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="ml-auto h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
