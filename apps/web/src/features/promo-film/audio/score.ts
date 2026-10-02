import { SECTIONS } from '../film'
import { BAR, BEAT } from '../time'
import type { Cue } from './cues'
import {
  type Bus,
  type Placement,
  SAMPLE_RATE,
  TAU,
  clamp,
  fadeTail,
  frames,
  hz,
  panGains,
  random,
  semitones,
  smooth,
  unity,
} from './dsp'
import {
  type Stereo,
  bass,
  bell,
  boom,
  clap,
  clockTick,
  crash,
  drone,
  hat,
  heartbeat,
  kick,
  lead,
  pad,
  pluck,
  reversed,
  rim,
  riser,
  snare,
  tom,
} from './instruments'
import { cueLength } from './voices'

/**
 * The score: 48 s at 120 BPM, following the film's sections.
 *
 * intro    0–4    dark A drone, a heartbeat on the beats, swelling into the logo hit (Fmaj9)
 * tension  4–10   a clock, nervous hats, a pad rising through Am – F/A – Esus4 – E7(♭9) with
 *                 its filter opening; it never resolves, and drains away into the implosion
 * drop     10–14  three stabs F – G – A on «Поверніть / собі / час» (♭VI – ♭VII – I: the minor
 *                 problem turns major), then the beat
 * groove   14–42  A major, D – A – E – F#m a bar each, four on the floor; the plucks develop
 *                 every eight bars; a bar of breakdown, then the hook lands at 30 s; a fill
 *                 before every chapter
 * climax   42–45  E: a snare roll, a riser and a filter sweep lifting into the collapse, then
 *                 silence: the picture's inhale has the breath before the last hit to itself
 * outro    45–48  one warm Amaj9, ringing out to silence before the loop starts again
 *
 * Where the picture's own big moments may drift (the implosion, the collapse, the final hit),
 * the score reads them from the cues so the music lands with the image.
 */

const BEAT_S = BEAT / 1000
const BAR_S = BAR / 1000
const STEP = BEAT_S / 4

type SectionId = (typeof SECTIONS)[number]['id']
const SECTION = Object.fromEntries(
  SECTIONS.map(({ id, start, end }) => [id, { start: start / 1000, end: end / 1000 }]),
) as Record<SectionId, { start: number; end: number }>

/** Peak levels of the score's parts before the master (pads and stabs: RMS ≈ 0.58 × level). */
const LEVEL = {
  kick: 0.55,
  punch: 0.5,
  clap: 0.3,
  snare: 0.26,
  hat: 0.075,
  open: 0.07,
  shaker: 0.035,
  rim: 0.07,
  tom: 0.3,
  crash: 0.075,
  bass: 0.34,
  pad: 0.15,
  stab: 0.52,
  pluck: 0.14,
  lead: 0.3,
  boom: 0.62,
  heart: 0.38,
  clock: 0.15,
  bell: 0.07,
  riser: 0.16,
}

export type Hits = {
  /** The dot explodes into the logo. */
  logo: number
  /** «Неділя, 23:47» slams in. */
  slam: number
  /** The pile-up collapses into one point. */
  implosion: number
  /** «Поверніть / собі / час». */
  stabs: readonly [number, number, number]
  /** The orbit collapses. */
  collapse: number
  /** The end lockup lands. */
  final: number
  /** Musical hits: an impact cue here merges with the music instead of ducking it. */
  accents: readonly number[]
}

/** The score's sync points, snapped to the picture's cues where the picture moved them. */
export function findHits(cues: readonly Cue[]): Hits {
  const impacts = cues
    .filter((cue) => cue.kind === 'impact' && Number.isFinite(cue.at))
    .map((cue) => cue.at / 1000)
    .sort((a, b) => a - b)
  const suckEnds = cues
    .filter((cue) => cue.kind === 'suck' && Number.isFinite(cue.at))
    .map((cue) => cue.at / 1000 + cueLength(cue))
  const firstImpact = (from: number, to: number) => impacts.find((t) => t >= from && t <= to)
  const lastSuck = (from: number, to: number) => {
    const ends = suckEnds.filter((t) => t >= from && t <= to)
    return ends.length ? Math.max(...ends) : undefined
  }

  const logo = firstImpact(1.85, 2.15) ?? 2
  const slam = firstImpact(3.85, 4.65) ?? SECTION.tension.start
  const implosion = clamp(lastSuck(8.9, 9.95) ?? firstImpact(9.3, 9.9) ?? 9.6, 9.2, 9.9)
  const stabs = [
    SECTION.drop.start,
    SECTION.drop.start + BEAT_S,
    SECTION.drop.start + 2 * BEAT_S,
  ] as const
  const final = firstImpact(44.55, 45.25) ?? SECTION.outro.start
  // The build stops when the picture collapses, always leaving a breath before the last hit.
  const collapse = Math.min(final - 0.15, clamp(lastSuck(44.2, 45.1) ?? 44.8, 44.2, 45))
  return { logo, slam, implosion, stabs, collapse, final, accents: [logo, slam, ...stabs, final] }
}

type Chord = {
  /** Bass root, its fifth, and the note that walks into this chord from the bar before. */
  root: number
  fifth: number
  approach: number
  pad: readonly number[]
  arp: readonly number[]
}

