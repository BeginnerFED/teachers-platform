/**
 * One hex colour in, a whole theme out.
 *
 * The stylesheet ships a set of brand tokens hand-tuned for #ff4f01 — a fill, a darker
 * fill for buttons, a darker still for text, a tint for the active sidebar row. Once an
 * admin can choose the colour, those relationships have to be derived rather than typed,
 * and derived in a way that keeps the result legible: an orange that looks striking as a
 * logo is 3.30:1 under white text, which is unreadable on a cheap phone in daylight.
 *
 * So the arithmetic happens in OKLCH, where changing lightness leaves the hue alone, and
 * every pairing is checked against WCAG contrast rather than eyeballed.
 */

export type Oklch = { l: number; c: number; h: number }

const WHITE: Oklch = { l: 1, c: 0, h: 0 }
const NEAR_WHITE: Oklch = { l: 0.985, c: 0, h: 0 }
const NEAR_BLACK: Oklch = { l: 0.145, c: 0, h: 0 }

/** WCAG AA for normal text. Buttons carry labels, so they are held to it. */
const AA_NORMAL = 4.5

/**
 * Small text gets headroom rather than the bare minimum. A value sitting exactly on 4.5
 * fails the moment anything else moves — a lighter page background, a thinner weight —
 * and the hand-tuned token this replaces had the same margin.
 */
const AA_TEXT = 5

/**
 * How far a fill may be darkened in pursuit of readable white text, in lightness. Past
 * this a light brand — a yellow, a mint — stops looking like itself, and the honest
 * answer is dark text on the colour the admin actually chose rather than a muddy
 * imitation of it.
 */
const MAX_DARKENING = 0.14

/** And never past here regardless, or a dark brand turns into a black rectangle. */
const DARKEN_FLOOR = 0.35

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/**
 * Björn Ottosson's OKLab matrices, via linear sRGB.
 *
 * There is no conversion back to sRGB here because nothing needs one: the colours are
 * written into CSS as oklch() and read back only to measure contrast, which is defined on
 * linear values anyway.
 */
function linearRgbToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToLinearRgb([lightness, a, b]: [number, number, number]): [number, number, number] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function hexToOklch(hex: string): Oklch {
  const value = hex.replace('#', '')
  const rgb: [number, number, number] = [
    srgbToLinear(parseInt(value.slice(0, 2), 16) / 255),
    srgbToLinear(parseInt(value.slice(2, 4), 16) / 255),
    srgbToLinear(parseInt(value.slice(4, 6), 16) / 255),
  ]

  const [l, a, b] = linearRgbToOklab(rgb)
  const chroma = Math.hypot(a, b)
  const hue = chroma < 1e-6 ? 0 : (Math.atan2(b, a) * 180) / Math.PI

  return { l, c: chroma, h: hue < 0 ? hue + 360 : hue }
}

function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180

  return oklabToLinearRgb([l, c * Math.cos(radians), c * Math.sin(radians)])
}

/**
 * Out-of-gamut components are clipped rather than gamut-mapped. It only matters for
 * colours a browser could not display either, and the number is used to compare
 * contrast, not to paint anything.
 */
function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(color).map(clamp01)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)

  return (lighter + 0.05) / (darker + 0.05)
}

