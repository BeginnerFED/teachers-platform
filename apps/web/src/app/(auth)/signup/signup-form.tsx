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
import { signUp } from '../actions'
import { initialAuthState } from '../auth-state'

export function SignUpForm({ t }: { t: Messages }) {
  const [state, formAction, pending] = useActionState(signUp, initialAuthState)

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.signup.title}</CardTitle>
          <CardDescription>{t.signup.description}</CardDescription>
        </CardHeader>

        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">{t.auth.fullNameLabel}</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required />
            </div>

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
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            ) : null}

            {state.notice ? (
              <p role="status" className="text-sm">
                {state.notice}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.signup.submitting : t.signup.submit}
            </Button>
          </CardContent>

          <CardFooter className="mt-4 justify-center">
            <p className="text-muted-foreground text-sm">
              {t.signup.hasAccount}{' '}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                {t.signup.logInLink}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
