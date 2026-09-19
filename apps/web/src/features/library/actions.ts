'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  assetIdParam,
  binSelectionBody,
  checkAnswersBody,
  createStepBody,
  createUploadBody,
  generateLessonDraftBody,
  materialIdParam,
  reorderStepsBody,
  replaceLessonWithAiDraftBody,
  stepIdParam,
  updateMaterialBody,
  updateStepBody,
  type CreateUploadBody,
  type AiLimitDetails,
  type AiDraftMaterialMetadata,
  type GenerateLessonDraftBody,
  type GeneratedLessonDraft,
  type MaterialAsset,
  type MaterialStep,
  type StepCheckResult,
  type StudentMaterial,
  type UpdateMaterialBody,
  type UpdateStepBody,
  type UploadTicket,
} from '@tp/shared'
import { ApiError, unwrap } from '@/lib/api/errors'
import { getApi } from '@/lib/api/server'
import { getMessages } from '@/messages/server'
import { readAiActionFailure } from '@/features/ai/server'

/** Everything the library shows changes together, so one path covers the lot. */
function refreshLibrary() {
  revalidatePath('/admin')
  revalidatePath('/library', 'layout')
}

/**
 * No form. A lesson is a blank canvas, and asking four questions in front of one is
 * backwards — the level and the description are things you know once you have built it.
 *
 * So this makes the draft and drops the teacher into it. Everything the old dialog asked
 * for is edited in place on the lesson's own page, which is where it had to end up
 * anyway: until now there was no way to rename a lesson at all.
 */
export async function createDraft(): Promise<void> {
  const t = await getMessages()

  const api = await getApi()
  const created = await unwrap(
    await api.v1.materials.$post({
      json: { title: t.library.edit.untitled, level: 'A1', tags: [], visibility: 'private' },
    }),
  )

  refreshLibrary()
  redirect(`/library/${created.id}`)
}

