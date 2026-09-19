import { describe, expect, it } from 'vitest'
import { hasAiConfiguration, parseEnv } from './env'

const base = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret',
}

describe('environment configuration', () => {
  it('allows local development without AI credentials and reports the feature disabled', () => {
    const parsed = parseEnv({ ...base, NODE_ENV: 'development' })

    expect(hasAiConfiguration(parsed)).toBe(false)
  })

  it('rejects a partial Cloudflare configuration', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'development',
        CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      }),
    ).toThrow('configured together')
  })

  it('requires Workers AI credentials in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow('required in production')
  })

  it('accepts a complete production configuration without exposing either secret', () => {
    const parsed = parseEnv({
      ...base,
      NODE_ENV: 'production',
      CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32),
      CLOUDFLARE_AI_API_TOKEN: 'workers-ai-token',
    })

    expect(hasAiConfiguration(parsed)).toBe(true)
  })
})
