import {
  type Bus,
  Osc,
  SAMPLE_RATE,
  Svf,
  clamp,
  decayRate,
  fadeTail,
  frames,
  hz,
  noise,
  normalize,
  semitones,
  sine,
  soft,
} from './dsp'

/**
 * The score's instruments. One-shots (drums, booms, bells, notes) come back as buffers,
 * peak-normalised to 1 so the score's gains read as peak levels; sustained chords are
 * written straight onto a bus by `pad`. Envelopes decay by multiplication and sines come
 * from a table: the arithmetic is exact enough to hear no difference, and fast.
 */

const SR = SAMPLE_RATE

export type Stereo = [Float32Array, Float32Array]

/** A punchy kick: a sine swept down onto `tune` (A1), a click, soft saturation. */
export function kick({
  tune = 55,
  decay = 0.14,
  punch = 1,
  click = 0.3,
  seed = 11,
} = {}): Float32Array {
  const out = new Float32Array(frames(decay * 3.6 + 0.04))
  const rnd = noise(seed)
  const snap = new Svf(5200, 0.8)
  const sweepRate = decayRate(0.024)
  const blipRate = decayRate(0.002)
  const fallRate = decayRate(decay)
  const clickRate = decayRate(0.0028)
  const attack = frames(0.0008)
  const hold = frames(0.012)
  let sweep = 1
  let blip = 1
  let fall = 1
  let snapEnv = click
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    phase += (tune * (1 + 3.2 * punch * sweep) + 180 * blip) / SR
    sweep *= sweepRate
    blip *= blipRate
    const amp = (i < attack ? i / attack : 1) * fall
    if (i >= hold) fall *= fallRate
    snap.run(rnd())
    out[i] = soft(1.5 * sine(phase) * amp) + snap.band * snapEnv
    snapEnv *= clickRate
  }
  fadeTail(out, 0.01)
  normalize([out])
  return out
}

/** A clap: three quick bursts and a wide tail, band-passed, over a little body. */
export function clap({ seed = 21, tone = 1150, decay = 0.1 } = {}): Stereo {
  const n = frames(decay * 5 + 0.05)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const shared = noise(seed)
  const ownL = noise(seed + 1)
  const ownR = noise(seed + 2)
  const bandL = new Svf(tone, 1.3)
  const bandR = new Svf(tone * 1.07, 1.3)
  const airL = new Svf(3800, 0.7)
  const airR = new Svf(4200, 0.7)
  const topL = new Svf(12000, 0.7)
  const topR = new Svf(12000, 0.7)
  // Bursts at 0, 9.8 and 20.1 ms, then the tail from 31 ms.
  const starts = [0, frames(0.0098), frames(0.0201)]
  const gains = [1, 0.9, 0.95]
  const tailStart = frames(0.031)
  const burstRate = decayRate(0.0034)
  const tailRate = decayRate(decay)
  const bodyRate = decayRate(0.025)
  const ramp = frames(0.0005)
  const tailRamp = frames(0.002)
  const bursts = [0, 0, 0]
  let tail = 0.8
  let body = 0.16
  for (let i = 0; i < n; i++) {
    let env = 0
    for (let b = 0; b < 3; b++) {
      const d = i - starts[b]
      if (d < 0) continue
      if (d === 0) bursts[b] = gains[b]
      env = Math.max(env, bursts[b] * Math.min(1, d / ramp))
      bursts[b] *= burstRate
    }
    const d = i - tailStart
    if (d >= 0) {
      env = Math.max(env, tail * Math.min(1, d / tailRamp))
      tail *= tailRate
    }
    const width = clamp((i / SR - 0.015) / 0.05) * 0.8
    const s = shared()
    const l = s * (1 - width) + ownL() * width
    const r = s * (1 - width) + ownR() * width
    bandL.run(l)
    bandR.run(r)
    airL.run(l)
    airR.run(r)
    const thump = sine((185 * i) / SR) * Math.min(1, i / 48) * body
    body *= bodyRate
    topL.run(airL.high)
    topR.run(airR.high)
    left[i] = (bandL.peak * 1.5 + topL.low * 0.6) * env + thump
    right[i] = (bandR.peak * 1.5 + topR.low * 0.6) * env + thump
  }
  fadeTail(left, 0.01)
  fadeTail(right, 0.01)
  normalize([left, right])
  return [left, right]
}

