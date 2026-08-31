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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="text-muted-foreground text-sm">{t.settings.description}</p>
      </div>

      {/* One column, held to a width a form is comfortable at. Pairing the cards two to a
          row was tried and read as a dashboard rather than a settings page — the space it
          filled was not worth what it cost in how the page scans. */}
      <div className="flex items-start gap-8">
        <SettingsNav sections={sections} />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
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

          <AdminsCard
            id={SECTION_IDS.administrators}
            admins={admins}
            locale={viewer.locale}
            t={t}
          />
        </div>
      </div>
    </div>
  )
}
