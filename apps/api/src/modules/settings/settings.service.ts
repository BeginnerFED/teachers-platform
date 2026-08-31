import type {
  PlatformSettings,
  PublicSettings,
  TablesUpdate,
  UpdateSettingsBody,
} from '@tp/shared'
import { InternalError } from '../../http/errors'
import { toPlatformSettings, toPublicSettings } from './settings.mapper'
import { settingsRepository, type SettingsRepository } from './settings.repository'

export type SettingsServiceDeps = {
  settings: SettingsRepository
}

/**
 * Only the keys the caller actually sent are turned into columns. That distinction
 * matters for the price, where null is a real value — "no price set" — and must not be
 * confused with "this request said nothing about the price".
 */
function toColumns(body: UpdateSettingsBody): TablesUpdate<'platform_settings'> {
  const patch: TablesUpdate<'platform_settings'> = {}

  if (body.brandColor !== undefined) patch.brand_color = body.brandColor
  if (body.defaultLocale !== undefined) patch.default_locale = body.defaultLocale
  if (body.trialDays !== undefined) patch.trial_days = body.trialDays
  if (body.monthlyPriceAmount !== undefined) patch.monthly_price_amount = body.monthlyPriceAmount
  if (body.monthlyPriceCurrency !== undefined) {
    patch.monthly_price_currency = body.monthlyPriceCurrency
  }

  return patch
}

export function createSettingsService({ settings }: SettingsServiceDeps) {
  /**
   * The row is created by the migration that defines the table and cannot be deleted
   * through the API, so its absence is a broken database rather than a state to handle.
   * Saying so plainly beats serving defaults that quietly disagree with what is stored.
   */
  async function requireRow() {
    const row = await settings.get()
    if (!row) throw new InternalError('Platform settings row is missing')

    return row
  }

  return {
    async getPublic(): Promise<PublicSettings> {
      return toPublicSettings(await requireRow())
    },

    async getForAdmin(): Promise<PlatformSettings> {
      return toPlatformSettings(await requireRow())
    },

    async update({
      body,
      actorId,
    }: {
      body: UpdateSettingsBody
      actorId: string
    }): Promise<PlatformSettings> {
      const row = await settings.update({ ...toColumns(body), updated_by: actorId })
      if (!row) throw new InternalError('Platform settings row is missing')

      return toPlatformSettings(row)
    },
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>

export const settingsService = createSettingsService({ settings: settingsRepository })
