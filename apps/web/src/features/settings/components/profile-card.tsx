'use client'

import { LOCALES, type Locale } from '@tp/shared'
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
import { SettingRow } from './setting-row'
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

      <SettingRow label={t.settings.profile.language} htmlFor="locale">
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
      </SettingRow>
    </SettingsCard>
  )
}
