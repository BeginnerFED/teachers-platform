import { liveRepository, type LiveRepository, type OpenLiveRoom } from './live.repository'

/**
 * How long the list of open rooms is believed before it is read again. A room that has
 * closed goes on being taken for open at most this long: the price of not asking the
 * database about every picture that every participant loads.
 */
const OPEN_ROOMS_MS = 10_000
/**
 * A room missing from the list may have opened since it was read, so the list is read again
 * for it, but never sooner than this after the last read began however many such rooms are
 * asked about. A stream of made-up room ids costs the database two reads a second at most,
 * from however many addresses it comes; a room asked about sooner waits for that read rather
 * than being turned away, since a browser never asks again for a picture it was refused.
 */
const NEW_ROOM_MS = 500

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The rooms open right now, as one list in memory for everything a room's link alone may
 * reach: its files, and its board.
 */
export function createOpenRooms(live: Pick<LiveRepository, 'listOpen'>) {
  // The open rooms as last read, and when that read began: a room seen open then may have
  // closed since, and the time it might have is what OPEN_ROOMS_MS bounds.
  let rooms = new Map<string, OpenLiveRoom>()
  let readAt = Number.NEGATIVE_INFINITY
  // Reads are numbered as they begin; `seen` is the one the list above came from.
  let begun = 0
  let seen = 0
  let reading: Promise<void> | null = null
  // Done once NEW_ROOM_MS have passed since the last read began.
  let settling: Promise<void> = Promise.resolve()

  /** One read at a time; whoever asks while it is under way waits for that one. */
  function read(): Promise<void> {
    reading ??= (async () => {
      const number = ++begun
      const startedAt = Date.now()
      settling = sleep(NEW_ROOM_MS)
      try {
        const open = await live.listOpen()
        rooms = new Map(open.map((room) => [room.id, room]))
        readAt = startedAt
        seen = number
      } finally {
        reading = null
      }
    })()

    return reading
  }

  return {
    /** The room, if it is open. */
    async find(sessionId: string): Promise<OpenLiveRoom | null> {
      // Postgres prints a uuid in lower case and matches it in any case, so a link typed or
      // forwarded in upper case still names the same room.
      const id = sessionId.toLowerCase()
      const asked = begun
      if (Date.now() - readAt >= OPEN_ROOMS_MS) await read()

      // A read that began after this was asked has seen the room, if it is open. One already
      // under way when it was asked may have begun before the room opened.
      while (!rooms.has(id) && seen <= asked) {
        if (reading) await reading
        else {
          await settling
          if (!reading && seen <= asked) await read()
        }
      }

      return rooms.get(id) ?? null
    },
  }
}

export type OpenRooms = ReturnType<typeof createOpenRooms>

export const openRooms = createOpenRooms(liveRepository)
