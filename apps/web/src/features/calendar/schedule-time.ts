import { z } from 'zod'
import { PLATFORM_TIME_ZONE } from '@tp/shared'
import { fromZoned, toZoned } from '@/lib/zoned-time'

/** A calendar entry uses the displayed Kyiv clock, independent of the browser's zone. */
export function scheduleInstant(date: string, time: string): string | null {
  if (!z.iso.date().safeParse(date).success || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const instant = fromZoned({ year, month, day, hour, minute }, PLATFORM_TIME_ZONE)
  const roundTrip = toZoned(instant, PLATFORM_TIME_ZONE)
  // The spring clock change can remove an hour: never silently move someone's lesson.
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  )
    return null
  return instant.toISOString()
}