/** A tight snare: two pitched sines and a crisp noise rattle. */
export function snare({ seed = 31, tone = 190, decay = 0.12, bright = 1 } = {}): Stereo {
  const n = frames(decay * 4.5 + 0.03)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const shared = noise(seed)
  const ownL = noise(seed + 1)
  const ownR = noise(seed + 2)
  const bandL = new Svf(2400 * bright, 0.75)
  const bandR = new Svf(2550 * bright, 0.75)
  const hiL = new Svf(6000, 0.7)
  const hiR = new Svf(6300, 0.7)
  const topL = new Svf(12000, 0.7)
  const topR = new Svf(12000, 0.7)
  const dropRate = decayRate(0.012)
  const bodyRate = decayRate(0.045)
  const rattleRate = decayRate(decay)
  const attack = frames(0.0006)
  let drop = 0.4
  let body = 0.55
  let rattle = 1
  let p1 = 0
  let p2 = 0
  for (let i = 0; i < n; i++) {
    const f = tone * (1 + drop)
    drop *= dropRate
    p1 += f / SR
    p2 += (f * 1.78) / SR
    const a = i < attack ? i / attack : 1
    const tonal = (sine(p1) + 0.55 * sine(p2)) * a * body
    body *= bodyRate
    const s = shared()
    const l = s * 0.7 + ownL() * 0.3
    const r = s * 0.7 + ownR() * 0.3
    bandL.run(l)
    bandR.run(r)
    hiL.run(l)
    hiR.run(r)
    const env = a * rattle
    rattle *= rattleRate
    topL.run(hiL.high)
    topR.run(hiR.high)
    left[i] = tonal + (bandL.peak * 1.1 + topL.low * 0.5) * env
    right[i] = tonal + (bandR.peak * 1.1 + topR.low * 0.5) * env
  }
  fadeTail(left, 0.008)
  fadeTail(right, 0.008)
  normalize([left, right])
  return [left, right]
}

/** The 808 recipe for metal: six square partials at inharmonic ratios. */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

/** A hi-hat (or, slowed, a shaker): metal partials and noise, high-passed. */
export function hat({
  seed = 41,
  decay = 0.028,
  tone = 1.7,
  attack = 0.0004,
  cutoff = 6500,
} = {}): Float32Array {
  const out = new Float32Array(frames(decay * 6 + 0.005))
  const rnd = noise(seed)
  const oscs = METAL.map((_, k) => new Osc((k * 0.37) % 1))
  const band = new Svf(8500, 1.1)
  const high = new Svf(cutoff, 0.7)
  const air = new Svf(cutoff + 800, 0.7)
  const top = new Svf(11000, 0.7)
  const rate = decayRate(decay)
  const ramp = Math.max(1, frames(attack))
  let env = 1
  for (let i = 0; i < out.length; i++) {
    let metal = 0
    for (let k = 0; k < METAL.length; k++) metal += oscs[k].square(METAL[k] * tone)
    band.run(metal / 6)
    high.run(band.peak)
    air.run(rnd())
    top.run(high.high * 0.9 + air.high * 0.6)
    out[i] = top.low * env * Math.min(1, i / ramp)
    env *= rate
  }
  fadeTail(out, 0.004)
  normalize([out])
  return out
}

/** A rim click: a knock of resonant noise and a short tone. */
export function rim({ seed = 45 } = {}): Float32Array {
  const out = new Float32Array(frames(0.07))
  const rnd = noise(seed)
  const res = new Svf(1750, 5)
  const exciteRate = decayRate(0.0012)
  const toneRate = decayRate(0.011)
  let excite = 1
  let tone = 0.5
  for (let i = 0; i < out.length; i++) {
    res.run(rnd() * excite)
    excite *= exciteRate
    out[i] = res.peak * 2.2 + sine((820 * i) / SR) * Math.min(1, i / 19) * tone
    tone *= toneRate
  }
  fadeTail(out, 0.004)
  normalize([out])
  return out
}