/** A major: IV – I – V – vi, voiced to move by step. */
const CHORD = {
  D: { root: 38, fifth: 45, approach: 40, pad: [57, 62, 66, 69, 73], arp: [74, 78, 81, 85] },
  A: { root: 33, fifth: 40, approach: 35, pad: [57, 61, 64, 69, 71], arp: [73, 76, 81, 83] },
  E: { root: 40, fifth: 47, approach: 38, pad: [56, 59, 64, 68, 71], arp: [71, 76, 80, 83] },
  Fsm: { root: 42, fifth: 49, approach: 44, pad: [57, 61, 66, 69, 73], arp: [73, 78, 81, 85] },
} satisfies Record<string, Chord>

const LOOP: Chord[] = [CHORD.D, CHORD.A, CHORD.E, CHORD.Fsm]

type Degree = 'root' | 'octave' | 'fifth' | 'approach'
/** [sixteenth, degree, length in sixteenths, velocity] */
type BassStep = readonly [number, Degree, number, number]

/** Offbeat-led house bass; the last note walks into the next chord. */
const BASS_A: readonly BassStep[] = [
  [0, 'root', 1.5, 0.7],
  [2, 'root', 1.5, 1],
  [5, 'root', 0.8, 0.55],
  [6, 'octave', 1.5, 0.9],
  [8, 'root', 1.5, 0.7],
  [10, 'root', 1.5, 1],
  [13, 'fifth', 0.8, 0.7],
  [14, 'approach', 1.5, 0.9],
]

/** Busier for the hook: octave pickups on the sixteenths. */
const BASS_B: readonly BassStep[] = [
  [0, 'root', 1, 0.7],
  [2, 'root', 1, 1],
  [3, 'octave', 0.8, 0.6],
  [5, 'root', 0.8, 0.6],
  [6, 'octave', 1.5, 0.95],
  [8, 'root', 1, 0.7],
  [10, 'root', 1, 1],
  [11, 'octave', 0.8, 0.65],
  [12, 'fifth', 1, 0.75],
  [13, 'root', 0.8, 0.6],
  [14, 'approach', 1.5, 0.95],
]

/** 3 + 3 + 2, twice: the rhythm of the plucks and the hook. */
const TRESILLO = [0, 3, 6, 8, 11, 14]

/** The first motif: up and back down the chord on the tresillo. [sixteenth, arp index, velocity] */
const MOTIF: readonly (readonly [number, number, number])[] = [
  [0, 0, 1],
  [3, 1, 0.75],
  [6, 2, 0.85],
  [8, 3, 0.95],
  [11, 2, 0.75],
  [14, 1, 0.8],
]

// prettier-ignore
/**
 * The hook, from 30 s: two bars of call (D, A), two of answer a step higher (E, F#m), then
 * the call again turning upward into the climax. [bar, sixteenth, note, length in sixteenths]
 */
const HOOK: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 81, 2], [0, 3, 78, 2], [0, 6, 81, 2], [0, 8, 85, 3], [0, 11, 83, 2], [0, 14, 81, 2],
  [1, 0, 85, 2], [1, 3, 83, 2], [1, 6, 81, 2], [1, 8, 76, 5],
  [2, 0, 83, 2], [2, 3, 80, 2], [2, 6, 83, 2], [2, 8, 88, 3], [2, 11, 85, 2], [2, 14, 83, 2],
  [3, 0, 85, 2], [3, 3, 81, 2], [3, 6, 78, 2], [3, 8, 81, 5], [3, 14, 80, 2],
  [4, 0, 81, 2], [4, 3, 78, 2], [4, 6, 81, 2], [4, 8, 85, 3], [4, 11, 83, 2], [4, 14, 81, 2],
  [5, 0, 85, 2], [5, 3, 83, 2], [5, 6, 81, 2], [5, 8, 81, 1], [5, 9, 83, 1], [5, 10, 85, 2], [5, 12, 88, 2], [5, 14, 83, 2],
]

/** Fmaj9, F3 A3 C4 E4 G4 C5 (the boom is its root): the logo's chord, and the ♭VI the turn starts from. */
const LOGO = [53, 57, 60, 64, 67, 72]

/** Beats where the kick drops out for a fill (before 30 s the whole breakdown bar is out). */
const DROPOUTS = [13.5, 21.5]

/**
 * The bar before the hook (film seconds): the kick and the bass drop out and the chord closes
 * down, then opens up under the snare build, so the hook lands at 30 s as an event.
 */
const BREAKDOWN = 28

type Kit = {
  kick: Float32Array
  punch: Float32Array
  clap: Stereo
  clapB: Stereo
  snare: Stereo
  crack: Stereo
  hat: Float32Array
  hatB: Float32Array
  open: Float32Array
  shaker: Float32Array
  rim: Float32Array
  crash: Stereo
  heart: Float32Array
  tick: Float32Array
  tock: Float32Array
  toms: { hi: Float32Array; mid: Float32Array; lo: Float32Array }
}

function makeKit(): Kit {
  return {
    kick: kick(),
    punch: kick({ decay: 0.09, punch: 1.3, click: 0.5, seed: 12 }),
    clap: clap(),
    clapB: clap({ seed: 24, tone: 1220 }),
    snare: snare(),
    crack: snare({ seed: 34, tone: 210, decay: 0.16, bright: 1.25 }),
    hat: hat(),
    hatB: hat({ seed: 43, decay: 0.022 }),
    open: hat({ seed: 47, decay: 0.11, tone: 1.6 }),
    shaker: hat({ seed: 49, decay: 0.04, attack: 0.004, tone: 2.1, cutoff: 5200 }),
    rim: rim(),
    crash: crash(),
    heart: heartbeat(),
    tick: clockTick(false),
    tock: clockTick(true, { seed: 9 }),
    toms: { hi: tom(55), mid: tom(50, { seed: 52 }), lo: tom(45, { seed: 53, decay: 0.26 }) },
  }
}

