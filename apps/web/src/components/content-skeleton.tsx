import { Skeleton } from '@/components/ui/skeleton'

/**
 * Stands in for a page's content only. The sidebar and header live in the layout and are
 * never replaced, so a skeleton that redrew them would make a navigation look heavier
 * than it is.
 */
export function ContentSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {Array.from({ length: blocks }, (_, index) => (
        <Skeleton key={index} className={index === 0 ? 'h-24 w-full max-w-3xl rounded-xl' : 'h-64 w-full max-w-3xl rounded-xl'} />
      ))}
    </>
  )
}
