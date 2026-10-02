/**
 * The soundtrack's signal kit: sample arithmetic on Float32Arrays.
 *
 * Voices are computed here rather than built from audio-graph nodes because it is exact
 * (every hit lands on its sample), cheap (the whole score renders in about a second) and
 * identical on every render — noise comes from seeded generators, never Math.random. The
 * audio graph is kept for what it does best: the convolution reverb.
 */

export const SAMPLE_RATE = 48000
export const TAU = Math.PI * 2

const SR = SAMPLE_RATE

/** Frequency of a MIDI note (A4 = 69 = 440 Hz). */
export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)

/** A frequency ratio from semitones. */
export const semitones = (amount: number) => 2 ** (amount / 12)

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/** Smoothstep over 0…1, clamped. */
export function smooth(x: number): number {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}

/** Seconds to samples (may be negative: an offset before the film starts). */
export const frames = (seconds: number) => Math.round(seconds * SR)

const SINE_SIZE = 4096
const SINE_TABLE = new Float64Array(SINE_SIZE + 1)
for (let i = 0; i <= SINE_SIZE; i++) SINE_TABLE[i] = Math.sin((TAU * i) / SINE_SIZE)

/** sin(2π·cycles) from an interpolated table: error below −120 dB, far cheaper than Math.sin. */
export function sine(cycles: number): number {
  const x = (cycles - Math.floor(cycles)) * SINE_SIZE
  const i = x | 0
  return SINE_TABLE[i] + (SINE_TABLE[i + 1] - SINE_TABLE[i]) * (x - i)
}

/** The per-sample multiplier of an exponential decay with time constant `seconds`. */
export const decayRate = (seconds: number) => Math.exp(-1 / (seconds * SR))

/** Warm soft saturation: a rational tanh, exact near 0, reaching ±1 at ±3. */
export function soft(x: number): number {
  if (x <= -3) return -1
  if (x >= 3) return 1
  const x2 = x * x
  return (x * (27 + x2)) / (27 + 9 * x2)
}

/** A seeded white-noise stream in −1…1 (xorshift32). */
export function noise(seed: number): () => number {
  let state = Math.imul((seed ^ 0x5bd1e995) >>> 0, 0x9e3779b1) >>> 0 || 0x6d2b79f5
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 2147483648 - 1
  }
  for (let i = 0; i < 6; i++) next()
  return next
}

/** A seeded uniform stream in 0…1. */
export function random(seed: number): () => number {
  const next = noise(seed)
  return () => (next() + 1) / 2
}

/** A stable 32-bit seed from a few numbers. */
export function hash(...values: number[]): number {
  let h = 0x811c9dc5
  for (const value of values) {
    h = Math.imul(h ^ (Math.round(value * 1000) | 0), 0x01000193)
    h ^= h >>> 15
  }
  return h >>> 0
}

/** Equal-power pan gains, unity on each side at the centre. */
export function panGains(pan: number): [number, number] {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4
  return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2]
}

/**
 * Topology-preserving state-variable filter (Simper / Zavalishin): stays stable while its
 * cutoff sweeps every few samples. After `run`, read `low`, `band`, `high`, or `peak` (a
 * band-pass with unity gain at the centre).
 */
export class Svf {
  low = 0
  band = 0
  high = 0
  private ic1 = 0
  private ic2 = 0
  private a1 = 0
  private a2 = 0
  private a3 = 0
  private k = 1

  constructor(cutoff = 1000, q = Math.SQRT1_2) {
    this.tune(cutoff, q)
  }

  tune(cutoff: number, q = Math.SQRT1_2) {
    const g = Math.tan((Math.PI * clamp(cutoff, 10, SR * 0.45)) / SR)
    this.k = 1 / q
    this.a1 = 1 / (1 + g * (g + this.k))
    this.a2 = g * this.a1
    this.a3 = g * this.a2
  }

  run(input: number): number {
    const v3 = input - this.ic2
    const v1 = this.a1 * this.ic1 + this.a2 * v3
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    this.low = v2
    this.band = v1
    this.high = input - this.k * v1 - v2
    return v2
  }

  get peak() {
    return this.band * this.k
  }
}

/** The polyBLEP residual that rounds off a waveform's step, so saws and squares don't alias. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt
    return x + x - x * x - 1
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt
    return x * x + x + x + 1
  }
  return 0
}

/** A phase accumulator: band-limited saw and square, and a sine. One waveform per instance. */
export class Osc {
  constructor(public phase = 0) {}