type Score = {
  bus: Bus
  kit: Kit
  hits: Hits
  /** Sidechain pumps from the kick: deep for pads, lighter for bass, light for keys. */
  pumpPad: Float32Array
  pumpBass: Float32Array
  pumpKeys: Float32Array
  rnd: () => number
  memo: Map<string, Float32Array | Stereo>
}

/** Writes the whole score onto `bus` (dry and reverb send). */
export function writeScore(bus: Bus, hits: Hits) {
  const kicks = kickTimes(hits)
  const score: Score = {
    bus,
    kit: makeKit(),
    hits,
    pumpPad: pumpCurve(kicks, bus.length, 0.6, 0.27),
    pumpBass: pumpCurve(kicks, bus.length, 0.4, 0.2),
    pumpKeys: pumpCurve(kicks, bus.length, 0.22, 0.18),
    rnd: random(4242),
    memo: new Map(),
  }
  intro(score)
  tension(score)
  drop(score)
  groove(score)
  fills(score)
  climax(score)
  outro(score)
  for (const at of kicks) bus.mono(score.kit.kick, at, { gain: LEVEL.kick, send: 0.03 })
  // Whatever still rings at the collapse (the last kick, snares, plucks) stops with it.
  silence(bus, hits.collapse, hits.final)
}

/** Every kick, from the drop's second bar to the collapse, but for the dropouts and the breakdown. */
function kickTimes(hits: Hits): number[] {
  const times: number[] = []
  for (let t = SECTION.drop.start + BAR_S; t < SECTION.groove.end - 1e-6; t += BEAT_S) {
    const breakdown = t > BREAKDOWN - 1e-6 && t < BREAKDOWN + BAR_S - 1e-6
    if (!breakdown && !DROPOUTS.some((d) => Math.abs(d - t) < 1e-6)) times.push(t)
  }
  const c = SECTION.climax.start
  for (const t of [c, c + 0.5, c + 1, c + 1.5, c + 2, c + 2.25, c + 2.5]) {
    if (t < hits.collapse - 0.12) times.push(t)
  }
  return times
}

/** A sidechain pump: a quick dip at each kick, breathing back over `release`. */
function pumpCurve(
  kicks: readonly number[],
  length: number,
  depth: number,
  release: number,
): Float32Array {
  const curve = unity(length)
  const attack = frames(0.004)
  const rel = frames(release)
  for (const at of kicks) {
    const start = frames(at)
    for (let i = 0; i < attack + rel; i++) {
      const index = start + i
      if (index < 0 || index >= length) continue
      const dip = i < attack ? i / attack : 1 - smooth((i - attack) / rel)
      const g = 1 - depth * dip
      if (g < curve[index]) curve[index] = g
    }
  }
  return curve
}

/** Silences the score (dry and send) from `from` until `to`, after a 10 ms fade. */
function silence(bus: Bus, from: number, to: number) {
  const start = Math.max(0, frames(from))
  const end = Math.min(bus.length, frames(to))
  const fade = frames(0.01)
  for (let i = start; i < end; i++) {
    const g = i - start < fade ? 0.5 + 0.5 * Math.cos((Math.PI * (i - start)) / fade) : 0
    for (const track of [bus.dry, bus.wet]) {
      track.left[i] *= g
      track.right[i] *= g
    }
  }
}

/** The first `seconds` of a one-shot, faded out over its last 30 ms. */
function cut(signal: Float32Array, seconds: number): Float32Array {
  const out = signal.slice(0, Math.min(signal.length, frames(seconds)))
  fadeTail(out, 0.03)
  return out
}

/** An echo's far side comes 10 ms late, so the echoes open the field out instead of sitting in it. */
const SPREAD = 0.01

/** A mono echo, equal-power panned, its far side late. */
function echoAt(bus: Bus, signal: Float32Array, at: number, pan: number, placement: Placement) {
  const [gl, gr] = panGains(pan)
  const gain = placement.gain ?? 1
  bus.stereo(signal, signal, pan < 0 ? at : at + SPREAD, { ...placement, gain: gain * gl, pan: -1 })
  bus.stereo(signal, signal, pan < 0 ? at + SPREAD : at, { ...placement, gain: gain * gr, pan: 1 })
}

/** A stereo echo, one side late. */
function stereoEchoAt(
  bus: Bus,
  [left, right]: Stereo,
  at: number,
  lateRight: boolean,
  placement: Placement,
) {
  bus.stereo(left, left, lateRight ? at : at + SPREAD, { ...placement, pan: -1 })
  bus.stereo(right, right, lateRight ? at + SPREAD : at, { ...placement, pan: 1 })
}

function memo<T extends Float32Array | Stereo>(score: Score, key: string, make: () => T): T {
  const hit = score.memo.get(key)
  if (hit) return hit as T
  const made = make()
  score.memo.set(key, made)
  return made
}

const crashAt = ({ bus, kit }: Score, at: number, gain: number) =>
  bus.stereo(kit.crash[0], kit.crash[1], at, { gain: LEVEL.crash * gain, send: 0.25 })

/** A cymbal played backwards, its attack landing exactly on `at`. */
function reverseCrash({ bus, kit }: Score, at: number, length: number, gain = 1) {
  const [left, right] = reversed(kit.crash, length)
  bus.stereo(left, right, at - length, { gain: LEVEL.crash * 1.4 * gain, send: 0.2 })
}

