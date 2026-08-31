import { Skeleton } from '@/components/ui/skeleton'

/**
 * Sits inside the browser's card, so it draws rows only. Its shapes follow the real
 * table's columns, which is what stops the swap from looking like a page change.
 */
export function StudentsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="bg-muted/50 flex h-11 items-center gap-4 border-b px-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>

      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b px-2 py-3 last:border-b-0">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="ml-6 h-3.5 w-28" />
          <Skeleton className="ml-6 h-3.5 w-8" />
          <Skeleton className="ml-6 h-3.5 w-20" />
          <Skeleton className="ml-auto size-8 rounded-md" />
        </div>
      ))}
    </div>
  )
}
