import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown while a conversation is on its way — whether it was clicked in the list or is
 * being opened for the first time from the picker. Without it the panel sits on the last
 * thread until the new one lands, which on a round trip to Frankfurt is long enough to
 * click again.
 */
export function ThreadSkeleton() {
  // A conversation is lopsided: turns of different lengths on alternating sides.
  const turns = [
    { mine: false, width: 220 },
    { mine: true, width: 140 },
    { mine: true, width: 190 },
    { mine: false, width: 260 },
    { mine: false, width: 120 },
    { mine: true, width: 200 },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b p-4">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-4">
        {turns.map((turn, index) => (
          <Skeleton
            key={index}
            className={turn.mine ? 'h-8 self-end rounded-2xl' : 'h-8 self-start rounded-2xl'}
            style={{ width: turn.width }}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t p-4">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
      </div>
    </div>
  )
}
