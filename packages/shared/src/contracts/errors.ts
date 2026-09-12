/**
 * The failure vocabulary, shared by whoever raises it and whoever renders it.
 *
 * A client switches on the code and looks up its own wording; the message that travels
 * with it is English and meant for logs. That keeps translation in one place, and means
 * a future mobile app localises the same failure the same way as the web app.
 */
export const ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'subscription_required',
  'not_found',
  'validation_failed',
  'conflict',
  'rule_violation',
  'too_many_requests',
  'upstream_unavailable',
  'internal',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ApiErrorEnvelope = {
  error: {
    code: ErrorCode
    message: string
    requestId: string
    details: unknown
  }
}
