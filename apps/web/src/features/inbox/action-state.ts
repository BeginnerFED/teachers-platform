import type { ErrorCode } from '@tp/shared'

/**
 * Kept out of actions.ts because a "use server" module may only export async functions.
 */
export type SendState = {
  /** An API error code, translated where it is rendered. Never an English sentence. */
  error: ErrorCode | null
  sent: boolean
}

export const initialSendState: SendState = { error: null, sent: false }
