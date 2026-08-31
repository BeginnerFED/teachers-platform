import type { TeacherSubscription } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Messages } from '@/messages'
import { NEUTRAL_BADGE_CLASS, STATUS_BADGE_CLASS, statusLabel } from '../format'

export function SubscriptionBadge({
  subscription,
  t,
}: {
  subscription: TeacherSubscription | null
  t: Messages
}) {
  if (!subscription) {
    return (
      <Badge variant="outline" className={cn('font-medium', NEUTRAL_BADGE_CLASS)}>
        {t.teachers.noSubscription}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', STATUS_BADGE_CLASS[subscription.status])}
    >
      {statusLabel(subscription.status, t)}
    </Badge>
  )
}
