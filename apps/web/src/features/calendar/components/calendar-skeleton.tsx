import { Skeleton } from '@/components/ui/skeleton'

/**
 * The grid's own shape — a time gutter, seven columns, a scatter of marks — so the week
 * does not rearrange itself when the lessons land.
 *
 * Split from the toolbar because the two are needed at different moments: the whole thing
 * on a cold load, this alone while a week is on its way and the controls are still there
 * to be used.
 */
export function CalendarGridSkeleton() {
  const days = Array.from({ length: 7 }, (_, index) => index)

  return (
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
        <div className="flex flex-col gap-9 border-r pr-2 pt-3">
          {Array.from({ length: 7 }, (_, hour) => (
            <Skeleton key={hour} className="h-2.5 w-8 self-end" />
          ))}
        </div>

        {days.map((day) => (
          <div key={day} className="relative border-r last:border-r-0">
            {/* Round, and placed unevenly on purpose: a timetable is not a chequerboard. */}
            {[0, 1, 2].map((slot) => (
              <Skeleton
                key={slot}
                className="absolute size-7 rounded-full"
                style={{
                  top: `${((day * 3 + slot * 5) % 11) * 8 + 6}%`,
                  left: `${4 + ((day + slot) % 3) * 26}px`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CalendarSkeleton({
  withTeacherFilter = true,
}: { withTeacherFilter?: boolean } = {}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-4 w-40" />
        {withTeacherFilter && <Skeleton className="ml-auto h-9 w-[220px] rounded-md" />}
      </div>

      <CalendarGridSkeleton />
    </div>
  )
}
