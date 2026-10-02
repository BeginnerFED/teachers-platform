import { counted, initials } from '@/lib/format'
import type { Messages } from '@/messages'

/**
 * What the live scene says, picked on the server from the page's dictionary.
 *
 * The room is the host's: their sentence under the title, the class's names on the
 * pointers and focus boxes, and the player's own buttons and verdict. The lesson on the
 * board is English, so it lives in the scene as data, not here.
 */
export function pickLiveCopy(t: Messages) {
  const locale = t.common.pickerLocale
  const people = t.loginPromo.people
  const room = (count: number) => `${t.live.hosting} · ${counted(count, t.live.people, locale)}`

  return {
    title: t.loginPromo.scenes.live.title,
    line: t.loginPromo.scenes.live.line,
    /** The room's sentence before Оля comes in, and after. */
    roomBefore: room(2),
    roomAfter: room(3),
    /** The participant stack: the host, then the class by name, as the room sorts it. */
    hostInitials: initials(t.live.classroom.you),
    olya: people.olyaShort,
    olyaInitials: initials(people.olya),
    maksym: people.maksymShort,
    maksymInitials: initials(people.maksym),
    /** After a name on a focus box: "Оля пише…". */
    typing: t.live.typing,
    fillGaps: t.library.blocks.fillGaps,
    step: `${t.library.player.step} 2 ${t.library.player.of} 4`,
    previous: t.library.player.previous,
    check: t.library.player.check,
    checking: t.library.player.checking,
    next: t.library.player.next,
    allCorrect: t.library.player.allCorrect,
  }
}

export type LiveCopy = ReturnType<typeof pickLiveCopy>
