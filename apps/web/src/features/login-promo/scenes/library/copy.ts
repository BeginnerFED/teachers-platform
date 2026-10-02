import { counted } from '@/lib/format'
import type { Messages } from '@/messages'
import { PICKED_SHELF, SHELF, type ShelfLesson } from './data'

/**
 * What the library scene says, picked on the server from the page's dictionary.
 *
 * The toolbar and every card use the library's own strings, and each card's quiet line is
 * finished here exactly as MaterialCard writes it — "3 кроки · ≈ 20 хв" — where the
 * locale, and with it the right plural, is known.
 */
export function pickLibraryCopy(t: Messages) {
  const locale = t.common.pickerLocale

  const card = (lesson: ShelfLesson) => ({
    id: lesson.id,
    title: lesson.title,
    level: lesson.level,
    meta: `${counted(lesson.steps, t.library.units.steps, locale)} · ≈ ${lesson.minutes} ${t.library.card.minutes}`,
  })

  return {
    title: t.loginPromo.scenes.library.title,
    line: t.loginPromo.scenes.library.line,
    tabs: {
      platform: t.library.tabs.platform,
      mine: t.library.tabs.mine,
      all: t.library.tabs.all,
    },
    search: t.library.searchPlaceholder,
    allLevels: t.library.allLevels,
    shelf: SHELF.map(card),
    picked: PICKED_SHELF.map(card),
  }
}

export type LibraryCopy = ReturnType<typeof pickLibraryCopy>
