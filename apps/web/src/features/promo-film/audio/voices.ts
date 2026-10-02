import type { Cue, CueKind } from './cues'
import {
  type Bus,
  Osc,
  SAMPLE_RATE,
  Svf,
  TAU,
  clamp,
  decayRate,
  fadeTail,
  frames,
  hash,
  noise,
  panGains,
  random,
  semitones,
  sine,
  smooth,
  soft,
} from './dsp'
import { bell, riser } from './instruments'

/**
 * The picture's sound effects: one voice per cue kind, shaped by the cue's gain, pan, pitch
 * and duration, and seeded by the cue itself so a cue always sounds the same.
 */

const SR = SAMPLE_RATE

/** Peak level of each kind at gain 1, before the master. */
const PEAK: Record<CueKind, number> = {
  whoosh: 0.48,
  suck: 0.5,
  click: 0.34,
  pop: 0.46,
  chime: 0.3,
  impact: 0.85,
  riser: 0.42,
  tick: 0.36,
  ding: 0.3,
  type: 0.45,
  sparkle: 0.38,
  glitch: 0.34,
  thud: 0.64,
}

/** Default length (ms) and the range a cue's `duration` is held to, for kinds with a length. */
const LENGTH: Partial<Record<CueKind, readonly [number, number, number]>> = {
  whoosh: [650, 90, 6000],
  suck: [700, 120, 6000],
  riser: [1500, 200, 12000],
  type: [700, 60, 8000],
  sparkle: [700, 150, 4000],
  glitch: [260, 60, 2000],
}

/** How long a cue's sound is shaped over, in seconds. */
export function cueLength(cue: Cue): number {
  const range = LENGTH[cue.kind]
  if (!range) return 0.1
  const [fallback, min, max] = range
  const ms =
    typeof cue.duration === 'number' && Number.isFinite(cue.duration) ? cue.duration : fallback
  return clamp(ms, min, max) / 1000
}

const KIND_SEED: Record<CueKind, number> = {
  whoosh: 1,
  suck: 2,
  click: 3,
  pop: 4,
  chime: 5,
  impact: 6,
  riser: 7,
  tick: 8,
  ding: 9,
  type: 10,
  sparkle: 11,
  glitch: 12,
  thud: 13,
}

type Spec = {
  /** Film seconds: where the cue sits in the score (for its key). */
  time: number
  pan: number
  /** The cue's semitones, and the frequency ratio they make. */
  semis: number
  pitch: number
  length: number
  seed: number
  /** An impact that lands on a musical hit: the music carries the low end there. */
  aligned: boolean
}

/** A voice's output: stereo layers, each with its own reverb send; `post` scales after levelling. */
type Layer = { left: Float32Array; right: Float32Array; send: number; post?: number }

const isAccent = (time: number, accents: readonly number[]) =>
  accents.some((a) => Math.abs(a - time) <= 0.06)

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Renders one cue onto the bus. */
export function playCue(bus: Bus, cue: Cue, accents: readonly number[]) {
  if (!Number.isFinite(cue.at) || !(cue.kind in VOICES)) return
  const level = clamp(finite(cue.gain, 1), 0, 1.5)
  if (level <= 0) return
  const start = cue.at / 1000
  const semis = clamp(finite(cue.pitch, 0), -24, 24)
  const spec: Spec = {
    time: start,
    pan: clamp(finite(cue.pan, 0), -1, 1),
    semis,
    pitch: semitones(semis),
    length: cueLength(cue),
    seed: hash(
      cue.at,
      KIND_SEED[cue.kind],
      finite(cue.pitch, 0),
      finite(cue.duration, 0),
      finite(cue.pan, 0),
    ),
    aligned: cue.kind === 'impact' && isAccent(start, accents),
  }
  const layers = VOICES[cue.kind](spec)

  // Level the voice by the peak of its layers' sum, so `gain` reads as a peak level.
  let peak = 0
  const longest = Math.max(...layers.map((layer) => layer.left.length))
  for (let i = 0; i < longest; i++) {
    let l = 0
    let r = 0
    for (const layer of layers) {
      if (i < layer.left.length) {
        l += layer.left[i]
        r += layer.right[i]
      }
    }
    peak = Math.max(peak, Math.abs(l), Math.abs(r))
  }
  if (peak <= 0) return
  const scale = (PEAK[cue.kind] * level) / peak
  for (const layer of layers) {
    if (layer.post === 0) continue
    bus.stereo(layer.left, layer.right, start, {
      gain: scale * (layer.post ?? 1),
      send: layer.send,
    })
  }
}

