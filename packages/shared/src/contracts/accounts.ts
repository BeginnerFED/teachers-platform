import { z } from 'zod'

/**
 * Making an account for somebody else. Administrators, teachers and students are all
 * created the same way and differ only in the role they are given — so the shape is
 * declared once here rather than three times with the same two fields.
 *
 * There is no mail server yet, so nothing is emailed: the server generates a password,
 * hands it back exactly once, and it travels from one person to another.
 */
export const createAccountBody = z.object({
  email: z.email().max(254).trim().toLowerCase(),
  fullName: z.string().trim().min(1).max(120),
})

export type CreateAccountBody = z.infer<typeof createAccountBody>

export type CreatedAccount = {
  id: string
  email: string
  fullName: string | null
  /**
   * Generated on the server, returned once and stored nowhere we can read again. If it is
   * lost before it is passed on, the account has to be made afresh.
   */
  temporaryPassword: string
}
