'use client'

import { LOCALES, type Locale } from '@tp/shared'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Messages } from '@/messages'
import { initialSettingsActionState } from '../action-state'
import { updateProfile } from '../actions'
import { SettingsCard } from './settings-card'

export function ProfileCard({
  fullName,
  email,
  locale,
  t,
}: {
  fullName: string | null
  email: string
  locale: Locale
  t: Messages
}) {
  return (
    <SettingsCard
      title={t.settings.profile.title}
      description={t.settings.profile.description}
      action={updateProfile}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fullName">{t.settings.profile.fullName}</FieldLabel>
          <Input id="fullName" name="fullName" defaultValue={fullName ?? ''} maxLength={120} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">{t.settings.profile.email}</FieldLabel>
          {/* Read-only rather than absent: an admin looking at this card wants to see
              which address the account uses, even while they cannot change it here. */}
          <Input id="email" value={email} readOnly disabled />
          <FieldDescription>{t.settings.profile.emailLocked}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="locale">{t.settings.profile.language}</FieldLabel>
          <Select name="locale" defaultValue={locale}>
            <SelectTrigger id="locale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t.locales[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SettingsCard>
  )
}
