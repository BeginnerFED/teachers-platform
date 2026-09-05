'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Messages } from '@/messages'

/**
 * A password being shown for the only time it ever will be — a new account's, or a reset
 * one. The same panel either way, because what the person looking at it has to do is the
 * same: copy it now, pass it on, and know it will not be here when they come back.
 */
export function PasswordPanel({
  title,
  email,
  password,
  onDone,
  t,
}: {
  title: string
  email: string
  password: string
  onDone: () => void
  t: Messages
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused outright. The password is on screen and
      // selectable either way, so there is nothing to recover from and nothing to say.
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t.accounts.created.description}</DialogDescription>
      </DialogHeader>

      <div className="bg-muted/40 grid gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs">{t.accounts.created.email}</span>
          <span className="break-all text-sm font-medium">{email}</span>
        </div>

        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs">{t.accounts.created.password}</span>
          <div className="flex items-center gap-2">
            <code className="bg-background flex-1 select-all break-all rounded-md border px-3 py-2 font-mono text-sm">
              {password}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={copy} className="shrink-0">
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className="sr-only">
                {copied ? t.accounts.created.copied : t.accounts.created.copy}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDone} className="corner-brackets">
          {t.accounts.created.done}
        </Button>
      </DialogFooter>
    </>
  )
}
