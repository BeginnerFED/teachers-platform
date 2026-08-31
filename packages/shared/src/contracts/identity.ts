import { z } from 'zod'
import { LOCALES, type Locale, type Role } from '../constants'

export type MeProfile = {
  id: string
  email: string
  fullName: string | null
  role: Role
  locale: Locale
  createdAt: string
}

/**
 * Email is deliberately absent. Changing it means Supabase mailing a confirmation to both
 * the old and the new address, and until that link has somewhere to land the change would
 * be accepted here and then silently never take effect.
 */
export const updateMeBody = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send at least one field to change',
  })

export type UpdateMeBody = z.infer<typeof updateMeBody>
