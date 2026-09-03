import type { AssignmentStatus } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'

const TONE: Record<AssignmentStatus, string> = {
  assigned: 'text-muted-foreground',
  submitted: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  graded: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

/** Where a piece of homework is: set, handed in, or read. One word, one colour. */
export function StatusBadge({
  status,
  t,
  className,
}: {
  status: AssignmentStatus
  t: Messages
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('font-normal', TONE[status], className)}>
      {t.homework.status[status]}
    </Badge>
  )
}