/** How far the music dips under the picture's small sounds (about 2.5 dB), and for how long. */
const SMALL_DUCK = 0.25
const SMALL_HOLD = 0.12

/**
 * How far the music ducks (0…1) under the cues: briefly under impacts, along the body of
 * whooshes and sucks, a little under risers and thuds. Impacts on musical hits don't duck.
 * Small sounds (pops, chimes, dings, ticks, typing, sparkles) get a short dip of their own,
 * whatever their gain, so they read over the groove.
 */
export function duckCurve(
  cues: readonly Cue[],
  accents: readonly number[],
  length: number,
): Float32Array {
  const step = 32
  const points = Math.ceil(length / step) + 2
  const depth = new Float32Array(points)
  const write = (from: number, to: number, shape: (time: number) => number) => {
    const a = Math.max(0, Math.floor((from * SR) / step))
    const b = Math.min(points, Math.ceil((to * SR) / step))
    for (let p = a; p < b; p++) {
      const d = shape((p * step) / SR)
      if (d > depth[p]) depth[p] = d
    }
  }

  for (const cue of cues) {
    if (!Number.isFinite(cue.at)) continue
    const level = clamp(finite(cue.gain, 1))
    if (level <= 0) continue
    const start = cue.at / 1000
    const length = cueLength(cue)
    switch (cue.kind) {
      case 'impact':
        if (isAccent(start, accents)) break
        write(start, start + 1.5, (t) => {
          const d = t - start
          return 0.42 * level * (d < 0.008 ? d / 0.008 : Math.exp(-Math.max(0, d - 0.06) / 0.32))
        })
        break
      case 'whoosh': {
        const peakAt = length < 0.3 ? 0.42 : 0.58
        write(
          start,
          start + length,
          (t) => 0.26 * level * whooshEnvelope((t - start) / length, peakAt),
        )
        break
      }
      case 'suck':
        write(start, start + length + 0.3, (t) => {
          const u = (t - start) / length
          return 0.3 * level * (u <= 1 ? u * u : Math.exp(-(t - start - length) / 0.06))
        })
        break
      case 'riser':
        write(start, start + length, (t) => 0.12 * level * clamp((t - start) / length) ** 2)
        break
      case 'thud':
        write(start, start + 0.45, (t) => 0.12 * level * Math.exp(-(t - start) / 0.1))
        break
      case 'pop':
      case 'chime':
      case 'ding':
      case 'tick':
      case 'type':
      case 'sparkle': {
        const hold =
          cue.kind === 'type'
            ? length
            : cue.kind === 'sparkle'
              ? Math.min(0.35, length / 2)
              : SMALL_HOLD
        write(start - 0.01, start + hold + 0.3, (t) => {
          const d = t - start - hold
          return SMALL_DUCK * (d <= 0 ? 1 : Math.exp(-d / 0.06))
        })
        break
      }
      default:
        break
    }
  }

  // Round every edge into an exponential ramp (≈ 8 ms) both ways, so the duck never steps,
  // then expand to one gain per sample.
  const decay = Math.exp(-step / (0.008 * SR))
  for (let p = 1; p < points; p++) depth[p] = Math.max(depth[p], depth[p - 1] * decay)
  for (let p = points - 2; p >= 0; p--) depth[p] = Math.max(depth[p], depth[p + 1] * decay)
  const curve = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const x = i / step
    const p = Math.floor(x)
    const f = x - p
    curve[i] = 1 - Math.min(0.55, depth[p] * (1 - f) + depth[p + 1] * f)
  }
  return curve
}

