'use client'

import { useRouter } from 'next/navigation'
import { useSyncExternalStore, useTransition } from 'react'
import { DEV_LOCALE, DEV_LOCALE_COOKIE } from '@/messages/dev-locale'

/**
 * The cookie is external state. Nothing else writes it, so subscribers are only woken by
 * this component's own toggle — which is enough to keep the label honest without pushing
 * the value through an effect.
 */
const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  return () => {
    listeners.delete(onStoreChange)
  }
}

function getSnapshot() {
  return document.cookie
    .split('; ')
    .some((row) => row === `${DEV_LOCALE_COOKIE}=${DEV_LOCALE}`)
}

/** No cookies while rendering on the server; Ukrainian is the default either way. */
function getServerSnapshot() {
  return false
}

/**
 * Development-only reading aid: flips the interface between Ukrainian and Turkish so the
 * screens can be checked by someone who does not read Ukrainian. The root layout only
 * renders this when NODE_ENV is development, and the Turkish strings themselves are not
 * part of a production build at all.
 */
export function DevLocaleToggle() {
  const router = useRouter()
  const isTurkish = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [pending, startTransition] = useTransition()

  function toggle() {
    document.cookie = isTurkish
      ? `${DEV_LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${DEV_LOCALE_COOKIE}=${DEV_LOCALE}; path=/; max-age=31536000; samesite=lax`

    for (const listener of listeners) listener()
    startTransition(() => router.refresh())
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        isTurkish
          ? 'Arayüz Türkçe (sadece geliştirme). Ukraynacaya dön.'
          : 'Arayüz Ukraynaca. Türkçe okumak için tıkla (sadece geliştirme).'
      }
      className="fixed right-4 bottom-4 z-50 rounded-full border border-dashed border-amber-500/60 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-700 shadow-sm backdrop-blur transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300"
    >
      {isTurkish ? 'TR · dev' : 'UA · dev'}
    </button>
  )
}
