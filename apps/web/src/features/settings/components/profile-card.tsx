'use client'

import { Input } from '@/components/ui/input'
import type { Messages } from '@/messages'
import { initialSettingsActionState } from '../action-state'
import { updateProfile } from '../actions'
import { SettingRow } from './setting-row'
import { SettingsCard } from './settings-card'

export function ProfileCard({
  id,
  fullName,
  email,
  t,
}: {
  id: string
  fullName: string | null
  email: string
  t: Messages
}) {
  return (
    <SettingsCard
      id={id}
      title={t.settings.profile.title}
      description={t.settings.profile.description}
      action={updateProfile}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      <SettingRow label={t.settings.profile.fullName} htmlFor="fullName">
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName ?? ''}
          maxLength={120}
          required
        />
      </SettingRow>

      {/* Read-only rather than absent: an admin looking at this card wants to see which
          address the account uses, even while they cannot change it here. */}
      <SettingRow
        label={t.settings.profile.email}
        htmlFor="email"
        description={t.settings.profile.emailLocked}
      >
        <Input id="email" value={email} readOnly disabled />
      </SettingRow>
    </SettingsCard>
  )
}
