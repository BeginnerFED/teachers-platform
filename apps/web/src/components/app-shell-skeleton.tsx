import { Skeleton } from '@/components/ui/skeleton'

/**
 * Stand-in for a role page while it loads. The shapes deliberately match what arrives —
 * same sidebar width, same header height, same content rhythm — so nothing jumps when
 * the real thing replaces it.
 */
export function AppShellSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex min-h-svh w-full">
      <div className="bg-sidebar hidden w-64 shrink-0 border-r p-3 md:block">
        <Skeleton className="h-12 w-full" />
        <div className="mt-4 flex flex-col gap-1.5">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-4 w-44" />
        </div>

        <div className="flex flex-col gap-6 p-6">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-24 w-full max-w-3xl rounded-xl" />
          <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
        </div>
      </div>
    </div>
  )
}
