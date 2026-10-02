'use client'

import type { Cue } from './audio/cues'
import type { FilmCopy } from './copy'
import { SHOT_IDS, SHOT_TIMES } from './film'
import { Backdrop, Grain } from './fx/backdrop'
import { Hud } from './fx/hud'
import { SHOTS } from './shots'
import { FilmTimeProvider, HEIGHT, INK, ShotProvider, WIDTH } from './time'

/**
 * One frame of the promo film at time `t` (ms). Pure: the same `t` draws the same frame.
 *
 * Layers, back to front: the backdrop, every shot alive at `t` (later shots over earlier
 * ones, so an entrance can cover an exit), the HUD, then film grain over everything.
 */
export function Film({ t, copy }: { t: number; copy: FilmCopy }) {
  return (
    <FilmTimeProvider value={t}>
      <div
        data-film
        className="relative overflow-hidden text-white antialiased"
        style={{ width: WIDTH, height: HEIGHT, background: INK }}
      >
        <Backdrop />
        {SHOT_IDS.map((id) => {
          const { start, duration, lead, tail } = SHOT_TIMES[id]
          if (t < start - lead || t >= start + duration + tail) return null
          const { Shot } = SHOTS[id]

          return (
            <ShotProvider key={id} value={{ local: t - start, duration }}>
              <div className="absolute inset-0">
                <Shot copy={copy} />
              </div>
            </ShotProvider>
          )
        })}
        <Hud brand={copy.appName} chapterNames={copy.film.chapters} />
        <Grain />
      </div>
    </FilmTimeProvider>
  )
}

/** Every sound the picture asks for, on the film's own timeline. */
export function filmCues(): Cue[] {
  return SHOT_IDS.flatMap((id) =>
    SHOTS[id].cues.map((cue) => ({ ...cue, at: cue.at + SHOT_TIMES[id].start })),
  ).filter((cue) => cue.at >= 0)
}
