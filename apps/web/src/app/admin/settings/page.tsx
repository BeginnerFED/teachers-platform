import { DEFAULT_LOCALE, LOCALES, type Locale } from '@tp/shared'
import { listAdmins } from '@/features/admins/api'
import { AdminsCard } from '@/features/admins/components/admins-card'
import { getPlatformSettings } from '@/features/settings/api'
import { AppearanceCard } from '@/features/settings/components/appearance-card'
import { ProfileCard } from '@/features/settings/components/profile-card'
import { SecurityCard } from '@/features/settings/components/security-card'
import { SubscriptionDefaultsCard } from '@/features/settings/components/subscription-defaults-card'
import { requireViewer } from '@/lib/auth'
import { getMessages } from '@/messages/server'

/** The column is plain text; the dictionary decides what is actually supported. */
function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE
}

export default async function SettingsPage() {
  // Independent reads, so they go together rather than one after the other. The role is
  // already guarded by the layout above this.
  const [viewer, t, settings, admins] = await Promise.all([
    requireViewer(),
    getMessages(),
    getPlatformSettings(),
    listAdmins(),
  ])

  return (
    // Centred and held to a reading width. Settings are a column of decisions, not a
    // dashboard: stretching them across a wide screen would make every label and its
    // control sit at opposite ends of the eye's travel, and leaving the column pinned
    // left would make the empty half look like something failed to load.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="text-muted-foreground text-sm">{t.settings.description}</p>
      </div>

      <div className="flex flex-col gap-6">
        <ProfileCard
          fullName={viewer.full_name}
          email={viewer.email}
          locale={toLocale(viewer.locale)}
          t={t}
        />

        <SecurityCard t={t} />

        <AppearanceCard
          brandColor={settings.brandColor}
          defaultLocale={settings.defaultLocale}
          t={t}
        />

        <SubscriptionDefaultsCard
          trialDays={settings.trialDays}
          monthlyPrice={settings.monthlyPrice}
          t={t}
        />

        <AdminsCard admins={admins} locale={viewer.locale} t={t} />
      </div>
    </div>
  )
}
