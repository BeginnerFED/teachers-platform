import { randomBytes } from 'node:crypto'
import type { CreateAccountBody, CreatedAccount, Enums } from '@tp/shared'
import { InternalError } from '../../http/errors'
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
  }
}

export type AccountsService = ReturnType<typeof createAccountsService>

export const accountsService = createAccountsService({ accounts: accountsRepository })
