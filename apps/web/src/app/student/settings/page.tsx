import { DEFAULT_LOCALE, LOCALES, type Locale } from '@tp/shared'
import { ProfileCard } from '@/features/settings/components/profile-card'
import { SecurityCard } from '@/features/settings/components/security-card'
import { SettingsNav } from '@/features/settings/components/settings-nav'
import { requireRole } from '@/lib/auth'
import { getMessages } from '@/messages/server'

export default async function StudentSettingsPage() {
  const [viewer, t] = await Promise.all([requireRole('student'), getMessages()])
  const locale = (LOCALES as readonly string[]).includes(viewer.locale)
    ? (viewer.locale as Locale)
    : DEFAULT_LOCALE
  const sections = [
    { id: 'profile', label: t.settings.profile.title },
    { id: 'security', label: t.settings.security.title },
  ]
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.settings.personalDescription}</p>
      </div>
      <div className="flex items-start gap-10">
        <SettingsNav sections={sections} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <ProfileCard
            id="profile"
            fullName={viewer.full_name}
            email={viewer.email}
            locale={locale}
            t={t}
          />
          <SecurityCard id="security" t={t} />
        </div>
      </div>
    </>
  )
}
