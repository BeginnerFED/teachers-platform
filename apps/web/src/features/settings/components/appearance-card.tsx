'use client'

import { RotateCcwIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LOCALES, type Locale } from '@tp/shared'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { brandTheme, DEFAULT_BRAND_COLOR } from '@/lib/brand'
import type { Messages } from '@/messages'
import { initialSettingsActionState } from '../action-state'
import { updateAppearance } from '../actions'
import { SettingsCard } from './settings-card'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Keeps the field from ever holding something that is not on its way to being a colour.
 * An incomplete value simply leaves the preview on the last complete one, which is why
 * this form has no error state to show.
 */
function sanitise(value: string): string {
  const digits = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)

  return `#${digits}`
}

export function AppearanceCard({
  brandColor,
  defaultLocale,
  t,
}: {
  brandColor: string
  defaultLocale: Locale
  t: Messages
}) {
  const [draft, setDraft] = useState(brandColor)
  const [color, setColor] = useState(brandColor)

  const theme = useMemo(() => brandTheme(color), [color])

  function change(value: string) {
    const next = sanitise(value)
    setDraft(next)
    if (HEX.test(next)) setColor(next.toLowerCase())
  }

  function reset() {
    setDraft(DEFAULT_BRAND_COLOR)
    setColor(DEFAULT_BRAND_COLOR)
  }

  return (
    <SettingsCard
      title={t.settings.appearance.title}
      description={t.settings.appearance.description}
      note={`${t.settings.appearance.contrast}: ${theme.contrast.toFixed(2)}:1 — ${t.settings.appearance.contrastOk}`}
      action={updateAppearance}
      initialState={initialSettingsActionState}
      describeError={(code) => t.errors[code]}
      successMessage={t.settings.saved}
      submitLabel={t.settings.save}
      pendingLabel={t.settings.saving}
    >
      {/* The value that is actually saved is the last one that parsed, never the half-typed
          contents of the field beside it. */}
      <input type="hidden" name="brandColor" value={color} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="brandColorText">{t.settings.appearance.brandColor}</FieldLabel>

          <div className="flex items-center gap-2">
            {/* The browser's own colour picker. Every platform already has one people know
                how to use, and shadcn has no equivalent to reach for. */}
            <label
              className="border-input ring-offset-background focus-within:ring-ring relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-xs focus-within:ring-2 focus-within:ring-offset-2"
              style={{ backgroundColor: color }}
            >
              <span className="sr-only">{t.settings.appearance.brandColor}</span>
              <input
                type="color"
                value={color}
                onChange={(event) => change(event.target.value)}
                className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer opacity-0"
              />
            </label>

            <Input
              id="brandColorText"
              value={draft}
              onChange={(event) => change(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="font-mono tabular-nums"
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={reset}
              title={t.settings.appearance.reset}
              aria-label={t.settings.appearance.reset}
              className="shrink-0"
            >
              <RotateCcwIcon />
            </Button>
          </div>

          <FieldDescription>{t.settings.appearance.brandColorHint}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="defaultLocale">{t.settings.appearance.defaultLocale}</FieldLabel>
          <Select name="defaultLocale" defaultValue={defaultLocale}>
            <SelectTrigger id="defaultLocale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t.locales[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t.settings.appearance.defaultLocaleHint}</FieldDescription>
        </Field>
      </div>

      {/* Every token the colour drives, applied to this box only. The button inside is the
          same component used everywhere else, so what shows here is what will ship. */}
      <div
        style={theme.light as React.CSSProperties}
        className="bg-muted/40 mt-5 flex items-center gap-4 rounded-lg border p-4"
      >
        <span className="text-muted-foreground text-xs">{t.settings.appearance.preview}</span>
        <Button type="button" size="sm" className="corner-brackets">
          {t.settings.appearance.previewButton}
        </Button>
        <span className="text-brand-text text-sm font-medium">{t.app.name}</span>
        <span className="bg-brand ml-auto size-6 rounded-full" />
      </div>
    </SettingsCard>
  )
}
