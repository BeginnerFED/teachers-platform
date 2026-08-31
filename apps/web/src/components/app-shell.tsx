import type { ReactNode } from 'react'
import { signOut } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/auth'
import { getMessages } from '@/messages/server'

type AppShellProps = {
  profile: Profile
  title: string
  description: string
  children?: ReactNode
}

export async function AppShell({ profile, title, description, children }: AppShellProps) {
  const t = await getMessages()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-heading font-medium">{t.app.name}</span>

        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">{profile.full_name}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              {t.common.signOut}
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <h1 className="font-heading text-2xl">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        {children}
      </main>
    </div>
  )
}
