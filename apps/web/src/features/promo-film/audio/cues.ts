/**
 * Sound effects the picture asks for. Each shot lists its own cues at shot-local times; the
 * soundtrack collects them onto the film's timeline, so a click on screen and the click
 * you hear are the same moment by construction.
 */
export type CueKind =
  /** Air rushing past: transitions, things flying in. `duration` sets its length. */
  | 'whoosh'
  /** A whoosh sucked backwards: implosions, things collapsing to a point. */
  | 'suck'
  /** A UI click: pointer presses, toggles, checkboxes. */
  | 'click'
  /** A soft bubble pop: something small appearing (a gap, a chip, a dot). */
  | 'pop'
  /** A bright two-note chime: something right, done, sent. */
  | 'chime'
  /** A deep hit with a tail: big type landing, a reveal, the drop. */
  | 'impact'
  /** Rising noise and pitch building to a hit at `at + duration`. */
  | 'riser'
  /** A dry tick: counters, clock seconds, typing. */
  | 'tick'
  /** A notification ding. */
  | 'ding'
  /** A quick run of key taps over `duration`. */
  | 'type'
  /** A shimmering sparkle: AI, magic, a burst of particles. */
  | 'sparkle'
  /** A short digital glitch: chaos, errors, too many tabs. */
  | 'glitch'
  /** A low thud: something heavy landing, cards stacking. */
  | 'thud'

export type Cue = {
  /** Milliseconds: shot-local where a shot lists it, film time once collected. */
  at: number
  kind: CueKind
  /** 0–1, default 1. */
  gain?: number
  /** −1 (left) to 1 (right), default 0. */
  pan?: number
  /** Semitones up or down, default 0. */
  pitch?: number
  /** For sounds with a length (whoosh, riser, type), in ms. */
  duration?: number
}
