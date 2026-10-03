import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      {/* Shaped like the header that replaces it — title, the line under it, the row of
          properties, the actions on the right — and nothing above it, so the heading lands
          where it is drawn rather than a row lower and then jumping up. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-5">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      <div className="rounded-md border">
        <div className="border-b p-3">
          <Skeleton className="h-4 w-20" />
        </div>

        <div className="divide-y">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 p-3">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 max-w-64 flex-1" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
