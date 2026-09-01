import { Skeleton } from '@/components/ui/skeleton'

/**
 * The grid's own shape — a time gutter, seven columns, a scatter of blocks — so the week
 * does not rearrange itself when the lessons land.
 */
export function CalendarSkeleton() {
  const days = Array.from({ length: 7 }, (_, index) => index)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="ml-auto h-9 w-[220px] rounded-md" />
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/50 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
          <div className="border-r" />
          {days.map((day) => (
            <div key={day} className="flex justify-center border-r py-2.5 last:border-r-0">
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        <div className="grid h-[28rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="flex flex-col gap-9 border-r pt-3 pr-2">
            {Array.from({ length: 7 }, (_, hour) => (
              <Skeleton key={hour} className="h-2.5 w-8 self-end" />
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="relative border-r last:border-r-0">
              {/* Placed unevenly on purpose: a timetable is not a chequerboard. */}
              {[0, 1].map((slot) => (
                <Skeleton
                  key={slot}
                  className="absolute inset-x-1 rounded-md"
                  style={{ top: `${((day * 3 + slot * 5) % 11) * 8 + 8}%`, height: '11%' }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