export function toCss({ l, c, h }: Oklch): string {
  const round = (value: number, places: number) => Number(value.toFixed(places))

  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(h, 2)})`
}

/**
 * Walks lightness one small step at a time until the pairing is readable, or until the
 * limit says stop. Stepping rather than solving because contrast is not linear in
 * lightness, and 0.005 is finer than an eye can tell apart anyway.
 */
function shiftUntilReadable(
  base: Oklch,
  against: Oklch,
  { target = AA_NORMAL, towards, limit }: { target?: number; towards: 'darker' | 'lighter'; limit: number },
): Oklch | null {
  const step = towards === 'darker' ? -0.005 : 0.005
  let candidate = base

  for (let i = 0; i < 400; i++) {
    if (contrastRatio(candidate, against) >= target) return candidate

    const next = candidate.l + step
    if (towards === 'darker' ? next < limit : next > limit) return null

    candidate = { ...candidate, l: next }
  }

  return null
}

/** The pieces the stylesheet needs for one surface, light or dark. */
type Surface = {
  brand: Oklch
  primary: Oklch
  primaryForeground: Oklch
  brandText: Oklch
}

function lightSurface(base: Oklch): Surface {
  // Preferring white on the fill is a design decision, not an accessibility one: a filled
  // brand button with white text is what this product looks like. It only gives way when
  // holding on to it would mean darkening the colour past recognition.
  const darkened = shiftUntilReadable(base, NEAR_WHITE, {
    towards: 'darker',
    limit: Math.max(DARKEN_FLOOR, base.l - MAX_DARKENING),
  })

  const usesWhite = darkened !== null || contrastRatio(base, NEAR_BLACK) < AA_NORMAL

  const primary =
    darkened ??
    (usesWhite
      ? // A mid-tone with no readable option either way: darken regardless, since the
        // budget is about keeping a colour recognisable and legibility outranks that.
        (shiftUntilReadable(base, NEAR_WHITE, { towards: 'darker', limit: 0 }) ?? base)
      : base)

  return {
    brand: base,
    primary,
    primaryForeground: usesWhite ? NEAR_WHITE : NEAR_BLACK,
    // Text on the page background, which is white, so it has to go darker than the fill.
    brandText: shiftUntilReadable(base, WHITE, {
      target: AA_TEXT,
      towards: 'darker',
      limit: 0,
    }) ?? { ...base, l: 0.45 },
  }
}

function darkSurface(base: Oklch): Surface {
  // On a dark background the fill goes up rather than down, and the label on it flips to
  // whichever end of the scale can be read.
  const primary = { ...base, l: Math.max(base.l, 0.7) }
  const onDarkBackground = { l: 0.145, c: 0, h: 0 }

  return {
    brand: base,
    primary,
    primaryForeground:
      contrastRatio(primary, NEAR_BLACK) >= contrastRatio(primary, NEAR_WHITE)
        ? NEAR_BLACK
        : NEAR_WHITE,
    brandText:
      shiftUntilReadable(base, onDarkBackground, { towards: 'lighter', limit: 1 }) ?? {
        ...base,
        l: 0.72,
      },
  }
}

function tokensFor(surface: Surface, base: Oklch, mode: 'light' | 'dark'): Record<string, string> {
  const tint =
    mode === 'light'
      ? { l: 0.935, c: Math.min(base.c, 0.045), h: base.h }
      : { l: 0.27, c: Math.min(base.c, 0.06), h: base.h }

  const tintForeground =
    mode === 'light'
      ? { l: 0.42, c: Math.min(base.c, 0.16), h: base.h }
      : { l: 0.85, c: Math.min(base.c, 0.12), h: base.h }

  return {
    '--brand': toCss(surface.brand),
    '--primary': toCss(surface.primary),
    '--primary-foreground': toCss(surface.primaryForeground),
    '--brand-text': toCss(surface.brandText),
    '--ring': toCss(surface.brand),
    '--sidebar-primary': toCss(surface.primary),
    '--sidebar-primary-foreground': toCss(surface.primaryForeground),
    '--sidebar-ring': toCss(surface.brand),
    '--sidebar-active': toCss(tint),
    '--sidebar-active-foreground': toCss(tintForeground),
  }
}

export const DEFAULT_BRAND_COLOR = '#ff4f01'

const HEX = /^#[0-9a-fA-F]{6}$/

export type BrandTheme = {
  light: Record<string, string>
  dark: Record<string, string>
  /** What the button label actually measures against its fill, for the settings preview. */
  contrast: number
}

export function brandTheme(hex: string): BrandTheme {
  // Re-checked here rather than trusted: this value is interpolated into a stylesheet,
  // and a shape that cannot contain anything but hex digits cannot carry anything else in.
  const base = hexToOklch(HEX.test(hex) ? hex : DEFAULT_BRAND_COLOR)
  const light = lightSurface(base)

  return {
    light: tokensFor(light, base, 'light'),
    dark: tokensFor(darkSurface(base), base, 'dark'),
    contrast: contrastRatio(light.primary, light.primaryForeground),
  }
}

/** The `<style>` body that overrides the stylesheet's defaults for the chosen colour. */
export function brandStyleSheet(hex: string): string {
  const theme = brandTheme(hex)
  const block = (tokens: Record<string, string>) =>
    Object.entries(tokens)
      .map(([name, value]) => `${name}:${value}`)
      .join(';')

  return `:root{${block(theme.light)}}.dark{${block(theme.dark)}}`
}
