import { pickPromoCopy } from '@/features/login-promo/copy'
import type { Messages } from '@/messages'

/**
 * The words the promo film draws, picked on the server from the page's dictionary — so a
 * Turkish render exists for review, while the shipped film is Ukrainian.
 */
export function pickFilmCopy(t: Messages) {
  return {
    appName: t.app.name,
    tagline: t.app.tagline,
    description: t.app.description,
    film: t.promoFilm,
    /** 'Викладач' / 'Учень' — the two sides of a live lesson. */
    roles: t.roles,
    /** The made-up class every scene shares. */
    people: t.loginPromo.people,
    /** The sign-in tour's copy: the filmed product screens read it. */
    promo: pickPromoCopy(t),
  }
}

export type FilmCopy = ReturnType<typeof pickFilmCopy>
