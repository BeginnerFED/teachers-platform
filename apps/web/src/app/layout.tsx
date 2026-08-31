import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { uk } from '@/messages'
import './globals.css'

/**
 * Inter v4, self-hosted rather than pulled from Google Fonts.
 *
 * Google serves Inter with a weight axis only. The optical size axis — a text cut at
 * small sizes that becomes a tighter, finer display cut as type grows — only exists in
 * the full variable file, and it is the single biggest reason large headings look drawn
 * rather than scaled up. Geist ships no Cyrillic, so it was never an option here.
 */
const sans = localFont({
  src: './fonts/InterVariable.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
})

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: uk.app.name,
  description: uk.app.description,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // The condition folds to false at build time, so the import below — and with it the
  // whole reading aid — is removed from the production bundle rather than merely hidden.
  const DevLocaleToggle =
    process.env.NODE_ENV === 'development'
      ? (await import('@/components/dev/locale-toggle')).DevLocaleToggle
      : null

  return (
    <html lang="uk" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* The sidebar's collapsed rail shows its labels as tooltips, which Radix only
            renders inside a provider. */}
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        {DevLocaleToggle ? <DevLocaleToggle /> : null}
      </body>
    </html>
  )
}
