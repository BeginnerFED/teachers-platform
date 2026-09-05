import { Skeleton } from '@/components/ui/skeleton'

/** The page's own shape while it loads: a title, the contact card, a few question rows. */
export default function HelpLoading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="border-border/60 bg-card flex items-center gap-4 rounded-2xl border p-5">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center justify-between px-4 py-3.5">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="size-4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
