import 'server-only'
import type { PlatformSettings, PublicSettings } from '@tp/shared'
import { unwrap } from '@/lib/api/errors'
import { getApi, getPublicApi } from '@/lib/api/server'
import { DEFAULT_BRAND_COLOR } from '@/lib/brand'

/** What an update invalidates, so the theme changes on the next render rather than in an hour. */
export const SETTINGS_TAG = 'platform-settings'

/**
 * Read on every render of the root layout, because the theme comes from it — including on
 * the sign-in page, where there is no session. Cached and tagged rather than fetched each
 * time: one round trip to Frankfurt in front of every page in the product would be a
 * costly way to look up a colour that changes twice a year.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const api = getPublicApi()

  try {
    return await unwrap(
      await api.v1.settings.$get(undefined, {
        init: { next: { revalidate: 3600, tags: [SETTINGS_TAG] } },
      }),
    )
  } catch {
    // The whole application would otherwise fail to render because a preference was
    // unreachable. Falling back to what the stylesheet already ships means an API outage
    // costs the right colour, not the page.
    return {
      brandColor: DEFAULT_BRAND_COLOR,
      defaultLocale: 'uk',
      trialDays: 7,
      monthlyPrice: null,
    }
  }
}

/** The same values plus who last changed them. Admin only; never cached. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const api = await getApi()

  return unwrap(await api.v1.admin.settings.$get())
}
