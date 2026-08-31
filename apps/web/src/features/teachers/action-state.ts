import type { ErrorCode } from '@tp/shared'

/**
 * Kept out of actions.ts because a "use server" module may only export async functions.
 * Mirrors the shape already used by the auth forms.
 */
export type TeacherActionState = {
  /** An API error code, translated where it is rendered. Never an English sentence. */
  error: ErrorCode | null
  /** Which action just succeeded, so the UI can say the right thing. */
  done: 'extended' | 'suspended' | 'reactivated' | null
}

export const initialTeacherActionState: TeacherActionState = { error: null, done: null }
