import type { Instrumentation } from 'next'

/** Correlate a rendered error's digest with a structured server log entry. */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String(error.digest)
      : undefined
  // Route templates identify the failing screen without logging tokens, query strings,
  // form answers, cookies or student names. Next retains the original server error.
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'web_request_failed',
      time: new Date().toISOString(),
      digest,
      method: request.method,
      route: context.routePath,
      type: context.routeType,
    }),
  )
}
