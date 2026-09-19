import 'server-only'

import { aiLimitDetailsSchema, type AiLimitDetails } from '@tp/shared'
import { ApiError } from '@/lib/api/errors'

export type AiActionFailure = {
  error: string
  limit: AiLimitDetails | null
}

/** Keep untrusted API error details out of client components unless they match our contract. */
export function readAiActionFailure(error: unknown): AiActionFailure | null {
  if (!(error instanceof ApiError)) return null

  const details = aiLimitDetailsSchema.safeParse(error.details)

  return {
    error: error.code,
    limit: details.success ? details.data : null,
  }
}
