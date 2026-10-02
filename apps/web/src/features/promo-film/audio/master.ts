import { SAMPLE_RATE, Svf, TAU, type Track, fadeTail, noise, random, smooth } from './dsp'

/**
 * The mix's space and its master chain.
 *
 * The reverb is a ConvolverNode in an OfflineAudioContext, fed an impulse response generated
 * here: a short pre-delay, a few early reflections, then a decorrelated noise tail whose
 * highs die first (a warm hall). It runs at half the sample rate — a hall's tail lives below
 * 11 kHz — which makes the convolution about three times cheaper. The master — high-pass and
 * trim, true-peak look-ahead limiter, edge fades — runs on the finished samples, so it adds no
 * latency and nothing in it depends on the browser.
 */

const SR = SAMPLE_RATE
const REVERB_RATE = SR / 2

/** A stereo hall at `rate`, unit energy per side: the return gain alone sets the wet level. */
function impulseResponse(
  rate: number,
  { seconds = 2.4, decay = 2.2, predelay = 0.012, seed = 1234 } = {},
): AudioBuffer {
  const n = Math.round(seconds * rate)
  const ir = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: rate })
  const pre = Math.round(predelay * rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = ir.getChannelData(channel)
    const rnd = noise(seed + channel * 7919)
    const lowCut = new Svf(160 * (SR / rate), 0.6)
    let lp = 0
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / rate
      const cutoff = Math.min(rate * 0.45, 1800 + 10000 * Math.exp(-t / 0.3))
      lp += (1 - Math.exp((-TAU * cutoff) / rate)) * (rnd() - lp)
      lowCut.run(lp)
      data[i] = lowCut.high * Math.exp((-6.9 * t) / decay) * smooth(t / 0.02)
    }
    const r = random(seed + 31 + channel)
    ;[0.0089, 0.0137, 0.0191, 0.0263, 0.0331, 0.0419, 0.0523, 0.0647].forEach((tap, k) => {
      const at = pre + Math.round(tap * (1 + (r() - 0.5) * 0.12) * rate)
      if (at < n) data[at] += (r() < 0.5 ? -1 : 1) * 1.5 * 0.82 ** k
    })
    let energy = 0
    for (let i = 0; i < n; i++) energy += data[i] * data[i]
    const k = 1 / Math.sqrt(energy)
    for (let i = 0; i < n; i++) data[i] *= k
    fadeTail(data, 0.08)
  }
  return ir
}

/** A windowed-sinc low-pass at 0.23 × 48 kHz (Blackman, unity gain): the 2× resampling filter. */
const KERNEL = (() => {
  const taps = 47
  const middle = (taps - 1) / 2
  const fc = 0.23
  const h = new Float64Array(taps)
  let sum = 0
  for (let i = 0; i < taps; i++) {
    const x = i - middle
    const sinc = x === 0 ? 2 * fc : Math.sin(TAU * fc * x) / (Math.PI * x)
    const window =
      0.42 - 0.5 * Math.cos((TAU * i) / (taps - 1)) + 0.08 * Math.cos((2 * TAU * i) / (taps - 1))
    h[i] = sinc * window
    sum += h[i]
  }
  for (let i = 0; i < taps; i++) h[i] /= sum
  return h
})()

/** Filters and keeps every other sample: 48 kHz → 24 kHz, zero phase. */
function decimate(input: Float32Array, output: Float32Array) {
  const middle = (KERNEL.length - 1) / 2
  for (let m = 0; m < output.length; m++) {
    const centre = 2 * m
    let acc = 0
    for (let k = 0; k < KERNEL.length; k++) {
      const j = centre + k - middle
      if (j >= 0 && j < input.length) acc += KERNEL[k] * input[j]
    }
    output[m] = acc
  }
}

/** Doubles the rate (zero-stuffing + the same filter) and adds `gain` × the result to `output`. */
function interpolateInto(input: Float32Array, output: Float32Array, gain: number) {
  const middle = (KERNEL.length - 1) / 2
  const g = 2 * gain
  for (let n = 0; n < output.length; n++) {
    let acc = 0
    for (let k = (n + middle) & 1; k < KERNEL.length; k += 2) {
      const j = (n + k - middle) / 2
      if (j >= 0 && j < input.length) acc += KERNEL[k] * input[j]
    }
    output[n] += acc * g
  }
}

