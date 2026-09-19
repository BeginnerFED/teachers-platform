import type { AssignmentStatus } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

type Tone = AssignmentStatus | 'late' | 'revision'

/** Soft tints, never fills: the colour says where the work is without shouting it. */
const CHIP: Record<Tone, string> = {
  assigned: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  submitted: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  graded: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  late: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  revision: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
}

const DOT: Record<Tone, string> = {
  assigned: 'bg-sky-500',
  submitted: 'bg-amber-500',
  graded: 'bg-emerald-500',
  late: 'bg-red-500',
  revision: 'bg-violet-500',
}

const tone = (status: AssignmentStatus, late: boolean, revisionRequested: boolean): Tone => {
  if (status === 'assigned' && revisionRequested) return 'revision'
  return late && status === 'assigned' ? 'late' : status
}

/** Where a piece of homework is: set, late, handed in, or read. One word, one tint. */
export function StatusBadge({
  status,
  late = false,
  revisionRequested = false,
  t,
  className,
}: {
  status: AssignmentStatus
  /** Open and past its due date — said instead of "set", because it is the thing to know. */
  late?: boolean
  revisionRequested?: boolean
  t: Messages
  className?: string
}) {
  const key = tone(status, late, revisionRequested)

  return (
    <Badge
      variant="secondary"
      className={cn('h-auto rounded-full px-2.5 py-1 text-xs font-medium', CHIP[key], className)}
    >
      {key === 'revision'
        ? t.homework.revision.requested
        : key === 'late'
          ? t.homework.overdue
          : t.homework.status[status]}
    </Badge>
  )
}

/** The same fact as a six-pixel dot, for the start of a row. */
export function StatusDot({
  status,
  late = false,
  revisionRequested = false,
  className,
}: {
  status: AssignmentStatus
  late?: boolean
  revisionRequested?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        DOT[tone(status, late, revisionRequested)],
        className,
      )}
    />
  )
}