/** The score's key, as semitones above A: A minor until the turn lands on A major. */
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const TURN = 10.9

/**
 * The frequency of a note `semis` above A5, nudged up into the score's key at `time` (a
 * chromatic note is always a semitone below a scale tone, so rising runs keep rising).
 */
function inKey(time: number, semis: number): number {
  const note = Math.round(semis)
  const scale = time < TURN ? MINOR : MAJOR
  const snapped = scale.includes(((note % 12) + 12) % 12) ? note : note + 1
  return 880 * semitones(snapped)
}

/** A whoosh's swell: rising to `peakAt` (a fraction of its length), then falling away. */
function whooshEnvelope(u: number, peakAt: number): number {
  if (u <= 0 || u >= 1) return 0
  const rise = u < peakAt ? smooth(u / peakAt) : 1
  const fall = u < peakAt ? 1 : 1 - (u - peakAt) / (1 - peakAt)
  return rise ** 1.6 * fall ** 1.8
}

/** A mono signal, equal-power panned. */
function panned(signal: Float32Array, pan: number, send: number): Layer[] {
  const [gl, gr] = panGains(pan)
  const left = new Float32Array(signal.length)
  const right = new Float32Array(signal.length)
  for (let i = 0; i < signal.length; i++) {
    left[i] = signal[i] * gl
    right[i] = signal[i] * gr
  }
  return [{ left, right, send }]
}

/** Where a moving sound travels: across the centre, or from the far side onto its pan. */
function travel(pan: number, seed: number): [number, number] {
  if (Math.abs(pan) < 0.1) {
    const direction = seed & 1 ? 1 : -1
    return [pan - 0.35 * direction, pan + 0.35 * direction]
  }
  const side = Math.sign(pan)
  return [clamp(pan - side * 0.9, -1, 1), clamp(pan + side * 0.15, -1, 1)]
}

/** Air rushing past: band-passed noise sweeping up and back, travelling across the field. */
function whoosh({ pan, pitch, length, seed }: Spec): Layer[] {
  const n = Math.max(2, frames(length))
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const body = noise(seed)
  const airL = noise(seed + 1)
  const airR = noise(seed + 2)
  const low = noise(seed + 3)
  const band = new Svf(400, 1.2)
  const hiL = new Svf(2000, 0.7)
  const hiR = new Svf(2000, 0.7)
  const sub = new Svf(170, 0.8)
  const short = length < 0.3
  const peakAt = short ? 0.42 : 0.58
  const lo = 240 * pitch
  const hi = Math.min(15000, (short ? 5600 : 3800) * pitch)
  const weight = length >= 0.35 ? 2 : 0.6
  const [from, to] = travel(pan, seed)
  let env = 0
  let gl = 1
  let gr = 1
  for (let i = 0; i < n; i++) {
    if ((i & 7) === 0) {
      const u = i / n
      env = whooshEnvelope(u, peakAt)
      const sweep = u < peakAt ? u / peakAt : 1 - (0.5 * (u - peakAt)) / (1 - peakAt)
      const fc = lo * (hi / lo) ** sweep
      band.tune(fc, 1.2)
      hiL.tune(Math.min(16000, fc * 2.4), 0.8)
      hiR.tune(Math.min(16000, fc * 2.6), 0.8)
      const angle = ((from + (to - from) * smooth(u) + 1) * Math.PI) / 4
      gl = Math.cos(angle) * Math.SQRT2
      gr = Math.sin(angle) * Math.SQRT2
    }
    band.run(body())
    hiL.run(airL())
    hiR.run(airR())
    sub.run(low())
    // The air is a band too, riding the sweep above the body: shimmer, not broadband hiss.
    const mono = band.peak + sub.low * weight
    left[i] = (mono * gl + hiL.peak * 0.2) * env
    right[i] = (mono * gr + hiR.peak * 0.2) * env
  }
  fadeTail(left)
  fadeTail(right)
  return [{ left, right, send: 0.22 }]
}

