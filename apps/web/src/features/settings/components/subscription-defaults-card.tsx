'use client'

import type { Money } from '@tp/shared'
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
import { updateSubscriptionDefaults } from '../actions'
import { SettingRow } from './setting-row'
import { SettingsCard } from './settings-card'

/** The currencies a teacher in this market might actually be billed in. */
const CURRENCIES = ['UAH', 'EUR', 'USD', 'PLN'] as const

export function SubscriptionDefaultsCard({
  trialDays,
  monthlyPrice,
  t,
}: {
  trialDays: number
  monthlyPrice: Money | null
  t: Messages
}) {
  return (
    <SettingsCard
      title={t.settings.subscriptions.title}
      description={t.settings.subscriptions.description}
      action={updateSubscriptionDefaults}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      <SettingRow
        label={t.settings.subscriptions.trialDays}
        htmlFor="trialDays"
        description={t.settings.subscriptions.trialHint}
      >
        <Input
          id="trialDays"
          name="trialDays"
          type="number"
          min={0}
          max={365}
          step={1}
          defaultValue={trialDays}
          required
          className="tabular-nums"
        />
      </SettingRow>

      {/* Price and currency are one decision, so they share a row rather than sitting under
          two labels that would each be half of a sentence. */}
      <SettingRow
        label={t.settings.subscriptions.price}
        htmlFor="monthlyPrice"
        description={t.settings.subscriptions.priceHint}
      >
        <div className="flex items-center gap-2">
          {/* Shown and entered in whole currency; stored in minor units, so a price with a
              fractional part later needs no migration and no reinterpretation of old rows. */}
          <Input
            id="monthlyPrice"
            name="monthlyPrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={monthlyPrice ? monthlyPrice.amount / 100 : ''}
            placeholder={t.settings.subscriptions.notSet}
            className="tabular-nums"
          />

          <Select name="monthlyPriceCurrency" defaultValue={monthlyPrice?.currency ?? 'UAH'}>
            <SelectTrigger
              aria-label={t.settings.subscriptions.currency}
              className="w-28 shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingRow>
    </SettingsCard>
  )
}
