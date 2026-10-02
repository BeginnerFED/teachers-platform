'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { PromoVideoCopy } from './promo-video'

const PromoVideo = dynamic(() => import('./promo-video').then((module) => module.PromoVideo), {
  ssr: false,
})

/** The panel only exists from `lg` up; below it the film is never even downloaded. */
const WIDE = '(min-width: 64rem)'

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

/** Somebody who asked their browser to save data gets the still poster, not a film. */
function readWanted(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return window.matchMedia(WIDE).matches && !connection?.saveData
}

const serverFalse = () => false

/**
 * Where the film goes. Until it arrives — on the server, without JavaScript, on a phone —
 * the panel shows the poster the page renders under it.
 *
 * The player is fetched once the browser is idle, so it never competes with the sign-in
 * form for the first moments of the page.
 */
export function LoginPromoSlot({ copy }: { copy: PromoVideoCopy }) {
  const wanted = useSyncExternalStore(subscribeWide, readWanted, serverFalse)
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!wanted) return

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setIdle(true), { timeout: 1500 })
      return () => window.cancelIdleCallback(handle)
    }

    const handle = window.setTimeout(() => setIdle(true), 300)
    return () => window.clearTimeout(handle)
  }, [wanted])

  return wanted && idle ? <PromoVideo copy={copy} /> : null
}
