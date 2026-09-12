import type { Role } from '@tp/shared'
import { GlobalSearch } from '@/features/search/global-search'
import { LiveNotificationBell } from '@/features/live/components/student-live-notifications'
import { ReminderNotificationBell } from '@/features/student-dashboard/components/study-updates'
import type { Messages } from '@/messages'

export function NavActions({ today, role, t }: { today: string; role: Role; t: Messages }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="text-muted-foreground hidden text-xs lg:inline-block">{today}</span>
      <GlobalSearch role={role} t={t} />
      {role === 'student' ? <LiveNotificationBell /> : <ReminderNotificationBell t={t} />}
    </div>
  )
}
