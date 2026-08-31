import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type Money,
  type PlatformSettings,
  type PublicSettings,
} from '@tp/shared'
import type { SettingsRow } from './settings.repository'

/**
 * A check constraint already limits the column to the supported set, so this only fires
 * if a language is dropped from the code while a row still names it. Falling back beats
 * rendering the app in a language it has no dictionary for.
 */
function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE
}

/** Null amount means no price has been set; a set amount always carries its currency. */
function toMoney(row: SettingsRow): Money | null {
  if (row.monthly_price_amount === null) return null

  return { amount: row.monthly_price_amount, currency: row.monthly_price_currency }
}

export function toPublicSettings(row: SettingsRow): PublicSettings {
  return {
    brandColor: row.brand_color,
    defaultLocale: toLocale(row.default_locale),
    trialDays: row.trial_days,
    monthlyPrice: toMoney(row),
  }
}

export function toPlatformSettings(row: SettingsRow): PlatformSettings {
  return {
    ...toPublicSettings(row),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_profile
      ? {
          id: row.updated_by_profile.id,
          fullName: row.updated_by_profile.full_name,
          email: row.updated_by_profile.email,
        }
      : null,
  }
}