/** A whoosh sucked backwards: swelling, rising, narrowing to a point, cut at the end. */
function suck({ pan, pitch, length, seed }: Spec): Layer[] {
  const n = Math.max(2, frames(length))
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const mid = noise(seed)
  const side = noise(seed + 1)
  const bandM = new Svf(300, 1.1)
  const bandS = new Svf(300, 1.1)
  const inhale = new Osc(0)
  const lo = 300 * pitch
  const hi = Math.min(15000, 7200 * pitch)
  const grow = Math.exp(4.2) - 1
  const [gl, gr] = [Math.min(1, 1 - pan), Math.min(1, 1 + pan)]
  let env = 0
  let tone = 60 * pitch
  let u = 0
  for (let i = 0; i < n; i++) {
    if ((i & 7) === 0) {
      u = i / n
      env = (Math.exp(4.2 * u) - 1) / grow
      const fc = lo * (hi / lo) ** (u ** 1.5)
      bandM.tune(fc, 1.1)
      bandS.tune(fc * 1.12, 1.1)
      tone = 60 * pitch * 2 ** (3 * u ** 1.5)
    }
    bandM.run(mid())
    bandS.run(side())
    const m = bandM.peak + inhale.sine(tone) * 0.35
    const s = bandS.peak * (1 - u)
    left[i] = (m + s) * env * gl
    right[i] = (m - s) * env * gr
  }
  fadeTail(left)
  fadeTail(right)
  return [{ left, right, send: 0.1 }]
}

/** A crisp UI click: a tight noise snap, a tick of tone, a little body; then the release. */
function click({ pan, pitch, seed }: Spec): Layer[] {
  const out = new Float32Array(frames(0.08))
  const rnd = noise(seed)
  const band = new Svf(Math.min(14000, 4600 * pitch), 1.3)
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const r = t - 0.042
    band.run(rnd() * (Math.exp(-t / 0.0007) + (r >= 0 ? Math.exp(-r / 0.0006) * 0.4 : 0)))
    let v =
      band.peak * 1.4 +
      Math.sin(TAU * 2700 * pitch * t) * Math.exp(-t / 0.0035) * 0.35 +
      Math.sin(TAU * 190 * pitch * t) * Math.min(1, t / 0.0005) * Math.exp(-t / 0.008) * 0.3
    if (r >= 0) v += Math.sin(TAU * 3200 * pitch * r) * Math.exp(-r / 0.003) * 0.14
    out[i] = v
  }
  fadeTail(out, 0.004)
  return panned(out, pan, 0.04)
}

/** A soft bubble: a sine chirping up onto its note (A5, moved by `pitch`, kept in key). */
function pop({ time, pan, semis, seed }: Spec): Layer[] {
  const out = new Float32Array(frames(0.16))
  const target = clamp(inKey(time, semis), 120, 7000)
  const rnd = noise(seed)
  const pff = new Svf(1900, 1)
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    phase += (target * (1 - 0.5 * Math.exp(-t / 0.011))) / SR
    const attack = t < 0.0015 ? Math.sin((Math.PI / 2) * (t / 0.0015)) ** 2 : 1
    const env = attack * Math.exp(-t / 0.042)
    pff.run(rnd())
    out[i] =
      (Math.sin(TAU * phase) + 0.28 * Math.sin(TAU * 2 * phase) * Math.exp(-t / 0.016)) * env +
      pff.peak * Math.exp(-t / 0.0018) * 0.18
  }
  fadeTail(out, 0.005)
  return panned(out, pan, 0.12)
}