/** Seconds of send per convolution context; the contexts render side by side. */
const CHUNK = 12

/**
 * Runs the reverb send through the convolution hall and mixes the return into `dry`.
 * Convolution is linear, so the send is cut into chunks, each convolved in its own
 * OfflineAudioContext (rendered in parallel) with its full tail, and the tails overlap-add
 * back into exactly the one long convolution.
 *
 * At each of `cuts` (film seconds) the hall stops dead: the tails of everything sent before it
 * fade out over 10 ms, so a silence in the music is a real silence. (The chunks are split at
 * the cuts, which makes this exact too.)
 */
export async function addReverb(
  dry: Track,
  send: Track,
  gain: number,
  cuts: readonly number[] = [],
) {
  const half = Math.ceil(send.length / 2)
  const sendL = new Float32Array(half)
  const sendR = new Float32Array(half)
  decimate(send.left, sendL)
  decimate(send.right, sendR)

  const ir = impulseResponse(REVERB_RATE)
  const fade = Math.round(0.01 * REVERB_RATE)
  const stops = cuts
    .filter(Number.isFinite)
    .map((time) => Math.round(time * REVERB_RATE))
    .filter((at) => at > 0 && at < half)
    .sort((a, b) => a - b)
  const edges = new Set([0, half, ...stops])
  for (let at = CHUNK * REVERB_RATE; at < half; at += CHUNK * REVERB_RATE) edges.add(at)
  const bounds = [...edges].sort((a, b) => a - b)

  const jobs: Promise<{ from: number; stop: number; wet: AudioBuffer }>[] = []
  for (let k = 0; k + 1 < bounds.length; k++) {
    const from = bounds[k]
    const to = bounds[k + 1]
    const stop = stops.find((at) => at >= to) ?? Infinity
    const length = Math.min(half - from, to - from + ir.length, stop + fade - from)
    const context = new OfflineAudioContext(2, length, REVERB_RATE)
    const input = context.createBuffer(2, length, REVERB_RATE)
    input.getChannelData(0).set(sendL.subarray(from, to))
    input.getChannelData(1).set(sendR.subarray(from, to))
    const source = context.createBufferSource()
    source.buffer = input
    const convolver = context.createConvolver()
    convolver.normalize = false
    convolver.buffer = ir
    source.connect(convolver).connect(context.destination)
    source.start(0)
    jobs.push(context.startRendering().then((wet) => ({ from, stop, wet })))
  }

  const wetL = new Float32Array(half)
  const wetR = new Float32Array(half)
  for (const { from, stop, wet } of await Promise.all(jobs)) {
    const l = wet.getChannelData(0)
    const r = wet.getChannelData(1)
    for (let i = 0; i < l.length && from + i < half; i++) {
      const at = from + i
      const g =
        at < stop ? 1 : at < stop + fade ? 0.5 + 0.5 * Math.cos((Math.PI * (at - stop)) / fade) : 0
      wetL[at] += l[i] * g
      wetR[at] += r[i] * g
    }
  }
  interpolateInto(wetL, dry.left, gain)
  interpolateInto(wetR, dry.right, gain)
}

/** A 2nd-order high-pass: no DC, no sub-sonic rumble eating the headroom. */
function highpass(data: Float32Array, cutoff: number) {
  const filter = new Svf(cutoff, Math.SQRT1_2)
  for (let i = 0; i < data.length; i++) {
    filter.run(data[i])
    data[i] = filter.high
  }
}

/**
 * The 4× oversampling filter for true peaks: for each point a quarter, a half and three
 * quarters of the way to the next sample, 16 taps of a Blackman-windowed sinc (unity gain).
 */
const BETWEEN = [0.25, 0.5, 0.75].map((offset) => {
  const taps = new Float64Array(16)
  let sum = 0
  for (let k = 0; k < 16; k++) {
    const x = k - 7 - offset
    const sinc = Math.sin(Math.PI * x) / (Math.PI * x)
    const window = 0.42 + 0.5 * Math.cos((Math.PI * x) / 8) + 0.08 * Math.cos((TAU * x) / 8)
    taps[k] = sinc * window
    sum += taps[k]
  }
  for (let k = 0; k < 16; k++) taps[k] /= sum
  return taps
})

