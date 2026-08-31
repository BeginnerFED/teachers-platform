'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Messages } from '@/messages'
import { signIn } from '../actions'
import { initialAuthState } from '../auth-state'

export function LoginForm({ t }: { t: Messages }) {
  const [state, formAction, pending] = useActionState(signIn, initialAuthState)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t.login.title}</h1>
          <p className="text-muted-foreground text-balance text-sm">{t.login.description}</p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">{t.auth.emailLabel}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            className="bg-background"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t.auth.passwordLabel}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="bg-background"
          />
        </Field>

        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t.login.submitting : t.login.submit}
          </Button>
          <FieldDescription className="text-center">
            {t.login.noAccount}{' '}
            <Link href="/signup" className="underline underline-offset-4">
              {t.login.signUpLink}
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
