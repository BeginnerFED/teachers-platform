import { cookies } from 'next/headers'
import { uk } from './uk'
import { DEV_LOCALE, DEV_LOCALE_COOKIE } from './dev-locale'
import type { Messages } from './index'

if (process.env.NODE_ENV === 'production') {
  throw new Error('The development reading aid must never be loaded in production.')
}

/** Reads the toggle cookie and hands back Turkish only when it is explicitly set. */
export async function readDevMessages(): Promise<Messages> {
  const store = await cookies()
  if (store.get(DEV_LOCALE_COOKIE)?.value !== DEV_LOCALE) return uk

  const { tr } = await import('./tr')
  return tr
}