/** Two bright bell notes, E6 then A6 (moved by `pitch`, kept in key), a little apart in space. */
function chime({ time, pan, semis }: Spec): Layer[] {
  const notes = [
    { freq: inKey(time, 7 + semis), at: 0, gain: 1, pan: pan - 0.15, decay: 0.5 },
    { freq: inKey(time, 12 + semis), at: 0.085, gain: 1.1, pan: pan + 0.15, decay: 0.62 },
  ]
  const n = frames(0.085 + 0.62 * 5 + 0.05)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (const note of notes) {
    const tone = bell(note.freq, { decay: note.decay, index: 1.5, ratio: 2, partial: 0.12 })
    const [gl, gr] = panGains(note.pan)
    const offset = frames(note.at)
    for (let i = 0; i < tone.length && offset + i < n; i++) {
      left[offset + i] += tone[i] * gl * note.gain
      right[offset + i] += tone[i] * gr * note.gain
    }
  }
  return [{ left, right, send: 0.35 }]
}

/**
 * A cinematic hit: a sub dropping onto the key's tonic and a knock, a body a small speaker can
 * play, a bright crack, a wide darkening tail, a ring of metal. On a musical hit the score's
 * boom and punch are the low end, so the impact leaves its sub and knock out and lays the rest
 * over them, lower (the score carries the hit; two sets of transients would only feed the
 * limiter).
 */
function impact({ time, pan, semis, pitch, seed, aligned }: Spec): Layer[] {
  const n = frames(2.4)
  const low = new Float32Array(frames(1.5))
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const crackNoise = noise(seed)
  const tailL = noise(seed + 1)
  const tailR = noise(seed + 2)
  const crack = new Svf(Math.min(12000, 2100 * pitch), 0.8)
  const snap = new Svf(Math.min(14000, 3500 * pitch), 1.4)
  const fizz = new Svf(6500, 0.7)
  const lpL = new Svf(5000, 0.7)
  const lpR = new Svf(5000, 0.7)
  const [gl, gr] = panGains(pan)
  // The sub and the body land on A (A1, A2), moved only by whole octaves: always in key.
  const octave = 2 ** Math.round(semis / 12)
  const subHz = 55 * octave
  const bodyHz = 110 * octave
  const ringRoot = inKey(time, semis - 12)
  const metal = [1, 2.76, 5.4].map((ratio) => Math.min(15000, ringRoot * ratio) / SR)
  const ringRates = [0.7, 0.4, 0.22].map(decayRate)
  const ring = [0.05, 0.05, 0.05]
  const rates = {
    subBend: decayRate(0.1),
    sub: decayRate(0.3),
    knockBend: decayRate(0.012),
    knock: decayRate(0.05),
    bodyBend: decayRate(0.025),
    body: decayRate(0.07),
    crack: decayRate(0.014),
    snap: decayRate(0.008),
    fizz: decayRate(0.006),
    darken: decayRate(0.3),
    tail: decayRate(0.45),
  }
  const env = {
    subBend: 1.7,
    sub: 1,
    knockBend: 2.5,
    knock: 0.5,
    bodyBend: 1,
    body: 0.5,
    crack: 1.6,
    snap: 0.8,
    fizz: 0.35,
    darken: 5500,
    tail: 0.5,
  }
  let ps = 0
  let pk = 0
  let pb = 0
  for (let i = 0; i < n; i++) {
    ps += (subHz * (1 + env.subBend)) / SR
    pk += (75 * pitch * (1 + env.knockBend)) / SR
    pb += (bodyHz * (1 + env.bodyBend)) / SR
    const attack = Math.min(1, i / 48)
    // The sub is driven hard into saturation by its envelope: rich in harmonics (which a laptop
    // can play) while it hits, a clean sine as it dies away.
    if (i < low.length)
      low[i] =
        0.8 * soft(3 * sine(ps) * env.sub) * Math.min(1, i / 96) + sine(pk) * attack * env.knock
    const body = sine(pb) * attack * env.body
    const c = crackNoise()
    crack.run(c)
    snap.run(c)
    fizz.run(c)
    const hit = crack.peak * env.crack + snap.peak * env.snap + fizz.high * env.fizz
    let rings = 0
    for (let k = 0; k < 3; k++) {
      rings += sine(metal[k] * i) * ring[k]
      ring[k] *= ringRates[k]
    }
    if ((i & 7) === 0) {
      lpL.tune(300 + env.darken, 0.7)
      lpR.tune(300 + env.darken, 0.7)
    }
    lpL.run(tailL())
    lpR.run(tailR())
    const tail = Math.min(1, i / 192) * env.tail
    const mono = body + hit + rings * attack
    left[i] = mono * gl + lpL.low * tail
    right[i] = mono * gr + lpR.low * tail
    env.subBend *= rates.subBend
    env.sub *= rates.sub
    env.knockBend *= rates.knockBend
    env.knock *= rates.knock
    env.bodyBend *= rates.bodyBend
    env.body *= rates.body
    env.crack *= rates.crack
    env.snap *= rates.snap
    env.fizz *= rates.fizz
    env.darken *= rates.darken
    env.tail *= rates.tail
  }
  fadeTail(low, 0.4)
  fadeTail(left, 0.03)
  fadeTail(right, 0.03)
  return [
    { left: low, right: low, send: 0, post: aligned ? 0 : 1 },
    { left, right, send: 0.35, post: aligned ? 0.6 : 1 },
  ]
}

