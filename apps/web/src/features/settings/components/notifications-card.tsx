'use client'

import type { NotificationPreferences, Role } from '@tp/shared'
import { Switch } from '@/components/ui/switch'
import { useStudyUpdates } from '@/features/student-dashboard/components/study-updates'
import type { Messages } from '@/messages'
import { initialSettingsActionState } from '../action-state'
import { updateNotificationPreferences } from '../actions'
import { SettingRow } from './setting-row'
import { SettingsCard } from './settings-card'

export function NotificationsCard({
  id,
  preferences,
  role,
  t,
}: {
  id: string
  preferences: NotificationPreferences
  role: Role
  t: Messages
}) {
  const feed = useStudyUpdates()
  const copy = t.settings.notifications
  return (
    <SettingsCard
      id={id}
      title={copy.title}
      description={copy.description}
      note={copy.note}
      action={async (previous, formData) => {
        const result = await updateNotificationPreferences(previous, formData)
        if (result.saved) await feed?.refresh({ force: true, silent: true })
        return result
      }}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      <SettingRow label={copy.lessons} htmlFor="lessonReminders" description={copy.lessonsHint}>
        <Switch
          id="lessonReminders"
          name="lessonReminders"
          defaultChecked={preferences.lessonReminders}
          className="sm:mt-1.5"
        />
      </SettingRow>
      {role === 'student' && (
        <SettingRow
          label={copy.homework}
          htmlFor="homeworkReminders"
          description={copy.homeworkHint}
        >
          <input type="hidden" name="homeworkRemindersPresent" value="true" />
          <Switch
            id="homeworkReminders"
            name="homeworkReminders"
            defaultChecked={preferences.homeworkReminders}
            className="sm:mt-1.5"
          />
        </SettingRow>
      )}
      <div className="px-(--card-spacing) py-4">
        <p className="text-sm font-medium">{copy.alwaysTitle}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {role === 'student' ? copy.alwaysStudent : copy.alwaysTeacher}
        </p>
      </div>
    </SettingsCard>
  )
}
