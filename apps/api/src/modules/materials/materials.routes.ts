import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../../http/context'
import {
  addStep,
  checkStep,
  copyMaterial,
  createMaterial,
  deleteMaterial,
  deleteStep,
  getMaterial,
  listLevels,
  listMaterials,
  playMaterial,
  purgeBin,
  reorderSteps,
  replaceMaterialWithAiDraft,
  restoreBin,
  restoreMaterial,
  updateMaterial,
  updateStep,
} from './materials.controller'

/** A step's answers may include several writing blocks. */
const CHECK_BODY_BYTES = 256 * 1024

/**
 * Actions are commands rather than a PATCH of some `deleted` field: whether restoring is
 * allowed, and what a copy inherits, are rules that belong on the server and would leak
 * into every client the moment the endpoint became "write whatever you like to this row".
 *
 * One unbroken chain — `AppType`, and with it the web app's typed client, is built from it.
 * The fixed paths — the bin's, and the levels — sit above `/:materialId`, or "bin"
 * would be read as an id.
 */
export const materialsRoutes = new Hono<AppEnv>()
  .get('/', ...listMaterials)
  .post('/', ...createMaterial)
  .post('/bin/restore', ...restoreBin)
  .post('/bin/purge', ...purgeBin)
  .get('/levels', ...listLevels)
  .get('/:materialId', ...getMaterial)
  .patch('/:materialId', ...updateMaterial)
  .delete('/:materialId', ...deleteMaterial)
  .get('/:materialId/play', ...playMaterial)
  .post('/:materialId/restore', ...restoreMaterial)
  .post('/:materialId/copy', ...copyMaterial)
  .post('/:materialId/ai-draft', ...replaceMaterialWithAiDraft)
  .post('/:materialId/steps', ...addStep)
  .post('/:materialId/steps/reorder', ...reorderSteps)
  .patch('/:materialId/steps/:stepId', ...updateStep)
  .delete('/:materialId/steps/:stepId', ...deleteStep)
  .post('/:materialId/steps/:stepId/check', bodyLimit({ maxSize: CHECK_BODY_BYTES }), ...checkStep)
