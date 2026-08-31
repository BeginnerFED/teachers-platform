/**
 * Shared between the development reading aid's button and its server-side reader.
 * Both sides are only ever reached through a dynamic import inside a
 * `process.env.NODE_ENV === 'development'` branch, so this file is absent from a
 * production bundle entirely — cookie name included.
 */
export const DEV_LOCALE_COOKIE = 'dev-locale'
export const DEV_LOCALE = 'tr'
