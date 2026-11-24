import type { ProviderOverlay } from '../schema/catalog'
import { MODEL_OVERLAYS } from './models'
import { deepseekOverlay } from './providers/deepseek'
import { minimaxCnOverlay, minimaxOverlay } from './providers/minimax'
import { moonshotCnOverlay, moonshotOverlay } from './providers/moonshot'
import { PROTOCOL_ENDPOINT_OVERLAYS } from './providers/protocol-endpoints'
import { qianwenCnOverlay, qwenTokenPlanCnOverlay } from './providers/qianwen'
import { zhipuaiOverlay } from './providers/zhipuai'

export { MODEL_OVERLAYS }

export const PROVIDER_OVERLAYS: readonly ProviderOverlay[] = [
  deepseekOverlay,
  minimaxCnOverlay,
  minimaxOverlay,
  moonshotCnOverlay,
  moonshotOverlay,
  qianwenCnOverlay,
  qwenTokenPlanCnOverlay,
  zhipuaiOverlay,
  ...PROTOCOL_ENDPOINT_OVERLAYS,
]
