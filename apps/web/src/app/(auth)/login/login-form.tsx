'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Messages } from '@/messages'
import { signIn } from '../actions'
import { initialAuthState } from '../auth-state'

export function LoginForm({ t }: { t: Messages }) {
  const [state, formAction, pending] = useActionState(signIn, initialAuthState)

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t.auth.emailLabel}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t.auth.passwordLabel}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.login.submitting : t.login.submit}
            </Button>
          </CardContent>

          <CardFooter className="mt-4 justify-center">
            <p className="text-muted-foreground text-sm">
              {t.login.noAccount}{' '}
              <Link href="/signup" className="text-foreground underline underline-offset-4">
                {t.login.signUpLink}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