function snareAt({ bus, kit }: Score, at: number, velocity: number) {
  bus.stereo(kit.snare[0], kit.snare[1], at, { gain: LEVEL.snare * velocity, send: 0.2 })
}

function riserInto({ bus }: Score, end: number, length: number, gain: number, seed: number) {
  const [left, right] = riser(length, {
    seed,
    from: 320,
    to: 8000,
    base: 110,
    octaves: 2,
    tone: 0.3,
    gate: 0.25,
  })
  bus.stereo(left, right, end - length, { gain: LEVEL.riser * gain, send: 0.22 })
}

function intro(score: Score) {
  const { bus, kit, hits } = score
  const { logo, slam } = hits

  // A dark A drone breathing in under the heartbeat, opening as it swells into the hit.
  pad(bus, {
    notes: [33, 45, 52],
    start: 0.04,
    end: logo,
    swell: 2.4,
    release: 0.04,
    cutoff: (t) => 150 + 1100 * smooth(t / logo) ** 2,
    q: 1.2,
    gain: 0.09,
    detune: 6,
    send: 0.25,
    seed: 101,
  })
  drone(bus, { note: 33, start: 0.1, end: logo, gain: 0.06, attack: 1.6, release: 0.04 })

  // The heartbeat on the beats, closer each time (the dot pulses with it).
  for (let k = 1; k <= 3; k++)
    bus.mono(kit.heart, k * BEAT_S, { gain: LEVEL.heart * (0.55 + 0.15 * k), send: 0.1 })

  // The inhale: a reversed cymbal and the logo chord blooming backwards into the hit.
  reverseCrash(score, logo, 0.9, 0.9)
  pad(bus, {
    notes: LOGO.slice(1),
    start: logo - 0.55,
    end: logo,
    swell: 5,
    release: 0.004,
    cutoff: (t) => 500 + 3500 * smooth((t - logo + 0.55) / 0.55),
    gain: 0.14,
    send: 0.45,
    seed: 102,
  })

  // The hit: a sub, a punch, Fmaj9 blooming warm, a shimmer of bells.
  bus.mono(boom(29, { decay: 0.7 }), logo, { gain: LEVEL.boom * 0.5 })
  bus.mono(kit.punch, logo, { gain: LEVEL.punch * 0.8 })
  pad(bus, {
    notes: LOGO,
    start: logo,
    end: slam - 0.3,
    attack: 0.006,
    decay: 1.1,
    release: 0.3,
    voices: 5,
    detune: 7,
    cutoff: (t) => 900 + 3400 * Math.exp(-(t - logo) / 0.5),
    q: 0.8,
    gain: 0.14,
    send: 0.45,
    seed: 103,
  })
  ;[84, 88, 91, 93].forEach((note, k) =>
    bus.mono(bell(hz(note), { decay: 1.1, index: 1.4, ratio: 2 }), logo + 0.02 + k * 0.07, {
      gain: LEVEL.bell,
      pan: -0.45 + 0.3 * k,
      send: 0.55,
    }),
  )

  // A low hum creeping in under the wordmark, into the slam.
  pad(bus, {
    notes: [33, 40],
    start: slam - 1,
    end: slam,
    swell: 3.5,
    release: 0.004,
    cutoff: (t) => 120 + 600 * smooth(t - slam + 1),
    gain: 0.1,
    send: 0.1,
    seed: 104,
  })
}

