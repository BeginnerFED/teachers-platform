'use server'

import { aiUsageStatusSchema, type AiUsageStatus } from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'

export async function loadAiUsage(): Promise<{
  usage: AiUsageStatus | null
  error: string | null
}> {
  try {
    const api = await getApi()
    const response = await unwrap(await api.v1.ai.usage.$get())

    return { usage: aiUsageStatusSchema.parse(response), error: null }
  } catch (error) {
    if (error instanceof ApiError) return { usage: null, error: error.code }

    throw error
  }
}
