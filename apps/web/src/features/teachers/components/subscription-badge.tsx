import type { TeacherSubscription } from '@tp/shared'
import { Badge } from '@/components/ui/badge'
import type { Messages } from '@/messages'
import { statusLabel, statusVariant } from '../format'

export function SubscriptionBadge({
  subscription,
  t,
}: {
  subscription: TeacherSubscription | null
  t: Messages
}) {
  if (!subscription) {
    return <Badge variant="outline">{t.teachers.noSubscription}</Badge>
  }

  return (
    <Badge variant={statusVariant(subscription.status)}>
      {statusLabel(subscription.status, t)}
    </Badge>
  )
}