function tension(score: Score) {
  const { bus, kit, hits } = score
  const { slam, implosion } = hits
  const drainFrom = implosion - 0.6
  const fall = (t: number) => smooth((t - drainFrom) / (implosion - drainFrom))

  // Everything here drains away into the implosion, and drops in pitch as it goes.
  const drain = unity(bus.length)
  for (let i = Math.max(0, frames(drainFrom)); i < bus.length; i++)
    drain[i] = 1 - fall(i / SAMPLE_RATE)
  const tapeStop = (t: number) => (t < drainFrom ? 1 : 2 ** -(fall(t) ** 1.5))

  // The slam: a dark low hit and a cold metallic ring. (The cluster and the ring are what a
  // laptop hears of it, so they are not too dark or too quiet.)
  bus.mono(boom(33, { decay: 0.55 }), slam, { gain: LEVEL.boom * 0.5 })
  bus.mono(kit.punch, slam, { gain: LEVEL.punch * 0.6 })
  pad(bus, {
    notes: [45, 52, 57, 60, 64],
    start: slam,
    end: slam + 0.5,
    attack: 0.004,
    decay: 0.45,
    release: 0.4,
    detune: 12,
    cutoff: (t) => 300 + 2400 * Math.exp(-(t - slam) / 0.2),
    q: 1.1,
    gain: 0.13,
    send: 0.4,
    seed: 201,
  })
  bus.mono(bell(hz(57), { decay: 0.9, index: 3.5, ratio: 3.51 }), slam, {
    gain: LEVEL.bell * 1.8,
    send: 0.5,
  })

  // A pedal A under all of it.
  drone(bus, {
    note: 33,
    start: slam,
    end: implosion,
    gain: 0.06,
    attack: 1.5,
    release: 0.02,
    curve: drain,
  })

  // The pad climbs Am(add9) – F/A – Esus4 – E7(♭9) while its filter opens. It never resolves.
  const open = (t: number) =>
    260 * 13 ** smooth((t - slam) / (drainFrom - slam)) * (1 - 0.85 * fall(t))
  const chords = [
    [slam, 6, [57, 64, 71, 72, 76]],
    [6, 8, [57, 65, 69, 72, 77]],
    [8, 9, [52, 59, 64, 69, 71]],
    [9, implosion, [52, 56, 62, 65, 71]],
  ] as const
  chords.forEach(([from, to, notes], k) =>
    pad(bus, {
      notes,
      start: from,
      end: to,
      attack: k === 0 ? 0.9 : 0.1,
      release: k === chords.length - 1 ? 0.02 : 0.1,
      cutoff: open,
      q: 1.6 + k * 0.4,
      gain: [0.05, 0.11, 0.22, 0.32][k],
      detune: 11,
      send: 0.35,
      curve: drain,
      bend: tapeStop,
      seed: 210 + k,
    }),
  )

  // The clock, on the beats.
  for (let t = slam + BEAT_S; t < drainFrom + 0.3; t += BEAT_S) {
    const tock = Math.round(t / BEAT_S) % 2 === 1
    const urgency = 0.8 + 0.5 * smooth((t - slam) / (drainFrom - slam))
    bus.mono(tock ? kit.tock : kit.tick, t, {
      gain: LEVEL.clock * urgency,
      pan: tock ? -0.15 : 0.15,
      send: 0.12,
      curve: drain,
    })
  }

  // Nervous hats from the second bar: uneven sixteenths, ratchets near the end.
  const rnd = random(301)
  for (let t = 6; t < implosion - 0.1; t += STEP) {
    const pos = Math.round(t / STEP) % 4
    const v = [0.55, 0.35, 1, 0.4][pos] * (0.7 + 0.6 * rnd()) * (0.5 + 0.9 * smooth((t - 6) / 3))
    bus.mono(kit.hatB, t, { gain: LEVEL.hat * 1.2 * v, pan: 0.25, send: 0.05, curve: drain })
    if (t > 7.9 && rnd() < 0.2)
      bus.mono(kit.hatB, t + STEP / 2, { gain: LEVEL.hat * v * 0.7, pan: 0.32, curve: drain })
  }

  // A low pulse on the eighths, tightening: A, then E, then the ♭9.
  for (let t = 6; t < implosion - 0.05; t += STEP * 2) {
    const note = t < 8 ? 33 : t < 9 ? 40 : 41
    const grow = smooth((t - 6) / 3)
    const tone = bass(note, STEP * 0.8, {
      velocity: 0.6 + 0.4 * grow,
      bright: 0.3 + 0.45 * grow,
      seed: frames(t),
    })
    bus.mono(tone, t, { gain: LEVEL.bass * (0.6 + 0.6 * grow), curve: drain })
  }

  // A riser under the pile-up, drained with the rest.
  const [ul, ur] = riser(implosion - 7.4, {
    seed: 302,
    from: 300,
    to: 6000,
    base: 110,
    octaves: 2,
    tone: 0.3,
    gate: 0.2,
  })
  bus.stereo(ul, ur, 7.4, { gain: LEVEL.riser * 2.2, send: 0.2, curve: drain })

  // The inhale before the turn: the F chord swelling backwards into the first stab.
  const [first] = hits.stabs
  pad(bus, {
    notes: [53, 57, 60, 65, 69],
    start: implosion + 0.02,
    end: first,
    swell: 4.5,
    release: 0.004,
    cutoff: (t) => 500 + 5000 * smooth((t - implosion) / (first - implosion)),
    gain: 0.15,
    send: 0.3,
    seed: 220,
  })
  reverseCrash(score, first, first - implosion, 0.8)
}

function drop(score: Score) {
  const { bus, kit, hits, pumpPad } = score
  const [s1, s2, s3] = hits.stabs
  const stabs = [
    { at: s1, until: s2, notes: [53, 57, 60, 65, 69, 72, 77], sub: 29 },
    { at: s2, until: s3, notes: [55, 59, 62, 67, 71, 74, 79], sub: 31 },
    { at: s3, until: s3 + 1, notes: [57, 61, 64, 69, 73, 76, 81], sub: 33 },
  ]
  // Each stab's weight is a sustained boom rather than a sharp transient: the master would only
  // flatten a spike, while a body that holds reads as the loudest moment. The F and G booms hold
  // to the next stab and hand over to it; the A one rings, a little shorter than the chord, so
  // the picture's accents just after it still read.
  stabs.forEach(({ at, until, notes, sub }, k) => {
    const last = k === stabs.length - 1
    pad(bus, {
      notes,
      start: at,
      end: until - 0.035,
      attack: 0.003,
      decay: last ? 0.9 : 0.6,
      release: last ? 1 : 0.03,
      voices: 5,
      detune: 9,
      cutoff: (t) => 1500 + 9500 * Math.exp(-(t - at) / 0.2),
      q: 0.9,
      gain: LEVEL.stab,
      send: 0.35,
      seed: 400 + k,
    })
    const low = last ? boom(sub, { decay: 1.2 }) : cut(boom(sub, { decay: 0.45 }), until - at)
    bus.mono(low, at, { gain: LEVEL.boom * 0.8 })
    bus.mono(kit.punch, at, { gain: LEVEL.punch * 0.3 })
    bus.stereo(kit.crack[0], kit.crack[1], at, { gain: LEVEL.snare * 0.8, send: 0.35 })
  })
  crashAt(score, s3, 2.4)

  // The A chord rings on under the ring-out; the beat comes in on the next bar.
  const beatIn = SECTION.drop.start + BAR_S
  pad(bus, {
    notes: CHORD.A.pad,
    start: s3 + 0.25,
    end: SECTION.groove.start,
    attack: 0.8,
    release: 0.12,
    cutoff: (t) => 1000 + 1800 * smooth((t - beatIn) / BAR_S),
    q: 0.9,
    gain: LEVEL.pad * 1.8,
    send: 0.3,
    curve: pumpPad,
    seed: 410,
  })
  reverseCrash(score, beatIn, 0.75)
  crashAt(score, beatIn, 1.2)
  bar(score, beatIn, CHORD.A, CHORD.D, 'pre')

  // A snare run and a lift into the groove.
  ;[0.35, 0.45, 0.6, 0.8].forEach((v, k) => snareAt(score, beatIn + 3 * BEAT_S + k * STEP, v))
  riserInto(score, SECTION.groove.start, BAR_S / 2, 0.8, 411)
}

