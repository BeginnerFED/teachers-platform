'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { updateMeBody, updateNotificationPreferencesBody, updateSettingsBody } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import { createClient } from '@/lib/supabase/server'
import type { PasswordActionState, SettingsActionState } from './action-state'
import { SETTINGS_TAG } from './api'

/**
 * Actions stay thin: parse with the same schema the API validates with, call it, tell the
 * cache what changed, report a code. No rule about what a setting means lives here.
 */
async function run(call: () => Promise<unknown>): Promise<SettingsActionState> {
  try {
    await call()
    revalidatePath('/admin/settings')
    revalidatePath('/dashboard/settings')
    revalidatePath('/student/settings')

    return { error: null, saved: true }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code, saved: false }

    throw error
  }
}

export async function updateProfile(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = updateMeBody.safeParse({
    fullName: formData.get('fullName'),
  })
  if (!parsed.success) return { error: 'validation_failed', saved: false }

  return run(async () => {
    const api = await getApi()
    const data = await unwrap(await api.v1.me.$patch({ json: parsed.data }))

    // The name and language are read straight from the profile by every layout, so the
    // whole tree is stale after this, not just the settings page.
    revalidatePath('/', 'layout')

    return data
  })
}

export async function updateNotificationPreferences(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = updateNotificationPreferencesBody.safeParse({
    lessonReminders: formData.get('lessonReminders') === 'on',
    ...(formData.has('homeworkRemindersPresent')
      ? { homeworkReminders: formData.get('homeworkReminders') === 'on' }
      : {}),
  })
  if (!parsed.success) return { error: 'validation_failed', saved: false }
  return run(async () => {
    const api = await getApi()
    return unwrap(await api.v1.me.notifications.preferences.$patch({ json: parsed.data }))
  })
}

export async function updateAppearance(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = updateSettingsBody.safeParse({
    brandColor: formData.get('brandColor'),
  })
  if (!parsed.success) return { error: 'validation_failed', saved: false }

  return run(async () => {
    const api = await getApi()
    const data = await unwrap(await api.v1.admin.settings.$patch({ json: parsed.data }))

    // The theme is a cached read shared by every page, including ones with no session.
    // updateTag rather than revalidateTag: this runs in a server action, and the admin
    // who just picked a colour should see it on the response to their own save, not be
    // served the old one while a refresh happens behind them.
    updateTag(SETTINGS_TAG)
    revalidatePath('/', 'layout')

    return data
  })
}

/** Blank means "no price set", which is a different thing from a price of zero. */
const optionalMinorUnits = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
    message: 'Expected a number',
  })

export async function updateSubscriptionDefaults(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const price = optionalMinorUnits.safeParse(formData.get('monthlyPrice') ?? '')
  if (!price.success) return { error: 'validation_failed', saved: false }

  const parsed = updateSettingsBody.safeParse({
    trialDays: Number(formData.get('trialDays')),
    // Entered in whole hryvnia and stored in kopiyky, so the field can say "499" and the
    // database can still hold a price with a fractional part later without a migration.
    monthlyPriceAmount: price.data === null ? null : Math.round(price.data * 100),
    monthlyPriceCurrency: formData.get('monthlyPriceCurrency'),
  })
  if (!parsed.success) return { error: 'validation_failed', saved: false }

  return run(async () => {
    const api = await getApi()

    return unwrap(await api.v1.admin.settings.$patch({ json: parsed.data }))
  })
}

const passwordChange = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((body) => body.newPassword === body.confirmPassword, { path: ['confirmPassword'] })

/**
 * The one action here that does not go through the API.
 *
 * Changing a password is a session concern rather than a business rule: it needs the
 * caller's own Supabase session, and routing it through a service-key API would mean
 * building an endpoint that can set anyone's password — a far larger thing to get wrong
 * than the one it would replace. The current password is checked first, because
 * updateUser on its own would let a borrowed session change the locks.
 */
export async function changePassword(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const raw = {
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  }

  const parsed = passwordChange.safeParse(raw)
  if (!parsed.success) {
    const tooShort = typeof raw.newPassword === 'string' && raw.newPassword.length < 8

    return { error: tooShort ? 'too_short' : 'mismatch', saved: false }
  }

  const supabase = await createClient()

  const { data: claims } = await supabase.auth.getClaims()
  const email = claims?.claims.email
  if (typeof email !== 'string') return { error: 'unauthorized', saved: false }

  const { error: wrongPassword } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })
  if (wrongPassword) return { error: 'wrong_password', saved: false }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return { error: 'internal', saved: false }

  revalidatePath('/', 'layout')

  return { error: null, saved: true }
}