/** A tom: a sine falling onto its note, with a stick click. */
export function tom(note: number, { seed = 51, decay = 0.2 } = {}): Float32Array {
  const f0 = hz(note)
  const out = new Float32Array(frames(decay * 4.5 + 0.02))
  const rnd = noise(seed)
  const click = new Svf(1800, 0.9)
  const bendRate = decayRate(0.035)
  const fallRate = decayRate(decay)
  const clickRate = decayRate(0.006)
  const attack = frames(0.001)
  let bend = 0.55
  let fall = 1
  let clickEnv = 0.3
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    phase += (f0 * (1 + bend)) / SR
    bend *= bendRate
    click.run(rnd())
    out[i] = soft(1.4 * sine(phase) * fall * Math.min(1, i / attack)) + click.peak * clickEnv
    fall *= fallRate
    clickEnv *= clickRate
  }
  fadeTail(out, 0.008)
  normalize([out])
  return out
}

/** A crash cymbal: wide high noise over a bed of metal partials. */
export function crash({ seed = 61, decay = 1.1 } = {}): Stereo {
  const n = frames(decay * 4.2)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const nl = noise(seed)
  const nr = noise(seed + 1)
  const oscs = METAL.map((_, k) => new Osc((k * 0.29) % 1))
  const metalBand = new Svf(7400, 0.8)
  const hl = new Svf(5200, 0.6)
  const hr = new Svf(5400, 0.6)
  const topL = new Svf(15000, 0.7)
  const topR = new Svf(15000, 0.7)
  const fastRate = decayRate(0.05)
  const slowRate = decayRate(decay)
  const attack = frames(0.0015)
  let fast = 0.5
  let slow = 0.5
  for (let i = 0; i < n; i++) {
    let metal = 0
    for (let k = 0; k < METAL.length; k++) metal += oscs[k].square(METAL[k] * 3.1)
    metalBand.run(metal / 6)
    hl.run(nl())
    hr.run(nr())
    const env = Math.min(1, i / attack) * (fast + slow)
    fast *= fastRate
    slow *= slowRate
    topL.run(hl.high * 0.75 + metalBand.peak * 0.5)
    topR.run(hr.high * 0.75 + metalBand.peak * 0.5)
    left[i] = topL.low * env
    right[i] = topR.low * env
  }
  fadeTail(left, 0.02)
  fadeTail(right, 0.02)
  normalize([left, right])
  return [left, right]
}

/**
 * The first `seconds` of a sound, played backwards: an inhale that ends on its attack. A short
 * piece of a decay is already loud where it starts, so it also swells from silence over its
 * whole length (about 12 dB down halfway), rather than switching on as a hiss.
 */
export function reversed([left, right]: Stereo, seconds: number): Stereo {
  const n = Math.min(left.length, frames(seconds))
  const l = new Float32Array(n)
  const r = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const swell = (i / n) ** 2
    l[i] = left[n - 1 - i] * swell
    r[i] = right[n - 1 - i] * swell
  }
  return [l, r]
}

/** A bass note: saw and square through a plucky low-pass, a clean sine sub underneath. */
export function bass(
  note: number,
  length: number,
  { velocity = 1, bright = 1, seed = 71 } = {},
): Float32Array {
  const freq = hz(note)
  const out = new Float32Array(frames(length + 0.05))
  const rnd = noise(seed)
  const saw = new Osc((rnd() + 1) / 2)
  const square = new Osc((rnd() + 1) / 2)
  const sub = new Osc(0)
  const lp = new Svf(800, 1.1)
  const snapRate = decayRate(0.075)
  const accentRate = decayRate(0.06)
  const releaseRate = decayRate(0.012)
  const gateAt = frames(length)
  const attack = frames(0.0025)
  let snap = 2100 * bright * velocity
  let accent = 0.25 * velocity
  let gate = 1
  for (let i = 0; i < out.length; i++) {
    if ((i & 7) === 0) lp.tune(120 + freq * 1.6 + snap, 1.15)
    snap *= snapRate
    lp.run(saw.saw(freq) * 0.75 + square.square(freq) * 0.3)
    if (i >= gateAt) gate *= releaseRate
    const amp = Math.min(1, i / attack) * gate * (0.85 + accent)
    accent *= accentRate
    out[i] = (soft(lp.low * 1.6) * 0.62 + sub.sine(freq) * 0.5) * amp
  }
  fadeTail(out, 0.008)
  normalize([out])
  return out
}