type Stage = 'pre' | 'verse' | 'build' | 'break' | 'hook'
const BRIGHT: Record<Stage, number> = { pre: 0.45, verse: 0.55, build: 0.7, break: 0.7, hook: 0.85 }

function groove(score: Score) {
  const { start, end } = SECTION.groove
  for (let t0 = start; t0 < end - 1e-6; t0 += BAR_S) {
    const index = Math.round((t0 - start) / BAR_S)
    const stage: Stage =
      t0 < start + 4 * BAR_S
        ? 'verse'
        : Math.abs(t0 - BREAKDOWN) < 1e-6
          ? 'break'
          : t0 < start + 8 * BAR_S
            ? 'build'
            : 'hook'
    bar(score, t0, LOOP[index % 4], LOOP[(index + 1) % 4], stage, index - 8)
  }
}

/** One bar of the groove: drums, bass, chord, plucks, and from 30 s the hook. */
function bar(score: Score, t0: number, chord: Chord, next: Chord, stage: Stage, hookBar = -1) {
  const { bus, kit, rnd, pumpPad, pumpBass, pumpKeys } = score
  const lifted = stage === 'build' || stage === 'break' || stage === 'hook'
  const breakdown = stage === 'break'

  // Claps on two and four (from the drop's bar and in the breakdown only on two: four is the
  // snare run).
  bus.stereo(kit.clap[0], kit.clap[1], t0 + BEAT_S, { gain: LEVEL.clap, send: 0.22 })
  if (stage !== 'pre' && !breakdown)
    bus.stereo(kit.clapB[0], kit.clapB[1], t0 + 3 * BEAT_S, { gain: LEVEL.clap, send: 0.22 })

  // Hats (right) against the shaker (left): sixteenths led by the offbeat; they open up from
  // the second chapter, and close again for the breakdown.
  const opens =
    (lifted && !breakdown) || (stage === 'verse' && t0 >= SECTION.groove.start + 2 * BAR_S)
  for (let s = 0; s < 16; s++) {
    const t = t0 + s * STEP
    const pos = s % 4
    if (pos === 2 && opens) {
      bus.mono(kit.open, t, { gain: LEVEL.open * (0.9 + 0.2 * rnd()), pan: -0.2, send: 0.06 })
      continue
    }
    const v =
      (stage === 'pre' ? [0, 0.12, 0.7, 0.15] : [0.32, 0.18, 0.68, 0.24])[pos] *
      (0.88 + 0.24 * rnd()) *
      (breakdown ? 0.7 : 1)
    if (v > 0)
      bus.mono(s % 2 ? kit.hatB : kit.hat, t, { gain: LEVEL.hat * v, pan: 0.35, send: 0.04 })
  }
  if (lifted) {
    for (let s = 0; s < 16; s++) {
      bus.mono(kit.shaker, t0 + s * STEP, {
        gain: LEVEL.shaker * [0.5, 0.8, 0.6, 0.95][s % 4],
        pan: -0.35,
        send: 0.05,
      })
    }
  }
  if (stage === 'hook') {
    bus.mono(kit.rim, t0 + 3 * STEP, { gain: LEVEL.rim, pan: 0.45, send: 0.12 })
    bus.mono(kit.rim, t0 + 10 * STEP, { gain: LEVEL.rim * 0.7, pan: 0.45, send: 0.12 })
  }

  // Bass (none in the breakdown).
  for (const [step, degree, length, velocity] of breakdown
    ? []
    : stage === 'hook'
      ? BASS_B
      : BASS_A) {
    const note =
      degree === 'root'
        ? chord.root
        : degree === 'octave'
          ? chord.root + 12
          : degree === 'fifth'
            ? chord.fifth
            : next.approach
    const tone = memo(score, `bass:${note}:${length}:${velocity}:${stage}`, () =>
      bass(note, length * STEP, { velocity, bright: BRIGHT[stage], seed: note * 31 + step }),
    )
    bus.mono(tone, t0 + step * STEP, { gain: LEVEL.bass, curve: pumpBass })
  }

  // The chord, pumping, five saws a note across the whole field. (Over the drop's bar the A
  // chord is already held.) In the breakdown it closes down and opens up again over the bar;
  // under the hook it steps back 3 dB for the lead.
  if (stage !== 'pre') {
    const base = stage === 'verse' ? 1700 : stage === 'build' ? 2200 : 2900
    const wave = (t: number) =>
      1 + 0.15 * Math.sin((TAU * (t - SECTION.groove.start)) / (4 * BAR_S))
    pad(bus, {
      notes: chord.pad,
      start: t0,
      end: t0 + BAR_S,
      attack: 0.03,
      release: 0.12,
      cutoff: breakdown ? (t) => 450 * 6 ** smooth((t - t0) / BAR_S) : (t) => base * wave(t),
      q: breakdown ? 1.4 : 0.9,
      gain: LEVEL.pad * (stage === 'hook' ? 0.7 : breakdown ? 1.15 : 1),
      voices: 5,
      detune: 6,
      send: 0.3,
      curve: pumpPad,
      seed: 600 + Math.round(t0),
    })
  }

  // Plucks with dotted-eighth echoes, ping-ponging. The motif develops every eight bars:
  // a sparse tresillo first, then rolling sixteenths, then under the hook only the tresillo
  // accents, low, to leave the lead the room.
  const pluckAt = (note: number, at: number, velocity: number, gain: number, pan: number) => {
    const tone = memo(score, `pluck:${note}:${velocity}`, () =>
      pluck(note, { velocity, seed: note * 17 }),
    )
    const echo = memo(score, `pluck:${note}:echo`, () =>
      pluck(note, { velocity: 0.6, bright: 0.5, seed: note * 19 }),
    )
    bus.mono(tone, at, { gain: LEVEL.pluck * gain, pan, send: 0.25, curve: pumpKeys })
    echoAt(bus, echo, at + 3 * STEP, -pan, {
      gain: LEVEL.pluck * gain * 0.32,
      send: 0.3,
      curve: pumpKeys,
    })
    echoAt(bus, echo, at + 6 * STEP, pan, {
      gain: LEVEL.pluck * gain * 0.13,
      send: 0.3,
      curve: pumpKeys,
    })
  }
  if (stage === 'verse') {
    for (const [step, index, velocity] of MOTIF) {
      pluckAt(chord.arp[index], t0 + step * STEP, velocity, velocity, index % 2 ? 0.3 : -0.3)
    }
  }
  if (lifted) {
    for (let s = 0; s < 16; s++) {
      const accent = TRESILLO.includes(s)
      if (stage === 'hook' && !accent) continue
      const velocity = accent ? 1 : 0.6
      pluckAt(
        chord.arp[s % 3],
        t0 + s * STEP,
        velocity,
        velocity * (stage === 'hook' ? 0.3 : 0.8),
        s % 2 ? 0.35 : -0.35,
      )
    }
  }

  // The hook, its echoes ping-ponging wide.
  if (stage === 'hook') {
    for (const [hb, step, note, length] of HOOK) {
      if (hb !== hookBar) continue
      const velocity = step === 0 || step === 8 ? 1 : 0.82
      const [left, right] = memo(score, `lead:${note}:${length}:${velocity}`, () =>
        lead(note, length * STEP, { velocity, seed: note * 13 }),
      )
      const at = t0 + step * STEP
      bus.stereo(left, right, at, { gain: LEVEL.lead * velocity, send: 0.25, curve: pumpKeys })
      stereoEchoAt(bus, [right, left], at + 3 * STEP, false, {
        gain: LEVEL.lead * velocity * 0.28,
        send: 0.35,
        curve: pumpKeys,
      })
      stereoEchoAt(bus, [left, right], at + 6 * STEP, true, {
        gain: LEVEL.lead * velocity * 0.11,
        send: 0.35,
        curve: pumpKeys,
      })
    }
  }
}