/** Saves one field at a time, as it is edited. */
export async function updateMaterial(
  materialId: string,
  patch: UpdateMaterialBody,
): Promise<{ error: string | null }> {
  const params = materialIdParam.safeParse({ materialId })
  const body = updateMaterialBody.safeParse(patch)

  if (!params.success || !body.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.materials[':materialId'].$patch({ param: params.data, json: body.data }),
    )

    refreshLibrary()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

export async function deleteMaterial(materialId: string): Promise<{ error: string | null }> {
  const parsed = materialIdParam.safeParse({ materialId })
  if (!parsed.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(await api.v1.materials[':materialId'].$delete({ param: parsed.data }))

    refreshLibrary()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

export async function restoreMaterial(materialId: string): Promise<{ error: string | null }> {
  const parsed = materialIdParam.safeParse({ materialId })
  if (!parsed.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(await api.v1.materials[':materialId'].restore.$post({ param: parsed.data }))

    refreshLibrary()

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

/**
 * Several lessons out of the bin, or all of them when nothing is named. The count comes
 * back so the toast can say what happened rather than that something did.
 */
export async function restoreBinned(
  materialIds?: string[],
): Promise<{ restored: number; error: string | null }> {
  const parsed = binSelectionBody.safeParse({ materialIds })
  if (!parsed.success) return { restored: 0, error: 'validation_failed' }

  try {
    const api = await getApi()
    const { restored } = await unwrap(
      await api.v1.materials.bin.restore.$post({ json: parsed.data }),
    )

    refreshLibrary()

    return { restored, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { restored: 0, error: error.code }

    throw error
  }
}

/** Gone for good — the named lessons, or the whole bin. Only ever reached through a confirm. */
export async function purgeBinned(
  materialIds?: string[],
): Promise<{ deleted: number; error: string | null }> {
  const parsed = binSelectionBody.safeParse({ materialIds })
  if (!parsed.success) return { deleted: 0, error: 'validation_failed' }

  try {
    const api = await getApi()
    const { deleted } = await unwrap(await api.v1.materials.bin.purge.$post({ json: parsed.data }))

    refreshLibrary()

    return { deleted, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { deleted: 0, error: error.code }

    throw error
  }
}

/**
 * A frozen copy, owned by whoever asked for it. Lands on the new lesson rather than back
 * on the list: copying is the first half of "and now let me change it".
 */
export async function copyMaterial(materialId: string): Promise<{ error: string | null }> {
  const parsed = materialIdParam.safeParse({ materialId })
  if (!parsed.success) return { error: 'validation_failed' }

  let copyId: string

  try {
    const api = await getApi()
    const copy = await unwrap(
      await api.v1.materials[':materialId'].copy.$post({ param: parsed.data }),
    )
    copyId = copy.id
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }

  refreshLibrary()
  redirect(`/library/${copyId}`)
}

/* ------------------------------------------------------------------ the editor --- */

/**
 * None of these revalidate the lesson's own page. The editor owns what is on screen and
 * an autosave that re-rendered the page underneath it would hand the author back a copy
 * of what they typed two seconds ago. Only the library list is refreshed, and only by the
 * calls that change something it shows.
 */
export async function addStep(
  materialId: string,
  body: { title?: string; position?: number } = {},
): Promise<{ step: MaterialStep | null; error: string | null }> {
  const params = materialIdParam.safeParse({ materialId })
  const parsed = createStepBody.safeParse(body)

  if (!params.success || !parsed.success) return { step: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const step = await unwrap(
      await api.v1.materials[':materialId'].steps.$post({ param: params.data, json: parsed.data }),
    )

    revalidatePath('/library')

    return { step, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { step: null, error: error.code }

    throw error
  }
}

/**
 * The autosave. Returns the step so the caller can take the fresh `updatedAt` as the lock
 * for the next save; a stale one comes back as `conflict`, which is the other tab winning.
 */
export async function saveStep(
  materialId: string,
  stepId: string,
  patch: UpdateStepBody,
): Promise<{ step: MaterialStep | null; error: string | null }> {
  const params = stepIdParam.safeParse({ materialId, stepId })
  const body = updateStepBody.safeParse(patch)

  if (!params.success || !body.success) return { step: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const step = await unwrap(
      await api.v1.materials[':materialId'].steps[':stepId'].$patch({
        param: params.data,
        json: body.data,
      }),
    )

    return { step, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { step: null, error: error.code }

    throw error
  }
}

export async function deleteStep(
  materialId: string,
  stepId: string,
): Promise<{ error: string | null }> {
  const params = stepIdParam.safeParse({ materialId, stepId })
  if (!params.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(
      await api.v1.materials[':materialId'].steps[':stepId'].$delete({ param: params.data }),
    )

    revalidatePath('/library')

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

export async function reorderSteps(
  materialId: string,
  orderedStepIds: string[],
): Promise<{ steps: MaterialStep[] | null; error: string | null }> {
  const params = materialIdParam.safeParse({ materialId })
  const body = reorderStepsBody.safeParse({ orderedStepIds })

  if (!params.success || !body.success) return { steps: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const steps = await unwrap(
      await api.v1.materials[':materialId'].steps.reorder.$post({
        param: params.data,
        json: body.data,
      }),
    )

    return { steps, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { steps: null, error: error.code }

    throw error
  }
}

/**
 * The steps as the server has them right now. The editor asks on mount: a page restored
 * from the browser's cache shows the lesson as it was when last seen, with the locks it
 * had then, and a save made against those is a save the server rightly refuses.
 */
export async function loadSteps(materialId: string): Promise<{
  steps: MaterialStep[] | null
  metadata: AiDraftMaterialMetadata | null
  error: string | null
}> {
  const params = materialIdParam.safeParse({ materialId })
  if (!params.success) return { steps: null, metadata: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const material = await unwrap(
      await api.v1.materials[':materialId'].$get({ param: params.data }),
    )

    return {
      steps: material.steps,
      metadata: {
        title: material.title,
        description: material.description,
        level: material.level,
        tags: material.tags,
      },
      error: null,
    }
  } catch (error) {
    if (error instanceof ApiError) return { steps: null, metadata: null, error: error.code }

    throw error
  }
}

/**
 * Produces an unsaved proposal. Nothing in the material changes until the editor shows
 * the proposal and the author explicitly confirms replacing its steps.
 */
export async function generateLessonDraft(body: GenerateLessonDraftBody): Promise<{
  draft: GeneratedLessonDraft | null
  error: string | null
  limit: AiLimitDetails | null
}> {
  const parsed = generateLessonDraftBody.safeParse(body)
  if (!parsed.success) return { draft: null, error: 'validation_failed', limit: null }

  try {
    const api = await getApi()
    const draft = await unwrap(await api.v1.ai['lesson-drafts'].$post({ json: parsed.data }))

    return { draft, error: null, limit: null }
  } catch (error) {
    const failure = readAiActionFailure(error)
    if (failure) return { draft: null, ...failure }

    throw error
  }
}

/**
 * Adopts a reviewed proposal through one API command. Metadata, generated steps,
 * optimistic-lock checks, deletion and ordering all commit or roll back together.
 */
export async function replaceLessonWithAiDraft(
  materialId: string,
  expectedMetadata: AiDraftMaterialMetadata,
  originalSteps: Pick<MaterialStep, 'id' | 'updatedAt'>[],
  draft: GeneratedLessonDraft,
): Promise<{ steps: MaterialStep[] | null; error: string | null }> {
  const params = materialIdParam.safeParse({ materialId })
  const body = replaceLessonWithAiDraftBody.safeParse({ expectedMetadata, originalSteps, draft })

  if (!params.success || !body.success) {
    return { steps: null, error: 'validation_failed' }
  }

  try {
    const api = await getApi()
    const steps = await unwrap(
      await api.v1.materials[':materialId']['ai-draft'].$post({
        param: params.data,
        json: body.data,
      }),
    )

    return { steps, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { steps: null, error: error.code }

    throw error
  }
}

/**
 * The lesson as a student would get it, for the preview that opens on the author's own
 * page. Fetched from the server rather than projected in the browser so that what the
 * author sees is exactly the payload a student receives — stripped by the same code.
 */
export async function loadPlayable(
  materialId: string,
): Promise<{ material: StudentMaterial | null; error: string | null }> {
  const params = materialIdParam.safeParse({ materialId })
  if (!params.success) return { material: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const material = await unwrap(
      await api.v1.materials[':materialId'].play.$get({ param: params.data }),
    )

    return { material, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { material: null, error: error.code }

    throw error
  }
}

/* ------------------------------------------------------------------- media --- */

/**
 * Somewhere to put a file. The bytes do not come through here — a server action has a body
 * limit measured in megabytes and a recording is not — so this hands back a one-time URL
 * the browser puts them into directly.
 */
export async function requestUpload(
  body: CreateUploadBody,
): Promise<{ ticket: UploadTicket | null; error: string | null }> {
  const parsed = createUploadBody.safeParse(body)
  if (!parsed.success) return { ticket: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const ticket = await unwrap(await api.v1.assets.$post({ json: parsed.data }))

    return { ticket, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { ticket: null, error: error.code }

    throw error
  }
}

/** The bytes are up. Until this returns, nothing in a lesson may point at the file. */
export async function confirmUpload(
  assetId: string,
): Promise<{ asset: MaterialAsset | null; error: string | null }> {
  const parsed = assetIdParam.safeParse({ assetId })
  if (!parsed.success) return { asset: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const asset = await unwrap(
      await api.v1.assets[':assetId'].confirm.$post({ param: parsed.data }),
    )

    return { asset, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { asset: null, error: error.code }

    throw error
  }
}

export async function removeAsset(assetId: string): Promise<{ error: string | null }> {
  const parsed = assetIdParam.safeParse({ assetId })
  if (!parsed.success) return { error: 'validation_failed' }

  try {
    const api = await getApi()
    await unwrap(await api.v1.assets[':assetId'].$delete({ param: parsed.data }))

    return { error: null }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.code }

    throw error
  }
}

/**
 * Marks one step. The answer key never reaches the browser, so this round trip is what
 * makes an exercise an exercise rather than a form nobody grades.
 */
export async function checkStep(
  materialId: string,
  stepId: string,
  answers: Record<string, unknown>,
): Promise<{ result: StepCheckResult | null; error: string | null }> {
  const params = stepIdParam.safeParse({ materialId, stepId })
  const body = checkAnswersBody.safeParse({ answers })

  if (!params.success || !body.success) return { result: null, error: 'validation_failed' }

  try {
    const api = await getApi()
    const result = await unwrap(
      await api.v1.materials[':materialId'].steps[':stepId'].check.$post({
        param: params.data,
        json: body.data,
      }),
    )

    return { result, error: null }
  } catch (error) {
    if (error instanceof ApiError) return { result: null, error: error.code }

    throw error
  }
}
