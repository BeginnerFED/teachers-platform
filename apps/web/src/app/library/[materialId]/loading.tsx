import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <Skeleton className="h-8 w-28" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-9" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-3 w-64" />
        </div>

        <Skeleton className="h-9 w-32 rounded-md" />
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
