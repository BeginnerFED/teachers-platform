import { Skeleton } from '@/components/ui/skeleton'

/** The room's own shape while it loads: a title, the people, the lesson. */
export default function LiveLoading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </>
  )
}