  saw(freq: number): number {
    const dt = freq / SR
    let p = this.phase + dt
    if (p >= 1) p -= Math.floor(p)
    this.phase = p
    return 2 * p - 1 - blep(p, dt)
  }

  square(freq: number, width = 0.5): number {
    const dt = freq / SR
    let p = this.phase + dt
    if (p >= 1) p -= Math.floor(p)
    this.phase = p
    let q = p - width
    if (q < 0) q += 1
    return (p < width ? 1 : -1) + blep(p, dt) - blep(q, dt)
  }

  sine(freq: number): number {
    let p = this.phase + freq / SR
    if (p >= 1) p -= Math.floor(p)
    this.phase = p
    return sine(p)
  }
}

/** A stereo signal over the film's timeline. */
export class Track {
  constructor(
    readonly left: Float32Array,
    readonly right: Float32Array,
  ) {}

  get length() {
    return this.left.length
  }

  /** Multiplies every sample by a curve of the same length. */
  scale(curve: Float32Array) {
    const { left, right } = this
    for (let i = 0; i < left.length; i++) {
      left[i] *= curve[i]
      right[i] *= curve[i]
    }
  }
}

export type Placement = {
  gain?: number
  /** −1…1: equal-power for mono voices, balance for stereo ones. */
  pan?: number
  /** How much of the voice also goes to the reverb, 0…1. */
  send?: number
  /** A per-sample gain over the whole film: the kick's pump, a section's drain. */
  curve?: Float32Array
}

/** A mix bus: the dry signal and the reverb send, written side by side. */
export class Bus {
  constructor(
    readonly dry: Track,
    readonly wet: Track,
  ) {}

  get length() {
    return this.dry.length
  }

  mono(signal: Float32Array, start: number, placement: Placement = {}) {
    const [left, right] = panGains(placement.pan ?? 0)
    this.write(signal, signal, start, left, right, placement)
  }

  stereo(left: Float32Array, right: Float32Array, start: number, placement: Placement = {}) {
    const pan = clamp(placement.pan ?? 0, -1, 1)
    this.write(left, right, start, Math.min(1, 1 - pan), Math.min(1, 1 + pan), placement)
  }

  private write(
    left: Float32Array,
    right: Float32Array,
    start: number,
    panLeft: number,
    panRight: number,
    { gain = 1, send = 0, curve }: Placement,
  ) {
    const offset = frames(start)
    const from = Math.max(0, -offset)
    const to = Math.min(left.length, right.length, this.length - offset)
    const targets: [Float32Array, Float32Array, number][] = [[this.dry.left, this.dry.right, 1]]
    if (send > 0) targets.push([this.wet.left, this.wet.right, send])
    for (const [outL, outR, level] of targets) {
      const gl = gain * panLeft * level
      const gr = gain * panRight * level
      if (curve) {
        for (let i = from; i < to; i++) {
          const at = offset + i
          outL[at] += left[i] * gl * curve[at]
          outR[at] += right[i] * gr * curve[at]
        }
      } else {
        for (let i = from; i < to; i++) {
          outL[offset + i] += left[i] * gl
          outR[offset + i] += right[i] * gr
        }
      }
    }
  }
}

/** Fades the last `seconds` of a signal to exactly zero (half cosine). */
export function fadeTail(signal: Float32Array, seconds = 0.005) {
  const n = Math.min(signal.length, Math.max(1, frames(seconds)))
  for (let i = 0; i < n; i++)
    signal[signal.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n)
}

/** Fades the first `seconds` of a signal in from exactly zero. */
export function fadeHead(signal: Float32Array, seconds = 0.002) {
  const n = Math.min(signal.length, Math.max(1, frames(seconds)))
  for (let i = 0; i < n; i++) signal[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n)
}

/** Scales signals together so that their loudest sample is `peak`. */
export function normalize(signals: Float32Array[], peak = 1) {
  let max = 0
  for (const signal of signals) {
    for (let i = 0; i < signal.length; i++) {
      const value = Math.abs(signal[i])
      if (value > max) max = value
    }
  }
  if (max <= 0) return
  const k = peak / max
  for (const signal of signals) for (let i = 0; i < signal.length; i++) signal[i] *= k
}

/** A gain curve over the film: 1 everywhere until something writes a dip into it. */
export function unity(length: number): Float32Array {
  return new Float32Array(length).fill(1)
}