/** A short pluck: two saws and a narrow pulse, a fast filter snap, a quick decay. */
export function pluck(
  note: number,
  { velocity = 1, decay = 0.16, bright = 1, seed = 81 } = {},
): Float32Array {
  const freq = hz(note)
  const out = new Float32Array(frames(decay * 3.4 + 0.02))
  const rnd = noise(seed)
  const a = new Osc((rnd() + 1) / 2)
  const b = new Osc((rnd() + 1) / 2)
  const c = new Osc((rnd() + 1) / 2)
  const detuned = freq * semitones(0.08)
  const lp = new Svf(3000, 1.4)
  const snapRate = decayRate(0.07)
  const fallRate = decayRate(decay)
  const attack = frames(0.0012)
  let snap = 7000 * bright * velocity
  let fall = 1
  for (let i = 0; i < out.length; i++) {
    if ((i & 3) === 0) lp.tune(250 + freq * 1.1 + snap, 1.4)
    snap *= snapRate
    // (+0.4 centres the 30% pulse, whose mean is −0.4: the low-pass would keep that as DC)
    lp.run(a.saw(freq) * 0.6 + b.saw(detuned) * 0.4 + (c.square(freq, 0.3) + 0.4) * 0.3)
    out[i] = lp.low * Math.min(1, i / attack) * fall
    fall *= fallRate
  }
  fadeTail(out, 0.008)
  normalize([out])
  return out
}

/** The hook's lead: a bright detuned saw stack with a bell tine on the attack. */
export function lead(note: number, length: number, { velocity = 1, seed = 91 } = {}): Stereo {
  const freq = hz(note)
  const n = frames(length + 0.32)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const rnd = noise(seed)
  const a = new Osc((rnd() + 1) / 2)
  const b = new Osc((rnd() + 1) / 2)
  const c = new Osc((rnd() + 1) / 2)
  const body = new Osc(0)
  const tine = new Osc(0)
  const fa = freq * semitones(-0.09)
  const fc = freq * semitones(0.09)
  const lpL = new Svf(3000, 0.9)
  const lpR = new Svf(3000, 0.9)
  const snapRate = decayRate(0.11)
  const levelRate = decayRate(0.16)
  const tineRate = decayRate(0.018)
  const releaseRate = decayRate(0.07)
  const gateAt = frames(length)
  const attack = frames(0.002)
  let snap = 5400 * velocity
  let level = 0.45
  let tineEnv = 0.18
  let release = 1
  for (let i = 0; i < n; i++) {
    if ((i & 7) === 0) {
      const cutoff = 700 + freq * 1.4 + snap
      lpL.tune(cutoff, 0.9)
      lpR.tune(cutoff, 0.9)
    }
    snap *= snapRate
    const sa = a.saw(fa)
    const sb = b.saw(freq)
    const sc = c.saw(fc)
    lpL.run(sa * 0.8 + sb * 0.55 + sc * 0.25)
    lpR.run(sa * 0.25 + sb * 0.55 + sc * 0.8)
    if (i >= gateAt) release *= releaseRate
    const amp = Math.min(1, i / attack) * (0.55 + level) * release
    level *= levelRate
    const extra = body.sine(freq) * 0.3 + tine.sine(freq * 4) * tineEnv
    tineEnv *= tineRate
    left[i] = (lpL.low + extra) * amp
    right[i] = (lpR.low + extra) * amp
  }
  fadeTail(left, 0.01)
  fadeTail(right, 0.01)
  normalize([left, right])
  return [left, right]
}

