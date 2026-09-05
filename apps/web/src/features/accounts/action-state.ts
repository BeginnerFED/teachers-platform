import type { ErrorCode } from '@tp/shared'

export type NewAccountState = {
  /** An API error code, translated where it is rendered. Never an English sentence. */
  error: ErrorCode | null
  /**
   * Set once, on the response that made the account. The password exists nowhere else —
   * not readably in the database, not in a log — so if it is lost before it is passed on,
   * the account has to be made again.
   */
  created: { email: string; temporaryPassword: string } | null
}

export const initialNewAccountState: NewAccountState = { error: null, created: null }
