import type { Metadata } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { uk } from '@/messages'
import './globals.css'

// The interface is Ukrainian, and Geist ships no Cyrillic — Inter does.
// globals.css reads --font-sans, so the variable name has to match exactly.
const sans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'cyrillic'],
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
        {children}
        <Toaster />
        {DevLocaleToggle ? <DevLocaleToggle /> : null}
      </body>
    </html>
  )
}
