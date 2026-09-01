import { Skeleton } from '@/components/ui/skeleton'
import { CalendarSkeleton } from '@/features/calendar/components/calendar-skeleton'

export default function Loading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>

      <CalendarSkeleton />
    </>
  )
}
