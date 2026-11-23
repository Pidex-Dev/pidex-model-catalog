import type { ProviderOverlay } from '../schema/catalog'
import { MODEL_OVERLAYS } from './models'
import { deepseekOverlay } from './providers/deepseek'
import { minimaxCnOverlay, minimaxOverlay } from './providers/minimax'

export { MODEL_OVERLAYS }

export const PROVIDER_OVERLAYS: readonly ProviderOverlay[] = [
  deepseekOverlay,
  minimaxCnOverlay,
  minimaxOverlay,
]