/** A sub boom: a sine dropping an octave onto its note, saturated so small speakers hear it. */
export function boom(note: number, { decay = 0.5, drop = 1 } = {}): Float32Array {
  const freq = hz(note)
  const out = new Float32Array(frames(decay * 4.6 + 0.04))
  const dropRate = decayRate(0.05)
  const fallRate = decayRate(decay)
  const attack = frames(0.002)
  let bend = drop
  let fall = 1
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    phase += (freq * (1 + bend)) / SR
    bend *= dropRate
    out[i] = soft(1.7 * sine(phase) * Math.min(1, i / attack) * fall)
    fall *= fallRate
  }
  fadeTail(out, 0.02)
  normalize([out])
  return out
}

/** An FM bell: a sine carrier, a modulator at `ratio`, the brightness falling away first. */
export function bell(
  freq: number,
  { decay = 0.9, index = 2, ratio = 3.5, attack = 0.0015, partial = 0.2 } = {},
): Float32Array {
  const out = new Float32Array(frames(Math.min(decay * 4.6, 4) + 0.02))
  const f = Math.min(freq, 14000)
  const step = f / SR
  const mod = (f * ratio) / SR
  const depthRate = decayRate(decay * 0.25)
  const fallRate = decayRate(decay)
  const partialRate = decayRate(decay * 0.4)
  const ramp = Math.max(1, frames(attack))
  const scale = 1 / (2 * Math.PI)
  let pc = 0
  let pm = 0
  let depth = index * scale
  let fall = 1
  let over = partial
  for (let i = 0; i < out.length; i++) {
    pc += step
    pm += mod
    const a = Math.min(1, i / ramp)
    out[i] = (sine(pc + depth * sine(pm)) * fall + over * sine(2 * pc)) * a
    depth *= depthRate
    fall *= fallRate
    over *= partialRate
  }
  fadeTail(out, 0.01)
  normalize([out])
  return out
}

/** One heartbeat: lub-dub, two muffled low thumps, saturated so they read on a laptop. */
export function heartbeat({ seed = 5 } = {}): Float32Array {
  const out = new Float32Array(frames(0.6))
  const rnd = noise(seed)
  const flesh = new Svf(180, 0.7)
  const dubAt = frames(0.165)
  const lubBendRate = decayRate(0.02)
  const dubBendRate = decayRate(0.018)
  const lubRate = decayRate(0.07)
  const dubRate = decayRate(0.055)
  const ramp = frames(0.004)
  let lub = 0
  let dub = 0
  let lubBend = 0.7
  let dubBend = 0.7
  let lubEnv = 1
  let dubEnv = 0.65
  let muffle = 0
  for (let i = 0; i < out.length; i++) {
    lub += (50 * (1 + lubBend)) / SR
    lubBend *= lubBendRate
    const le = lubEnv * Math.min(1, i / ramp)
    lubEnv *= lubRate
    let x = sine(lub) * le
    let envs = le
    const d = i - dubAt
    if (d >= 0) {
      dub += (58 * (1 + dubBend)) / SR
      dubBend *= dubBendRate
      const de = dubEnv * Math.min(1, d / ramp)
      dubEnv *= dubRate
      x += sine(dub) * de
      envs += de
    }
    flesh.run(rnd())
    x = soft(2.2 * (x + flesh.low * envs * 3))
    muffle += 0.06 * (x - muffle)
    out[i] = muffle
  }
  fadeTail(out, 0.02)
  normalize([out])
  return out
}

/** A wall clock's tick (or its lower tock): a ringing knock of resonant noise. */
export function clockTick(tock: boolean, { seed = 6 } = {}): Float32Array {
  const out = new Float32Array(frames(0.08))
  const rnd = noise(seed)
  const r1 = new Svf(tock ? 1750 : 2450, 10)
  const r2 = new Svf(tock ? 3300 : 4300, 8)
  const knock = (tock ? 900 : 1150) / SR
  const exciteRate = decayRate(0.0006)
  const knockRate = decayRate(0.005)
  let excite = 1
  let knockEnv = 0.25
  for (let i = 0; i < out.length; i++) {
    const ex = rnd() * excite
    excite *= exciteRate
    r1.run(ex)
    r2.run(ex)
    out[i] = r1.peak * 1.4 + r2.peak * 0.8 + sine(knock * i) * Math.min(1, i / 14) * knockEnv
    knockEnv *= knockRate
  }
  fadeTail(out, 0.005)
  normalize([out])
  return out
}

