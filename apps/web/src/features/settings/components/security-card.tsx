'use client'

import { Input } from '@/components/ui/input'
import type { Messages } from '@/messages'
import { initialPasswordActionState, type PasswordActionState } from '../action-state'
import { changePassword } from '../actions'
import { SettingRow } from './setting-row'
import { SettingsCard } from './settings-card'

/** The three failures this form has that no API error code covers. */
function describe(error: NonNullable<PasswordActionState['error']>, t: Messages): string {
  if (error === 'wrong_password') return t.settings.security.wrongPassword
  if (error === 'mismatch') return t.settings.security.mismatch
  if (error === 'too_short') return t.settings.security.tooShort

  return t.errors[error]
}

export function SecurityCard({ id, t }: { id: string; t: Messages }) {
  return (
    <SettingsCard
      id={id}
      title={t.settings.security.title}
      description={t.settings.security.description}
      action={changePassword}
      initialState={initialPasswordActionState}
      describeError={(error) => describe(error, t)}
      successMessage={t.settings.security.changed}
      submitLabel={t.settings.security.submit}
      pendingLabel={t.settings.security.submitting}
      resetOnSuccess
    >
      <SettingRow label={t.settings.security.current} htmlFor="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </SettingRow>

      {/* The length rule sits with the field it governs rather than under a neighbour. */}
      <SettingRow
        label={t.settings.security.next}
        htmlFor="newPassword"
        description={t.settings.security.hint}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </SettingRow>

      <SettingRow label={t.settings.security.confirm} htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </SettingRow>
    </SettingsCard>
  )
}
