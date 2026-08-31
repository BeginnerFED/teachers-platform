'use client'

import { useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ActionResult = { error: string | null; saved: boolean }

/**
 * The shell every settings card shares: a heading, its fields, and a footer that saves.
 *
 * Each card owns its own form and its own request. One page-wide save button would make
 * the admin wonder which of five sections a failure came from, and would send four
 * unchanged sections along with the one they meant to edit.
 *
 * Generic over the result because the password form fails in ways an API error code
 * cannot express — a mistyped confirmation is not a status code.
 */
export function SettingsCard<State extends ActionResult>({
  title,
  description,
  note,
  children,
  action,
  initialState,
  describeError,
  successMessage,
  submitLabel,
  pendingLabel,
  resetOnSuccess = false,
}: {
  title: string
  description: string
  /** Sits opposite the button, for the thing worth saying about the whole card. */
  note?: ReactNode
  children: ReactNode
  action: (previous: State, formData: FormData) => Promise<State>
  initialState: State
  describeError: (error: NonNullable<State['error']>) => string
  successMessage: string
  submitLabel: string
  pendingLabel: string
  /** For the password form, where leaving what was typed on screen serves nobody. */
  resetOnSuccess?: boolean
}) {
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    // Read before the transition: currentTarget is null by the time the await resolves.
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await action(initialState, formData)

      if (result.error) {
        toast.error(describeError(result.error as NonNullable<State['error']>))
        return
      }

      toast.success(successMessage)
      if (resetOnSuccess) form.reset()
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="pt-1">{children}</CardContent>

        <CardFooter className="justify-between gap-4">
          <p className="text-muted-foreground text-xs text-balance">{note}</p>

          <Button type="submit" disabled={pending} className="corner-brackets shrink-0">
            {pending ? pendingLabel : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