/**
 * A riser: band-passed noise and a detuned saw climbing together, a tremolo speeding up,
 * the stereo field opening; it ends on a 6 ms cut, the moment of the hit. Its curves are
 * read every 16 samples.
 */
export function riser(
  length: number,
  {
    seed = 7,
    from = 350,
    to = 9000,
    base = 110,
    octaves = 3,
    tone = 0.35,
    gate = 0.3,
    curve = 3.5,
  } = {},
): Stereo {
  const n = Math.max(2, frames(length))
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const mid = noise(seed)
  const side = noise(seed + 1)
  const bandM = new Svf(from, 1.3)
  const bandS = new Svf(from, 1.3)
  const toneLp = new Svf(from, 0.8)
  const saws = [new Osc(0.1), new Osc(0.45), new Osc(0.8)]
  const grow = Math.exp(curve) - 1
  let tremolo = 0
  let env = 0
  let pitch = base
  let rate = 3
  let u = 0
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) {
      u = i / n
      env = (Math.exp(curve * u) - 1) / grow
      const fc = from * (to / from) ** (u ** 1.4)
      bandM.tune(fc, 1.3)
      bandS.tune(fc * 1.1, 1.3)
      toneLp.tune(fc * 0.7, 0.8)
      pitch = base * 2 ** (octaves * u ** 1.5)
      rate = 3 + 22 * u * u
    }
    bandM.run(mid())
    bandS.run(side())
    toneLp.run((saws[0].saw(pitch * 0.995) + saws[1].saw(pitch) + saws[2].saw(pitch * 1.005)) / 3)
    tremolo += rate / SR
    const trem = 1 - gate * (0.5 + 0.5 * sine(tremolo))
    const m = bandM.peak + toneLp.low * tone
    const s = bandS.peak * u
    left[i] = (m + s) * env * trem
    right[i] = (m - s) * env * trem
  }
  fadeTail(left, 0.006)
  fadeTail(right, 0.006)
  normalize([left, right])
  return [left, right]
}

export type PadSpec = {
  notes: readonly number[]
  /** Film seconds. The chord sounds from `start`, releases at `end`. */
  start: number
  end: number
  /** RMS level per side is about 0.58 × gain. */
  gain: number
  /** Low-pass cutoff (Hz) over film time, read every 32 samples. */
  cutoff: (time: number) => number
  q?: number
  attack?: number
  release?: number
  /** An exponential decay after the attack (s): a struck chord rather than a held one. */
  decay?: number
  /** A swell instead: rising exponentially (this steepness) to `end`, then cut. */
  swell?: number
  /** Detuned saws per note, spread across the whole stereo field (the outer ones hard left/right). */
  voices?: number
  /** Cents between neighbouring voices. */
  detune?: number
  /** A pitch multiplier over film time (a tape-stop drain). */
  bend?: (time: number) => number
  send?: number
  /** A per-sample gain over the film: the kick's pump, a drain. */
  curve?: Float32Array
  seed: number
}

