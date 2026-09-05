import { randomBytes } from 'node:crypto'
import type {
  AccountSummary,
  CreateAccountBody,
  CreatedAccount,
  Enums,
  UpdateAccountBody,
} from '@tp/shared'
import { ConflictError, InternalError, NotFoundError, RuleViolationError } from '../../http/errors'
import { accountsRepository, type AccountsRepository } from './accounts.repository'

/**
 * Twelve random bytes, base64url-encoded into sixteen characters. Long enough that it
 * cannot be guessed and short enough to be read down a phone line, which is how it will
 * actually travel until this platform has a mail server.
 */
function generatePassword(): string {
  return randomBytes(12).toString('base64url')
}

export type AccountsServiceDeps = {
  accounts: AccountsRepository
}

/**
 * Every account on this platform is made here — administrator, teacher or student — so
 * that "how somebody gets in" is one piece of code rather than three that drift. The role
 * is the only thing that differs between them, and it is never taken from a request body:
 * each caller states it.
 */
export function createAccountsService({ accounts }: AccountsServiceDeps) {
  return {
    async create(body: CreateAccountBody, role: Enums<'user_role'>): Promise<CreatedAccount> {
      const password = generatePassword()

      // The role travels in app_metadata and a database trigger carries it onto the new
      // profile. GoTrue writes that field in a second statement after inserting the user,
      // so the outcome is checked rather than assumed: if the ordering ever changes, this
      // repairs the account instead of leaving one that is listed as a teacher without
      // actually being one.
      const id = await accounts.create({ ...body, password, role })

      if ((await accounts.findRoleById(id)) !== role) await accounts.setRole(id, role)

      const profile = await accounts.findProfile(id)

      // The trigger that writes the profile runs inside the same transaction as the auth
      // insert, so an account without one is a broken installation rather than a race.
      if (!profile) throw new InternalError('The new account has no profile')

      return {
        id,
        email: profile.email,
        fullName: profile.full_name,
        temporaryPassword: password,
      }
    },

    /**
     * A fresh password, shown once, for somebody who has lost theirs. There is no mail
     * server to send a reset link through, so this is the only way back into an account —
     * which is why it belongs to the administrator and not to a form on the login page.
     */
    async resetPassword(accountId: string, actorId: string): Promise<CreatedAccount> {
      // Your own password is changed under Settings, where the old one is asked for. A
      // reset that skips that check is for other people's accounts.
      if (accountId === actorId) {
        throw new RuleViolationError('Change your own password under settings')
      }

      const profile = await accounts.findProfile(accountId)
      if (!profile) throw new NotFoundError('No such account')

      const password = generatePassword()
      await accounts.setPassword(accountId, password)

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        temporaryPassword: password,
      }
    },

    async update(accountId: string, body: UpdateAccountBody): Promise<AccountSummary> {
      const existing = await accounts.findProfile(accountId)
      if (!existing) throw new NotFoundError('No such account')

      if (body.email !== undefined && (await accounts.emailTaken(body.email, accountId))) {
        throw new ConflictError('That email is already registered')
      }

      await accounts.updateProfile(accountId, body)

      const profile = await accounts.findProfile(accountId)
      if (!profile) throw new NotFoundError('No such account')

      return { id: profile.id, email: profile.email, fullName: profile.full_name }
    },
  }
}

export type AccountsService = ReturnType<typeof createAccountsService>

export const accountsService = createAccountsService({ accounts: accountsRepository })
