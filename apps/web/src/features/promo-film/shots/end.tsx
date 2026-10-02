'use client'

import type { Cue } from '../audio/cues'
import type { FilmCopy } from '../copy'
import { Glow } from '../fx/backdrop'
import { LogoMark } from '../fx/brand'
import { Burst, Dust, Ring } from '../fx/effects'
import { Camera } from '../fx/space'
import { BRAND, clamp, ease, INK, mix, progress, useShot, WIDTH } from '../time'
import { CENTRE, Ember, EMBER_REST, Gloss, MarkShape, Rays } from './open-fx'

/**
 * End (45–48 s). The climax collapses to a point and flashes; the end card is born white-hot
 * in that light and cools to the brand's orange as the burn falls away — the mark, the name
 * letter by letter, the tagline in two lines, rays turning slowly behind, a light passing
 * over the mark. Then it all folds back: the words go, the mark shrinks and rounds into the
 * ember at the centre of the dark — exactly the frame the film opens on, so the loop has no
 * seam.
 */

const MARK = 184
const MARK_Y = 505
const NAME_SIZE = 96
const NAME_Y = 697
const TAG_SIZE = 40
const TAG_Y = [821, 873] as const
/** The lockup starts folding back into the ember. */
const FOLD = 2400
const FOLD_DURATION = 500
/** The mark becomes the ember: from here the frames are the open's first frame. */
const HANDOFF = FOLD + 460

/**
 * The climax's flash: its one white frame is at its 2800 ms (−200 here), from the point it
 * steered to where the mark is born. From the next frame the end owns the whole picture: its
 * own ink under the card and its own burn over it, so the light cools warm and never greys.
 */
const FLASH = -200
const TAKEOVER = -185
const BIRTH = { x: 540, y: 551 } as const
/** The climax camera's pose at the flash, so its ring and sparks carry on exactly. */
const CLIMAX_LENS = { zoom: 1.264, roll: -10.6 } as const

export const cues: readonly Cue[] = [
  { at: 0, kind: 'whoosh', gain: 0.25, duration: 500 },
  { at: 120, kind: 'chime', gain: 0.4 },
  { at: 400, kind: 'pop', gain: 0.2, pitch: 3 },
  { at: 580, kind: 'pop', gain: 0.2, pitch: 5 },
  { at: 1000, kind: 'sparkle', gain: 0.4, pan: 0.1 },
  { at: FOLD - 20, kind: 'suck', gain: 0.5, duration: 500 },
  { at: HANDOFF + 20, kind: 'tick', gain: 0.3 },
]

/** The tagline in two lines, broken after its comma (or in the middle when it has none). */
function splitTagline(text: string): [string, string] {
  const comma = text.indexOf(', ')
  if (comma > 0) return [text.slice(0, comma + 1), text.slice(comma + 2)]
  const words = text.split(' ')
  const half = Math.ceil(words.length / 2)
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')]
}

/**
 * The flash cooling like hot metal: white-hot everywhere, then the heat drawing in toward the
 * mark — the frame's edges going peach, orange, deep red and dark while the core stays white
 * longest. Screened over the card, so the card is inside the light, never under a grey veil.
 */
function Burn({ x, y }: { x: number; y: number }) {
  const { local } = useShot()
  const s = local - FLASH
  if (local < TAKEOVER || s > 420) return null
  const cool = ease.outCubic(clamp(s / 330))
  const fade = 1 - ease.inCubic(clamp((s - 100) / 300))
  if (fade <= 0.003) return null

  const white = 1300 * (1 - clamp(cool * 2))
  const peach = white + mix(420, 60, cool)
  const orange = peach + mix(520, 140, cool)
  const deep = orange + mix(700, 260, cool)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: fade,
        mixBlendMode: 'screen',
        background: `radial-gradient(circle at ${x}px ${y}px, #ffffff 0px, #fff6ef ${white}px, #ffc9a4 ${peach}px, rgb(255 118 38) ${orange}px, rgb(214 52 0 / 0.55) ${deep}px, rgb(214 52 0 / 0) ${deep + 240}px)`,
      }}
    />
  )
}