/** A fill into every chapter (every 4 s), each one different, and crashes on the downbeats. */
function fills(score: Score) {
  const { bus, kit } = score
  const tomAt = (at: number, which: keyof Kit['toms'], v: number, pan: number) =>
    bus.mono(kit.toms[which], at, { gain: LEVEL.tom * v, pan, send: 0.15 })

  crashAt(score, 14, 1)

  // → 02 (18 s): a snare run.
  ;[0.35, 0.45, 0.6, 0.8].forEach((v, k) => snareAt(score, 17.5 + k * STEP, v))

  // → 03 (22 s): the kick drops out under a reversed cymbal.
  reverseCrash(score, 22, 0.9)
  crashAt(score, 22, 0.55)

  // → 04 (26 s): toms falling left to right.
  tomAt(25.5, 'hi', 0.6, 0.35)
  tomAt(25.625, 'hi', 0.5, 0.35)
  tomAt(25.75, 'mid', 0.65, 0)
  tomAt(25.875, 'lo', 0.8, -0.35)

  // → 05 (30 s), the eight-bar turn into the hook: a two-beat snare build and a lift.
  ;[
    [29, 0.3],
    [29.25, 0.35],
    [29.5, 0.45],
    [29.625, 0.5],
    [29.75, 0.6],
    [29.875, 0.75],
    [29.9375, 0.85],
  ].forEach(([at, v]) => snareAt(score, at, v))
  riserInto(score, 30, 1, 0.8, 501)
  crashAt(score, 30, 1.1)

  // → 06 (34 s): a clap flam.
  bus.stereo(kit.clapB[0], kit.clapB[1], 33.75, { gain: LEVEL.clap * 0.6, send: 0.22 })
  bus.stereo(kit.clap[0], kit.clap[1], 33.875, { gain: LEVEL.clap * 0.8, send: 0.22 })

  // → 07 (38 s): toms and a reversed cymbal.
  tomAt(37.5, 'hi', 0.55, -0.35)
  tomAt(37.75, 'mid', 0.65, 0)
  tomAt(37.875, 'lo', 0.8, 0.35)
  reverseCrash(score, 38, 0.8, 0.8)
  crashAt(score, 38, 0.6)

  // → the climax (42 s): snare eighths into sixteenths over a long lift.
  ;[
    [41, 0.3],
    [41.25, 0.38],
    [41.5, 0.46],
    [41.625, 0.54],
    [41.75, 0.62],
    [41.875, 0.72],
  ].forEach(([at, v]) => snareAt(score, at, v))
  riserInto(score, 42, 2, 0.7, 502)
}