/** Noise and a saw stack climbing to a hit at the end of the cue. */
function riserVoice({ pan, pitch, length, seed }: Spec): Layer[] {
  const [left, right] = riser(length, {
    seed,
    from: 380 * pitch,
    to: Math.min(15000, 10000 * pitch),
    base: 98 * pitch,
    octaves: 3,
    tone: 0.4,
    gate: 0.25,
  })
  const gl = Math.min(1, 1 - pan)
  const gr = Math.min(1, 1 + pan)
  for (let i = 0; i < left.length; i++) {
    left[i] *= gl
    right[i] *= gr
  }
  return [{ left, right, send: 0.25 }]
}

/** A dry tick. */
function tick({ pan, pitch, seed }: Spec): Layer[] {
  const out = new Float32Array(frames(0.045))
  const rnd = noise(seed)
  const band = new Svf(Math.min(14000, 3900 * pitch), 3.5)
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    band.run(rnd() * Math.exp(-t / 0.0009))
    out[i] =
      band.peak * 2 +
      Math.sin(TAU * 3000 * pitch * t) * Math.exp(-t / 0.003) * 0.35 +
      Math.sin(TAU * 1200 * pitch * t) * Math.min(1, t / 0.0003) * Math.exp(-t / 0.0025) * 0.2
  }
  fadeTail(out, 0.004)
  return panned(out, pan, 0.03)
}

/** A notification ding: one glassy C#6 (D6 in the minor) with an octave and a soft body under it. */
function ding({ time, pan, semis }: Spec): Layer[] {
  const f = Math.min(5000, inKey(time, 4 + semis)) / SR
  const out = new Float32Array(frames(2.2))
  const rates = [0.12, 0.75, 0.35, 0.12, 0.6].map(decayRate)
  const env = [0.9 / TAU, 1, 0.22, 0.1, 0.16]
  for (let i = 0; i < out.length; i++) {
    const p = f * i
    out[i] =
      Math.min(1, i / 58) *
      (sine(p + env[0] * sine(p)) * env[1] +
        sine(2 * p) * env[2] +
        sine(2.76 * p) * env[3] +
        sine(0.5 * p) * env[4])
    for (let k = 0; k < 5; k++) env[k] *= rates[k]
  }
  fadeTail(out, 0.02)
  return panned(out, pan, 0.35)
}

