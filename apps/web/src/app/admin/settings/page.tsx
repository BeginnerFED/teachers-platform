import { DEFAULT_LOCALE, LOCALES, type Locale } from '@tp/shared'
import { listAdmins } from '@/features/admins/api'
import { AdminsCard } from '@/features/admins/components/admins-card'
import { getPlatformSettings } from '@/features/settings/api'
import { AppearanceCard } from '@/features/settings/components/appearance-card'
import { ProfileCard } from '@/features/settings/components/profile-card'
import { SecurityCard } from '@/features/settings/components/security-card'
import { SettingsNav } from '@/features/settings/components/settings-nav'
import { SubscriptionDefaultsCard } from '@/features/settings/components/subscription-defaults-card'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/** The column is plain text; the dictionary decides what is actually supported. */
function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE
}

/**
 * Declared once, here, rather than in each card. The rail and the anchors it points at
 * cannot drift apart if the same list produces both.
 */
const SECTION_IDS = {
  profile: 'profile',
  security: 'security',
  appearance: 'appearance',
  subscriptions: 'subscriptions',
  administrators: 'administrators',
} as const

export default async function SettingsPage() {
  // Independent reads, so they go together rather than one after the other. The role is
  // already guarded by the layout above this.
  const [viewer, t, settings, admins] = await Promise.all([
    requireViewer(),
    getMessages(),
    getPlatformSettings(),
    listAdmins(),
  ])

  const sections = [
    { id: SECTION_IDS.profile, label: t.settings.profile.title },
    { id: SECTION_IDS.security, label: t.settings.security.title },
    { id: SECTION_IDS.appearance, label: t.settings.appearance.title },
    { id: SECTION_IDS.subscriptions, label: t.settings.subscriptions.title },
    { id: SECTION_IDS.administrators, label: t.admins.title },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="text-muted-foreground text-sm">{t.settings.description}</p>
      </div>

      {/* A single column of forms cannot fill a screen this wide, and stretching the fields
          to try only makes each one worse. Past 1600px the cards pair off instead: two
          short, unrelated forms side by side read as a settings dashboard, where one column
          with half the screen empty beside it reads as something that failed to load.
          Narrower than that and there is no room for two, so they stack. */}
      <div className="flex items-start gap-8">
        <SettingsNav sections={sections} />

        <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-5 min-[1600px]:grid-cols-2">
          <ProfileCard
            id={SECTION_IDS.profile}
            fullName={viewer.full_name}
            email={viewer.email}
            locale={toLocale(viewer.locale)}
            t={t}
          />

          <SecurityCard id={SECTION_IDS.security} t={t} />

          <AppearanceCard
            id={SECTION_IDS.appearance}
            brandColor={settings.brandColor}
            defaultLocale={settings.defaultLocale}
            t={t}
          />

          <SubscriptionDefaultsCard
            id={SECTION_IDS.subscriptions}
            trialDays={settings.trialDays}
            monthlyPrice={settings.monthlyPrice}
            t={t}
          />

          {/* The one card holding a table rather than a form, so it takes the full width
              whatever the others are doing. */}
          <AdminsCard
            id={SECTION_IDS.administrators}
            admins={admins}
            locale={viewer.locale}
            t={t}
            className="min-[1600px]:col-span-2"
          />
        </div>
      </div>
    </div>
  )
}
