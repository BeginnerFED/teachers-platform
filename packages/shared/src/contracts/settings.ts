import { z } from 'zod'
import { LOCALES, type Locale } from '../constants'

/**
 * Lowercase because the database constraint on brand_color only accepts lowercase hex.
 * Normalising here rather than rejecting a capitalised value keeps a colour pasted from
 * a design tool from being an error the admin has to decode.
 */
export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a six-digit hex colour, for example #ff4f01')
  .transform((value) => value.toLowerCase())

/** ISO 4217. Stored uppercase; the database constraint enforces the same shape. */
export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Expected a three-letter currency code, for example UAH')

/**
 * A million hryvnia a month is not a price, it is a typo. The ceiling exists to catch
 * someone entering minor units into a field labelled in whole currency.
 */
const MAX_PRICE_MINOR_UNITS = 100_000_00

export const updateSettingsBody = z
  .object({
    brandColor: hexColor.optional(),
    defaultLocale: z.enum(LOCALES).optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    /** Null clears the price back to "not set", which is not the same as free. */
    monthlyPriceAmount: z.number().int().min(0).max(MAX_PRICE_MINOR_UNITS).nullable().optional(),
    monthlyPriceCurrency: currencyCode.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send at least one field to change',
  })

export type UpdateSettingsBody = z.infer<typeof updateSettingsBody>

export type Money = {
  /** Minor units — kopiyky for UAH, cents for EUR. */
  amount: number
  currency: string
}

/**
 * What anyone may see, signed in or not. The login page is themed from this, so it has
 * to be readable before there is a session to read it with.
 */
export type PublicSettings = {
  brandColor: string
  defaultLocale: Locale
  /** How long a new teacher's trial runs. Applied at signup; running trials keep their date. */
  trialDays: number
  /** Null until an admin sets one. */
  monthlyPrice: Money | null
}

/** The same settings plus the audit trail, which only an admin gets. */
export type PlatformSettings = PublicSettings & {
  updatedAt: string
  updatedBy: { id: string; fullName: string | null; email: string } | null
}
