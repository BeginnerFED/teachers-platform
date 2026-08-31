/**
 * Kept out of actions.ts because a "use server" module may only export async
 * functions — a plain object there fails the build.
 */
export type AuthState = {
  error: string | null
  notice: string | null
}

export const initialAuthState: AuthState = { error: null, notice: null }