/** The highest level the waveform reaches between sample `i` and the next one. */
function between(data: Float32Array, i: number): number {
  let peak = 0
  for (const taps of BETWEEN) {
    let acc = 0
    for (let k = 0; k < 16; k++) {
      const j = i - 7 + k
      if (j >= 0 && j < data.length) acc += taps[k] * data[j]
    }
    peak = Math.max(peak, Math.abs(acc))
  }
  return peak
}

/**
 * A brick-wall look-ahead limiter on true peaks. The gain each sample needs (counting the
 * peaks between samples, which a decoder or a DAC reconstructs) is spread (a running minimum,
 * then a moving average, both `lookahead` wide each side) so it is already down when a peak
 * arrives, and it recovers over `release`. Nothing leaves above `ceiling`.
 */
function limit(
  left: Float32Array,
  right: Float32Array,
  ceiling: number,
  lookahead: number,
  release: number,
) {
  const n = left.length
  const w = Math.max(1, Math.round(lookahead * SR))
  const need = new Float32Array(n)
  // Only near the ceiling can a peak between samples be over it; elsewhere, skip the filter.
  const near = ceiling / 2
  for (let i = 0; i < n; i++) {
    let p = Math.max(Math.abs(left[i]), Math.abs(right[i]))
    if (i + 1 < n && Math.max(p, Math.abs(left[i + 1]), Math.abs(right[i + 1])) > near)
      p = Math.max(p, between(left, i), between(right, i))
    need[i] = p > ceiling ? ceiling / p : 1
  }
  const floor = new Float32Array(n)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let j = 0; j < n + w; j++) {
    if (j < n) {
      while (tail > head && need[queue[tail - 1]] >= need[j]) tail--
      queue[tail++] = j
    }
    const i = j - w
    if (i < 0) continue
    while (queue[head] < i - w) head++
    floor[i] = need[queue[head]]
  }
  const sum = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) sum[i + 1] = sum[i] + floor[i]
  const recover = 1 - Math.exp(-1 / (release * SR))
  let gain = 1
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w)
    const b = Math.min(n - 1, i + w)
    const target = (sum[b + 1] - sum[a]) / (b - a + 1)
    gain = target < gain ? target : gain + (target - gain) * recover
    left[i] *= gain
    right[i] *= gain
  }
}

/**
 * The finished level: true peaks at −1.5 dBTP, so nothing clips, even after the AAC encode
 * (which can overshoot by up to about 1 dB).
 */
const CEILING = 10 ** (-1.5 / 20)

/**
 * The mix goes into the limiter 2 dB down, so only the hits' first milliseconds reach it (by
 * 3 dB at most). There is deliberately no bus compressor: the mix is levelled by design, and
 * any compressor squashes exactly the hits the film is built around.
 */
const TRIM = 10 ** (-2 / 20)

/**
 * Masters the mix in place: high-pass and trim, true-peak limiting, then a fade-in at the
 * very start and a fade to true silence in the last 70 ms, so the loop is clean. (The music
 * itself has faded by then; the picture's last sounds may run almost to the end.)
 */
export function master(left: Float32Array, right: Float32Array) {
  const n = left.length
  highpass(left, 24)
  highpass(right, 24)
  for (let i = 0; i < n; i++) {
    left[i] *= TRIM
    right[i] *= TRIM
  }
  limit(left, right, CEILING, 0.005, 0.12)

  const fadeIn = Math.min(n, Math.round(0.008 * SR))
  for (let i = 0; i < fadeIn; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeIn)
    left[i] *= g
    right[i] *= g
  }
  const silentFrom = Math.max(0, n - Math.round(0.01 * SR))
  const fadeFrom = Math.max(0, n - Math.round(0.07 * SR))
  for (let i = fadeFrom; i < n; i++) {
    const g =
      i >= silentFrom
        ? 0
        : 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / (silentFrom - fadeFrom))
    left[i] *= g
    right[i] *= g
  }
  for (let i = 0; i < n; i++) {
    left[i] = Math.max(-CEILING, Math.min(CEILING, left[i]))
    right[i] = Math.max(-CEILING, Math.min(CEILING, right[i]))
  }
}
