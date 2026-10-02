import { FILM_DURATION } from '../film'
import type { Cue, CueKind } from './cues'
import { Bus, SAMPLE_RATE, Track } from './dsp'
import { addReverb, master } from './master'
import { findHits, writeScore } from './score'
import { duckCurve, playCue } from './voices'

/**
 * The film's soundtrack, synthesised offline: no samples, no files.
 *
 * The score (`score.ts`) and every sound the picture asks for (`voices.ts`) are computed
 * sample by sample onto one bus — a dry signal and a reverb send. The music is levelled and
 * ducks under the picture's big sounds before the effects go on top. OfflineAudioContexts run
 * the send through a convolution hall (`master.ts`), and the master chain finishes the mix:
 * true peaks at −1.5 dBTP, silence at both ends. Noise is seeded, so every render is identical.
 *
 * The mix is shaped so the drop (10–11 s) and the final hit (44.8 s) are the loudest moments:
 * the groove and the picture's sounds over it sit a little lower, and the hits get their weight
 * from bodies that hold rather than from spikes the limiter would only flatten.
 */
export { SAMPLE_RATE }

/** The level of the reverb return. */
const REVERB = 0.8

/** The music's level under the effects. */
const MUSIC = 0.87

/**
 * The music's level ride (film seconds): the intro stays dark and low under the picture's
 * pulses, and the groove sits under the drop and the climax so those read as the peaks.
 * Each ride ramps in and out over `ramp`.
 */
const RIDES = [
  { from: 0, to: 4, gain: 0.82, ramp: 0.3 },
  { from: 14.25, to: 41.75, gain: 0.82, ramp: 0.25 },
]

/**
 * Through the chapters (film seconds) the picture's sounds sit lower too, by kind: impacts
 * most, chimes a little less, the rest by 2 dB. The small UI sounds keep their level: they
 * have to read over the groove.
 */
const CHAPTERS = { from: 13.9, to: 42.3 }
const CHAPTER_LEVEL: Record<CueKind, number> = {
  impact: 0.7,
  chime: 0.75,
  whoosh: 0.8,
  suck: 0.8,
  riser: 0.8,
  sparkle: 0.8,
  glitch: 0.8,
  thud: 0.8,
  ding: 0.8,
  click: 1,
  pop: 1,
  tick: 1,
  type: 1,
}

function ride(time: number): number {
  let level = 1
  for (const { from, to, gain, ramp } of RIDES) {
    const inside = Math.min(
      1,
      Math.max(0, (time - from + ramp) / ramp),
      Math.max(0, (to + ramp - time) / ramp),
    )
    level *= 1 - (1 - gain) * inside
  }
  return level
}

/** A cue at its level in the mix. */
function inMix(cue: Cue): Cue {
  const time = cue.at / 1000
  if (!(time >= CHAPTERS.from && time < CHAPTERS.to)) return cue
  return { ...cue, gain: (cue.gain ?? 1) * (CHAPTER_LEVEL[cue.kind] ?? 1) }
}

export async function renderSoundtrack(
  cues: readonly Cue[],
  durationMs = FILM_DURATION,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil((durationMs / 1000) * SAMPLE_RATE))
  const output = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: SAMPLE_RATE })
  const left = output.getChannelData(0)
  const right = output.getChannelData(1)
  const bus = new Bus(
    new Track(left, right),
    new Track(new Float32Array(length), new Float32Array(length)),
  )
  const mixed = cues.map(inMix)

  // The music, then its level: under the effects, ducking for their big moments, riding
  // the sections, and faded to silence 200 ms before the end so the loop restarts cleanly.
  const hits = findHits(mixed)
  writeScore(bus, hits)
  const level = duckCurve(mixed, hits.accents, length)
  const fadeFrom = length - Math.round(0.7 * SAMPLE_RATE)
  const fadeTo = length - Math.round(0.2 * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    const fade =
      i < fadeFrom
        ? 1
        : i >= fadeTo
          ? 0
          : 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / (fadeTo - fadeFrom))
    level[i] *= MUSIC * fade * ride(i / SAMPLE_RATE)
  }
  bus.dry.scale(level)
  bus.wet.scale(level)

  // The picture's sounds on top, then the hall (stopping dead at the collapse, so the breath
  // before the final hit is silent but for the picture's inhale) and the master.
  for (const cue of mixed) playCue(bus, cue, hits.accents)
  await addReverb(bus.dry, bus.wet, REVERB, [hits.collapse])
  master(left, right)
  return output
}