function climax(score: Score) {
  const { bus, kit, hits, pumpPad, pumpBass, pumpKeys } = score
  const start = SECTION.climax.start
  const end = hits.collapse
  const span = end - start
  const u = (t: number) => clamp((t - start) / span)
  const sweep = (t: number) => 700 * 14 ** smooth(u(t))

  // E, a breath of Esus4, E again — the filter opening all the way, everything pumping.
  const E = [52, 56, 59, 64, 68, 71]
  const SUS = [52, 57, 59, 64, 69, 71]
  const segments = [
    [start, start + 2, E, 1.05],
    [start + 2, start + 2.4, SUS, 1.2],
    [start + 2.4, end, E, 1.3],
  ] as const
  segments.forEach(([from, to, notes, gain], k) => {
    if (from >= end) return
    pad(bus, {
      notes,
      start: from,
      end: Math.min(to, end),
      attack: k === 0 ? 0.02 : 0.03,
      release: k === segments.length - 1 || to >= end ? 0.012 : 0.05,
      cutoff: sweep,
      q: 2.2,
      gain: LEVEL.pad * gain * 1.1,
      detune: 12,
      send: 0.3,
      curve: pumpPad,
      seed: 700 + k,
    })
  })

  // Bass: eighths, then sixteenths, then out for the last stretch.
  for (let t = start; t < Math.min(start + 2, end - 0.1); t += t < start + 1 ? 2 * STEP : STEP) {
    const tone = memo(score, `climax-bass:${t < start + 1}`, () =>
      bass(40, t < start + 1 ? 1.6 * STEP : 0.8 * STEP, { velocity: 0.9, bright: 0.8, seed: 40 }),
    )
    bus.mono(tone, t, { gain: LEVEL.bass * (0.75 + 0.25 * u(t)), curve: pumpBass })
  }

  // The snare roll: eighths, sixteenths, thirty-seconds, swelling and rising in pitch.
  for (let t = start, k = 0; t < end - 0.03; k++) {
    const x = u(t)
    const rise = Math.round(9 * x)
    const [left, right] = memo(score, `roll:${rise}`, () =>
      snare({ seed: 900 + rise, tone: 190 * semitones(rise), decay: 0.08 + 0.004 * rise }),
    )
    bus.stereo(left, right, t, {
      gain: LEVEL.snare * 1.3 * (0.28 + 0.72 * x ** 1.6),
      pan: k % 2 ? 0.08 : -0.08,
      send: 0.25,
    })
    t += t < start + 1 ? 2 * STEP : t < start + 2 ? STEP : STEP / 2
  }

  // Hats keep running underneath.
  for (let t = start; t < end - 0.05; t += STEP) {
    bus.mono(kit.hat, t, { gain: LEVEL.hat * (0.4 + 0.5 * u(t)), pan: 0.35, send: 0.04 })
  }

  // The plucks climb the E chord.
  const tones = [64, 68, 71, 76, 80, 83, 88]
  for (let t = start, k = 0; t < end - 0.05; t += STEP, k++) {
    const note = tones[(k % 4) + Math.min(3, Math.floor(u(t) * 4))]
    const tone = memo(score, `pluck:${note}:climb`, () =>
      pluck(note, { velocity: 0.85, seed: note * 23 }),
    )
    bus.mono(tone, t, {
      gain: LEVEL.pluck * (0.5 + 0.6 * u(t)),
      pan: k % 2 ? 0.3 : -0.3,
      send: 0.3,
      curve: pumpKeys,
    })
  }

  // One long lift, cut dead at the collapse. (The build stays under the final hit: that is
  // the film's peak.)
  const [left, right] = riser(span, {
    seed: 710,
    from: 300,
    to: 12000,
    base: 82.4,
    octaves: 3,
    tone: 0.45,
    gate: 0.35,
  })
  bus.stereo(left, right, start, { gain: LEVEL.riser * 2, send: 0.25 })
}

function outro(score: Score) {
  const { bus, kit, hits } = score
  const at = hits.final
  const silent = SECTION.outro.end - 0.45

  // The last hit: a sub, a punch, a cymbal, and one big warm Amaj9 ringing out. Its weight is
  // the chord and the boom, not the punch's spike. (No bells: the end lockup's chime and pops
  // play over it and must stay clear.)
  bus.mono(boom(33, { decay: 0.9 }), at, { gain: LEVEL.boom })
  bus.mono(kit.punch, at, { gain: LEVEL.punch * 0.5 })
  crashAt(score, at, 2.2)
  pad(bus, {
    notes: [45, 52, 57, 61, 64, 68, 71, 76],
    start: at,
    end: silent - 0.7,
    attack: 0.008,
    decay: 1.1,
    release: 0.7,
    voices: 5,
    detune: 8,
    cutoff: (t) => 900 + 4200 * Math.exp(-(t - at) / 0.6),
    q: 0.75,
    gain: LEVEL.stab * 1.05,
    send: 0.5,
    seed: 801,
  })
}