/** One key: a snap of band-passed noise, a low thock, the key coming back up. */
function tap(
  left: Float32Array,
  right: Float32Array,
  offset: number,
  o: { freq: number; thock: number; gain: number; decay: number; pan: number; seed: number },
) {
  const rnd = noise(o.seed)
  const band = new Svf(Math.min(14000, o.freq), 2.2)
  const up = new Svf(Math.min(14000, o.freq * 1.3), 2)
  const [gl, gr] = panGains(o.pan)
  const n = frames(0.045)
  for (let i = 0; i < n && offset + i < left.length; i++) {
    const t = i / SR
    const x = rnd()
    band.run(x * Math.exp(-t / 0.002))
    const r = t - 0.016
    up.run(r >= 0 ? x * Math.exp(-r / 0.0012) : 0)
    const v =
      (band.peak * 2.4 +
        Math.sin(TAU * o.thock * t) * Math.min(1, t / 0.0005) * Math.exp(-t / o.decay) * 0.2 +
        up.peak * 0.5) *
      o.gain
    left[offset + i] += v * gl
    right[offset + i] += v * gr
  }
}

/** A run of key taps over the cue's duration: uneven, with the odd space bar. */
function type({ pan, pitch, length, seed }: Spec): Layer[] {
  const rnd = random(seed)
  const n = frames(length + 0.08)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  let t = 0
  for (let count = 0; t < length; count++) {
    const r1 = rnd()
    const r2 = rnd()
    const r3 = rnd()
    const space = count > 2 && rnd() < 0.12
    // Bright keys (3.4–5.6 kHz), above the whooshes' and the groove's busiest band.
    tap(left, right, frames(t), {
      freq: (3400 + 2200 * r1) * pitch,
      thock: (space ? 170 : 260 + 120 * r2) * pitch,
      gain: (0.7 + 0.3 * r3) * (space ? 1.1 : 1),
      decay: space ? 0.016 : 0.01,
      pan: clamp(pan + (r2 - 0.5) * 0.25, -1, 1),
      seed: seed + count,
    })
    t += 0.052 + 0.055 * rnd() + (space ? 0.05 : 0)
  }
  return [{ left, right, send: 0.05 }]
}

/** A pentatonic A major over two octaves, for sparkles. */
const GLITTER = [81, 83, 85, 88, 90, 93, 95, 97, 100, 102]

/** Glittering high pings rising through the cue, echoing left and right, over a shimmer. */
function sparkle({ time, pan, semis, length, seed }: Spec): Layer[] {
  const rnd = random(seed)
  const n = frames(length * 0.75 + 1.2)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const place = (signal: Float32Array, at: number, gain: number, p: number) => {
    const [gl, gr] = panGains(p)
    const offset = Math.max(0, frames(at))
    for (let i = 0; i < signal.length && offset + i < n; i++) {
      left[offset + i] += signal[i] * gain * gl
      right[offset + i] += signal[i] * gain * gr
    }
  }
  const count = Math.round(clamp(9 + length * 9, 8, 26))
  for (let k = 0; k < count; k++) {
    const when = length * 0.72 * (k / count) ** 1.25 + (rnd() - 0.5) * 0.012
    const index = Math.min(GLITTER.length - 1, Math.floor(rnd() * 6) + Math.floor((k / count) * 4))
    const ping = bell(Math.min(12000, inKey(time + when, GLITTER[index] - 81 + semis)), {
      decay: 0.07 + 0.1 * rnd(),
      index: 0.9,
      ratio: 3,
      partial: 0,
    })
    const p = clamp(pan + (rnd() - 0.5) * 1.1, -1, 1)
    const g = 0.6 + 0.4 * rnd()
    place(ping, when, g, p)
    place(ping, when + 0.13, g * 0.35, -p)
    place(ping, when + 0.26, g * 0.15, p)
  }
  // The shimmer: high noise flickering under the pings.
  const air = noise(seed + 7)
  const hp = new Svf(8500, 0.7)
  let hold = 0
  let next = 0
  const span = length + 0.3
  for (let i = 0; i < n; i++) {
    if (i >= next) {
      hold = rnd()
      next = i + frames(0.006 + 0.008 * rnd())
    }
    hp.run(air())
    const u = i / SR / span
    const env = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85)
    const v = hp.high * hold * env * 0.3
    left[i] += v
    right[i] += v
  }
  fadeTail(left, 0.01)
  fadeTail(right, 0.01)
  return [{ left, right, send: 0.45 }]
}

