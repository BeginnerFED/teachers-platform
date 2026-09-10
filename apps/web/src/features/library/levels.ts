import { LEVELS, type Level } from '@tp/shared'

/**
 * Which level the sidebar has open, kept in a cookie rather than in this browser's storage.
 *
 * The sidebar is rendered by a layout, and there are eight of them — moving from the
 * library to the inbox builds a new one from scratch. React state would forget which level
 * was open on every such move, and local storage would remember it a frame too late, after
 * the server had already drawn the group closed. A cookie is the one store the server can
 * read while it renders, so the branch that was open comes back open.
 */
export const LEVEL_COOKIE = 'tp.level'

/** A year: a preference like this is not worth asking about twice. */
export const LEVEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** What the cookie says, if it says anything this app put there. */
export function levelFromCookie(value: string | undefined): Level | null {
  return LEVELS.find((level) => level === value) ?? null
}

/**
 * Writes down which level is open, from the browser, the way the sidebar's own open/closed
 * cookie is written (ui/sidebar.tsx). Nothing else to tell: the shell reads it while it
 * renders the next page.
 */
export function rememberLevel(level: Level | null) {
  document.cookie = `${LEVEL_COOKIE}=${level ?? ''}; path=/; max-age=${LEVEL_COOKIE_MAX_AGE}; samesite=lax`
}
