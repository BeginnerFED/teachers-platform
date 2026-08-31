import type { ErrorCode } from '@tp/shared'

export type AdminActionState = {
  /** An API error code, translated where it is rendered. Never an English sentence. */
  error: ErrorCode | null
  /**
   * Set once, on the response that created the account. The password exists nowhere else
   * — not in the database in a readable form, not in a log — so if this is lost before it
   * is passed on, the account has to be recreated.
   */
  invited: { email: string; temporaryPassword: string } | null
  removed: boolean
}

export const initialAdminActionState: AdminActionState = {
  error: null,
  invited: null,
  removed: false,
}
