import type { ApiErrorEnvelope, ErrorCode, PageMeta } from '@tp/shared'

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    /** Ties this failure to the exact request in the API's logs. */
    readonly requestId: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type JsonResponse<Body> = {
  ok: boolean
  status: number
  json: () => Promise<Body>
}

async function readEnvelope(response: JsonResponse<unknown>): Promise<never> {
  const body = (await response.json().catch(() => null)) as Partial<ApiErrorEnvelope> | null

  throw new ApiError(
    body?.error?.code ?? 'internal',
    response.status,
    body?.error?.requestId ?? null,
    body?.error?.message ?? `Request failed with ${response.status}`,
  )
}

/**
 * Unwraps a successful response, or throws a typed error.
 *
 * Every call goes through here so failure handling lives in one place: the caller gets
 * the data it asked for, and a failure surfaces as an ApiError carrying a code the UI
 * can translate rather than an English sentence to render.
 */
export async function unwrap<Data>(response: JsonResponse<{ data: Data }>): Promise<Data> {
  if (!response.ok) await readEnvelope(response)

  return (await response.json()).data
}

/** Same, for endpoints that return a page of results alongside their count. */
export async function unwrapPage<Data>(
  response: JsonResponse<{ data: Data; meta: PageMeta }>,
): Promise<{ data: Data; meta: PageMeta }> {
  if (!response.ok) await readEnvelope(response)

  return response.json()
}