/** A ring drawn into the folding mark, closing on it wherever it is. */
function Implode({ y }: { y: number }) {
  const { local } = useShot()
  const p = progress(local, FOLD + 300, 220, ease.inCubic)
  if (local < FOLD + 300 || p >= 1) return null
  const r = mix(230, 7, p)
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: CENTRE.x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: '2px solid #ffb58a',
        opacity: Math.min(1, p * 6) * (1 - p * p) * 0.9,
      }}
    />
  )
}

export function Shot({ copy }: { copy: FilmCopy }) {
  const { local } = useShot()
  if (local < -300 || local > 3000) return null

  // Entrance: born in the flash, rising and settling back from close as the burn cools.
  const owned = local >= TAKEOVER
  const arrive = progress(local, -170, 950, ease.outExpo)
  const focus = progress(local, -170, 520, ease.outCubic)
  const shown = progress(local, TAKEOVER, 50)
  const flare = 1 - progress(local, -100, 1000, ease.outCubic)
  const heat = 1 - progress(local, -170, 220, ease.inOutCubic)
  // The world's light comes back up under the card once the climax has gone.
  const ink = owned ? 1 - progress(local, 300, 500, ease.inOutCubic) : 0

  // Hold: a slow push and a drift, all of it easing back to rest for the fold.
  const push = progress(local, 0, FOLD, ease.inOutCubic)
  const release = progress(local, FOLD, 440, ease.inOutCubic)
  const zoom = 1 + 0.04 * push * (1 - release)

  // Fold: the words go, the mark shrinks into the ember, the dark closes over the world.
  const wordsOut = progress(local, FOLD - 40, 340, ease.inCubic)
  const fold = progress(local, FOLD, FOLD_DURATION, ease.inOutExpo)
  const scrim = progress(local, FOLD, FOLD_DURATION, ease.inOutCubic)
  const handoff = progress(local, HANDOFF, 80)
  const markY = mix(MARK_Y, CENTRE.y, fold)
  const dust = 0.42 * progress(local, 0, 500) * (1 - progress(local, FOLD - 200, 500))

  const lines = splitTagline(copy.tagline)

  return (
    <>
      {ink > 0.001 ? (
        <div className="absolute inset-0" style={{ background: INK, opacity: ink }} />
      ) : null}
      {scrim > 0.001 ? (
        <div className="absolute inset-0" style={{ background: INK, opacity: scrim }} />
      ) : null}

      {/* The climax's ring and spray, carried on through its lens once its frame is covered. */}
      {owned ? (
        <>
          <Ring
            at={FLASH}
            x={BIRTH.x}
            y={BIRTH.y}
            from={24 * CLIMAX_LENS.zoom}
            to={820 * CLIMAX_LENS.zoom}
            duration={460}
            // A shade warmer than the climax's own, so it fades out warm, never grey.
            color="#ffb27f"
            width={6 * CLIMAX_LENS.zoom}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              transformOrigin: `${BIRTH.x}px ${BIRTH.y}px`,
              transform: `rotate(${CLIMAX_LENS.roll}deg) scale(${CLIMAX_LENS.zoom})`,
            }}
          >
            <Burst
              at={FLASH + 10}
              x={BIRTH.x}
              y={BIRTH.y}
              count={44}
              seed={42}
              shape="spark"
              speed={[900, 2300]}
              size={[3, 7]}
              life={[300, 470]}
              gravity={0}
              colors={['#ffffff', '#ffd2b8', BRAND]}
            />
          </div>
        </>
      ) : null}

      <Camera zoom={zoom}>
        <Rays
          x={CENTRE.x}
          y={markY}
          size={1650 * mix(1, 0.3, fold)}
          turn={local * 0.008}
          opacity={(0.2 + 0.28 * flare) * shown * (1 - fold)}
        />
        {fold < 1 ? (
          <Glow
            x={CENTRE.x}
            y={markY}
            size={mix(840, 140, fold) * (1 + 0.05 * Math.sin(local / 300))}
            opacity={(0.34 + 0.3 * flare) * shown * (1 - fold)}
          />
        ) : null}

        {/* Flat on purpose: the card turns in its own perspective, so it must not be depth-sorted
            against the rays plane in the camera's 3D context (that tints the name). */}
        {shown > 0 ? (
          <div className="absolute inset-0" style={{ transformStyle: 'flat' }}>
            <div
              className="absolute inset-0"
              style={{
                opacity: shown,
                // Born from the climax's flash point below it: rising, settling back from close.
                transform: `perspective(1600px) translateY(${mix(60, 0, arrive)}px) scale(${mix(1.14, 1, arrive)}) rotateX(${mix(10, 0, arrive)}deg) rotateY(${mix(-2.5, 2.5, push) * (1 - release)}deg)`,
                transformOrigin: `${CENTRE.x}px ${MARK_Y + 120}px`,
                filter: focus < 0.99 ? `blur(${mix(12, 0, focus)}px)` : undefined,
              }}
            >
              {wordsOut < 1 ? (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: 1 - wordsOut,
                    transform: `scale(${1 - 0.12 * wordsOut})`,
                    transformOrigin: `${CENTRE.x}px ${MARK_Y}px`,
                    filter: wordsOut > 0.01 ? `blur(${10 * wordsOut}px)` : undefined,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: WIDTH,
                      top: NAME_Y - NAME_SIZE / 2,
                      textAlign: 'center',
                      fontSize: NAME_SIZE,
                      fontWeight: 650,
                      letterSpacing: '-0.035em',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      color: 'white',
                    }}
                  >
                    {[...copy.appName].map((letter, index) => {
                      const p = progress(local, index * 24, 600, ease.outExpo)
                      return (
                        <span
                          key={index}
                          style={{
                            display: 'inline-block',
                            whiteSpace: 'pre',
                            opacity: clamp(p * 1.5),
                            transform:
                              p < 1 ? `translateY(${(1 - p) * NAME_SIZE * 0.45}px)` : undefined,
                            filter: p < 0.97 ? `blur(${(1 - p) * 9}px)` : undefined,
                          }}
                        >
                          {letter}
                        </span>
                      )
                    })}
                  </div>
                  {lines.map((line, index) => {
                    const p = progress(local, 400 + index * 180, 640, ease.outExpo)
                    if (p <= 0) return null
                    return (
                      <div
                        key={index}
                        style={{
                          position: 'absolute',
                          left: 0,
                          width: WIDTH,
                          top: TAG_Y[index]! - TAG_SIZE * 0.65,
                          textAlign: 'center',
                          fontSize: TAG_SIZE,
                          fontWeight: 500,
                          letterSpacing: '-0.01em',
                          lineHeight: 1.3,
                          whiteSpace: 'nowrap',
                          color: 'rgb(255 255 255 / 0.72)',
                          opacity: p,
                          transform: `translateY(${(1 - p) * 26}px)`,
                          filter: p < 0.97 ? `blur(${(1 - p) * 10}px)` : undefined,
                        }}
                      >
                        {line}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {handoff < 1 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: CENTRE.x - MARK / 2,
                    top: markY - MARK / 2,
                    width: MARK,
                    height: MARK,
                    opacity: 1 - handoff,
                    transform: `scale(${mix(1, EMBER_REST.size / MARK, fold)})`,
                  }}
                >
                  {local < FOLD ? (
                    <>
                      <LogoMark size={MARK} glow={0.3 + 0.6 * flare + 0.8 * heat} />
                      {heat > 0.005 ? (
                        // White-hot as it is born, cooling to the brand's orange.
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: MARK * 0.26,
                            opacity: heat,
                            background:
                              'radial-gradient(circle at 50% 45%, #ffffff 0%, #fff1e6 45%, #ffc9a4 100%)',
                          }}
                        />
                      ) : null}
                      <Gloss
                        size={MARK}
                        radius={MARK * 0.26}
                        amount={progress(local, 1000, 520, ease.inOutCubic)}
                      />
                    </>
                  ) : (
                    <MarkShape
                      size={MARK}
                      glow={0.3 + 0.5 * fold}
                      // Rounds and loses its cap only once it is small: never a blank tile.
                      round={progress(local, FOLD + 240, 160, ease.inOutCubic)}
                      icon={1 - progress(local, FOLD + 260, 90)}
                    />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <Implode y={markY} />
      </Camera>

      {dust > 0.01 ? <Dust count={22} seed={47} opacity={dust} /> : null}
      {handoff > 0 ? <Ember heat={EMBER_REST.heat * handoff} /> : null}
      <Burn x={BIRTH.x} y={mix(BIRTH.y, MARK_Y + 4, arrive)} />
    </>
  )
}
