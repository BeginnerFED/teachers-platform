import type { ErrorCode } from '@tp/shared'

/**
 * Kept out of actions.ts because a "use server" module may only export async functions.
 *
 * One state shape per card rather than one for the page: each card saves on its own, and
 * a shared state would let a failure in one of them light up the others.
 */
export type SettingsActionState = {
  /** An API error code, translated where it is rendered. Never an English sentence. */
  error: ErrorCode | null
  saved: boolean
}

export const initialSettingsActionState: SettingsActionState = { error: null, saved: false }

/**
 * The password form has its own failures, which are not API error codes: the current
 * password can be wrong, and the confirmation can disagree with what was typed above it.
 */
export type PasswordActionState = {
  error: ErrorCode | 'wrong_password' | 'mismatch' | 'too_short' | null
  saved: boolean
}

export const initialPasswordActionState: PasswordActionState = { error: null, saved: false }
