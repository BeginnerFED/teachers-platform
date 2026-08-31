import { GraduationCapIcon } from 'lucide-react'
import { getMessages } from '@/messages/server'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const t = await getMessages()

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <span className="flex items-center gap-2 font-medium">
            <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GraduationCapIcon className="size-4" />
            </span>
            {t.app.name}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm t={t} />
          </div>
        </div>
      </div>

      {/* login-02 puts a photograph here. Until there is one worth showing, a plain
          panel carrying the promise reads better than a stock image. */}
      <aside className="bg-muted relative hidden overflow-hidden lg:block">
        <div className="from-primary/20 via-primary/5 absolute inset-0 bg-gradient-to-br to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-3 p-10">
          <p className="font-heading max-w-sm text-balance text-2xl leading-snug">
            {t.app.tagline}
          </p>
          <p className="text-muted-foreground max-w-sm text-sm">{t.app.description}</p>
        </div>
      </aside>
    </div>
  )
}