/** A chord of detuned saws through a stereo low-pass, written straight onto a bus. */
export function pad(bus: Bus, spec: PadSpec) {
  const voices = spec.voices ?? 3
  const detune = spec.detune ?? 9
  const q = spec.q ?? 0.8
  const attack = Math.max(0.001, spec.attack ?? 0.05)
  const release = Math.max(0.002, spec.release ?? 0.15)
  const send = spec.send ?? 0
  const startI = frames(spec.start)
  const endI = frames(spec.end)
  const releaseI = Math.max(1, frames(release))
  const first = Math.max(0, startI)
  const last = Math.min(bus.length, endI + releaseI)
  if (last <= first) return

  // The saws run inline on typed arrays: this loop is most of the score's arithmetic.
  const rnd = noise(spec.seed)
  const count = spec.notes.length * voices
  const phase = new Float64Array(count)
  const step = new Float64Array(count)
  const wl = new Float64Array(count)
  const wr = new Float64Array(count)
  let power = 0
  for (let n = 0; n < spec.notes.length; n++) {
    for (let v = 0; v < voices; v++) {
      const k = n * voices + v
      const spread = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1
      phase[k] = (rnd() + 1) / 2
      step[k] = (hz(spec.notes[n]) * semitones((spread * detune * (voices - 1)) / 200)) / SR
      const angle = ((spread + 1) * Math.PI) / 4
      wl[k] = Math.cos(angle)
      wr[k] = Math.sin(angle)
      power += wl[k] * wl[k]
    }
  }
  const scale = spec.gain / Math.sqrt(power)
  const lpL = new Svf()
  const lpR = new Svf()
  const span = Math.max(1, endI - startI)
  const swellGrow = spec.swell ? Math.exp(spec.swell) - 1 : 1
  const attackI = Math.max(1, frames(attack))
  const decayMul = spec.decay ? decayRate(spec.decay) : 1
  const { dry, wet } = bus
  let bend = 1
  let decayEnv = 1

  for (let i = first; i < last; i++) {
    if (((i - first) & 31) === 0) {
      const time = i / SR
      const cutoff = spec.cutoff(time)
      lpL.tune(cutoff, q)
      lpR.tune(cutoff, q)
      if (spec.bend) bend = spec.bend(time)
    }
    let l = 0
    let r = 0
    for (let k = 0; k < count; k++) {
      const dt = step[k] * bend
      let p = phase[k] + dt
      if (p >= 1) p -= 1
      phase[k] = p
      let s = 2 * p - 1
      if (p < dt) {
        const x = p / dt
        s -= x + x - x * x - 1
      } else if (p > 1 - dt) {
        const x = (p - 1) / dt
        s -= x * x + x + x + 1
      }
      l += s * wl[k]
      r += s * wr[k]
    }
    lpL.run(l)
    lpR.run(r)

    const local = i - startI
    let env: number
    if (spec.swell) {
      env = (Math.exp((spec.swell * local) / span) - 1) / swellGrow
    } else if (local < attackI) {
      const x = sine(local / attackI / 4)
      env = x * x
    } else {
      env = decayEnv
      decayEnv *= decayMul
    }
    if (i >= endI) env *= 0.5 + 0.5 * Math.cos((Math.PI * (i - endI)) / releaseI)
    if (spec.curve) env *= spec.curve[i]
    const g = env * scale
    const outL = lpL.low * g
    const outR = lpR.low * g
    dry.left[i] += outL
    dry.right[i] += outR
    if (send > 0) {
      wet.left[i] += outL * send
      wet.right[i] += outR * send
    }
  }
}

/** A pure low sine held under a section (with a touch of saturation for its harmonics). */
export function drone(
  bus: Bus,
  {
    note,
    start,
    end,
    gain,
    attack = 0.5,
    release = 0.3,
    curve,
  }: {
    note: number
    start: number
    end: number
    gain: number
    attack?: number
    release?: number
    curve?: Float32Array
  },
) {
  const freq = hz(note)
  const startI = frames(start)
  const endI = frames(end)
  const releaseI = Math.max(1, frames(release))
  const attackI = Math.max(1, frames(attack))
  const first = Math.max(0, startI)
  const last = Math.min(bus.length, endI + releaseI)
  const osc = new Osc(0)
  for (let i = first; i < last; i++) {
    const local = i - startI
    let env = 1
    if (local < attackI) {
      const x = sine(local / attackI / 4)
      env = x * x
    }
    if (i >= endI) env *= 0.5 + 0.5 * Math.cos((Math.PI * (i - endI)) / releaseI)
    if (curve) env *= curve[i]
    const v = soft(1.4 * osc.sine(freq)) * 0.8 * env * gain
    bus.dry.left[i] += v
    bus.dry.right[i] += v
  }
}
