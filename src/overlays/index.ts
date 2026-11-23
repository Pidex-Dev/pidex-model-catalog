import type { ProviderOverlay } from '../schema/catalog'
import { MODEL_OVERLAYS } from './models'
import { deepseekOverlay } from './providers/deepseek'
import { minimaxCnOverlay, minimaxOverlay } from './providers/minimax'
import { PROTOCOL_ENDPOINT_OVERLAYS } from './providers/protocol-endpoints'
import { qianwenCnOverlay, qwenTokenPlanCnOverlay } from './providers/qianwen'

export { MODEL_OVERLAYS }

export const PROVIDER_OVERLAYS: readonly ProviderOverlay[] = [
  deepseekOverlay,
  minimaxCnOverlay,
  minimaxOverlay,
  qianwenCnOverlay,
  qwenTokenPlanCnOverlay,
  ...PROTOCOL_ENDPOINT_OVERLAYS,
]
