'use client'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Messages } from '@/messages'
import { initialPasswordActionState, type PasswordActionState } from '../action-state'
import { changePassword } from '../actions'
import { SettingsCard } from './settings-card'

/** The three failures this form has that no API error code covers. */
function describe(error: NonNullable<PasswordActionState['error']>, t: Messages): string {
  if (error === 'wrong_password') return t.settings.security.wrongPassword
  if (error === 'mismatch') return t.settings.security.mismatch
  if (error === 'too_short') return t.settings.security.tooShort

  return t.errors[error]
}

export function SecurityCard({ t }: { t: Messages }) {
  return (
    <SettingsCard
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
      <div className="grid gap-5 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="currentPassword">{t.settings.security.current}</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="newPassword">{t.settings.security.next}</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FieldDescription>{t.settings.security.hint}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">{t.settings.security.confirm}</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </div>
    </SettingsCard>
  )
}
