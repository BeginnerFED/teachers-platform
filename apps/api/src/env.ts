import { z } from 'zod'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    SUPABASE_URL: z.string().url(),
    // Full-access key. Present only on the server; never exposed to the browser.
    SUPABASE_SECRET_KEY: z.string().min(1),

    CLOUDFLARE_ACCOUNT_ID: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{32}$/i, 'Must be a 32-character Cloudflare account ID')
      .optional(),
    // Server-side token with Workers AI access. Never exposed to the browser.
    CLOUDFLARE_AI_API_TOKEN: z.string().trim().min(1).optional(),
    CLOUDFLARE_AI_MODEL: z.string().trim().min(1).default('@cf/google/gemma-4-26b-a4b-it'),
  })
  .superRefine((value, context) => {
    const account = Boolean(value.CLOUDFLARE_ACCOUNT_ID)
    const token = Boolean(value.CLOUDFLARE_AI_API_TOKEN)

    if (account !== token) {
      context.addIssue({
        code: 'custom',
        path: [account ? 'CLOUDFLARE_AI_API_TOKEN' : 'CLOUDFLARE_ACCOUNT_ID'],
        message: 'Cloudflare Workers AI account ID and API token must be configured together',
      })
    }

    // AI is part of the shipped product. Development and tests may deliberately run
    // without it, but a production API must not boot with visible features that can only
    // fail on their first click.
    if (value.NODE_ENV === 'production' && (!account || !token)) {
      context.addIssue({
        code: 'custom',
        path: ['CLOUDFLARE_AI_API_TOKEN'],
        message: 'Cloudflare Workers AI configuration is required in production',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

/**
 * Pure, so a test can hand it a fixture instead of mutating the real process. Throws
 * rather than exiting: a misconfigured server should fail loudly at boot, but a test
 * importing this module should not be able to kill the runner.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`)
  }

  return parsed.data
}

export const env = parseEnv()

/** A non-secret feature state safe to expose in health metadata. */
export function hasAiConfiguration(value: Env = env): boolean {
  return Boolean(value.CLOUDFLARE_ACCOUNT_ID && value.CLOUDFLARE_AI_API_TOKEN)
}
