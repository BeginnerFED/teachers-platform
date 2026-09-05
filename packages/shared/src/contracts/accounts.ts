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

export const accountIdParam = z.object({
  accountId: z.uuid(),
})

/**
 * A typo in a name or an address, fixed by whoever made the account. Either field on its
 * own; sending neither is a request that asks for nothing and is refused as such.
 */
export const updateAccountBody = createAccountBody
  .partial()
  .refine((body) => body.email !== undefined || body.fullName !== undefined, {
    message: 'Nothing to change',
  })

export type UpdateAccountBody = z.infer<typeof updateAccountBody>

export type AccountSummary = {
  id: string
  email: string
  fullName: string | null
}

/**
 * An account with a password that is being shown for the only time — a new one, or one
 * whose password was just reset. Generated on the server, returned once and stored nowhere
 * we can read again. If it is lost before it is passed on, it has to be reset again.
 */
export type CreatedAccount = AccountSummary & {
  temporaryPassword: string
}
