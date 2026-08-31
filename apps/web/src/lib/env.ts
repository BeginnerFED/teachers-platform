/**
 * Next inlines NEXT_PUBLIC_* at build time, so these have to be referenced by their
 * full literal name rather than looked up dynamically.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}. See apps/web/.env.example`)
  return value
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
)

export const SUPABASE_PUBLISHABLE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)