/** A digital stutter: slices of a buzzy source, decimated, bit-crushed, repeated, thrown around. */
function glitch({ pan, pitch, length, seed }: Spec): Layer[] {
  const rnd = random(seed)
  const source = new Float32Array(frames(0.08))
  const sq = new Osc(0)
  const sw = new Osc(0.3)
  const nz = noise(seed + 3)
  for (let i = 0; i < source.length; i++) {
    const t = i / SR
    source[i] =
      (sq.square(155 * pitch) * 0.5 + sw.saw(523 * pitch) * 0.35 + nz() * 0.25) *
      (0.6 + 0.4 * Math.sin(TAU * 1700 * t))
  }
  const n = frames(length + 0.01)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const pick = <T>(options: readonly T[]) =>
    options[Math.min(options.length - 1, Math.floor(rnd() * options.length))]
  let t = 0
  while (t < length) {
    const slice = Math.min(pick([0.012, 0.018, 0.024, 0.036, 0.05]), length - t)
    if (rnd() >= 0.22) {
      const decimate = pick([1, 2, 4, 8, 16])
      const levels = 2 ** (pick([3, 4, 5, 8]) - 1)
      const speed = pick([0.5, 1, 1, 1.5, 2])
      const repeats = 1 + Math.floor(rnd() * 3)
      const offset = Math.floor(rnd() * source.length * 0.5)
      const [gl, gr] = panGains(clamp(pan + (rnd() - 0.5) * 1.2, -1, 1))
      const g = 0.6 + 0.4 * rnd()
      const start = frames(t)
      const part = Math.max(1, Math.floor(frames(slice) / repeats))
      const edge = Math.max(1, Math.min(24, part / 4))
      for (let i = 0; i < part * repeats && start + i < n; i++) {
        const j = i % part
        const raw =
          source[(offset + Math.floor(Math.floor(j / decimate) * decimate * speed)) % source.length]
        const fade = Math.min(1, j / edge, (part - 1 - j) / edge)
        const v = (Math.round(raw * levels) / levels) * g * fade
        left[start + i] += v * gl
        right[start + i] += v * gr
      }
    }
    t += slice
  }
  fadeTail(left, 0.003)
  fadeTail(right, 0.003)
  return [{ left, right, send: 0.04 }]
}

/**
 * A soft heavy landing: a low thump (saturated, so a laptop still hears its harmonics) with a
 * knock above it that a small speaker can play, a flump of air, the papery edge of a card.
 */
function thud({ pan, pitch, seed }: Spec): Layer[] {
  const out = new Float32Array(frames(0.5))
  const rnd = noise(seed)
  const flump = new Svf(900, 0.7)
  const card = new Svf(1500, 1.1)
  let phase = 0
  let knock = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    phase += (60 * pitch * (1 + 0.9 * Math.exp(-t / 0.03))) / SR
    knock += (150 * pitch * (1 + 0.75 * Math.exp(-t / 0.025))) / SR
    const x = rnd()
    flump.run(x)
    card.run(x)
    const attack = Math.min(1, t / 0.0025)
    const body =
      Math.sin(TAU * phase) * Math.exp(-t / 0.11) * 0.5 +
      Math.sin(TAU * knock) * Math.exp(-t / 0.05) * 0.75
    out[i] =
      soft(2.4 * body) * attack +
      flump.low * Math.min(1, t / 0.002) * Math.exp(-t / 0.03) * 2 +
      card.peak * Math.exp(-t / 0.006) * 0.5
  }
  fadeTail(out, 0.01)
  return panned(out, pan, 0.08)
}

const VOICES: Record<CueKind, (spec: Spec) => Layer[]> = {
  whoosh,
  suck,
  click,
  pop,
  chime,
  impact,
  riser: riserVoice,
  tick,
  ding,
  type,
  sparkle,
  glitch,
  thud,
}
