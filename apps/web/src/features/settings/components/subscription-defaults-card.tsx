'use client'

import type { Money } from '@tp/shared'
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
import { updateSubscriptionDefaults } from '../actions'
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
      note={t.settings.subscriptions.trialHint}
      action={updateSubscriptionDefaults}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="trialDays">{t.settings.subscriptions.trialDays}</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor="monthlyPrice">{t.settings.subscriptions.price}</FieldLabel>
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
          <FieldDescription>{t.settings.subscriptions.priceHint}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="monthlyPriceCurrency">
            {t.settings.subscriptions.currency}
          </FieldLabel>
          <Select name="monthlyPriceCurrency" defaultValue={monthlyPrice?.currency ?? 'UAH'}>
            <SelectTrigger id="monthlyPriceCurrency" className="w-full">
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
        </Field>
      </div>
    </SettingsCard>
  )
}
