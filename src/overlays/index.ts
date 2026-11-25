import type { ProviderOverlay } from '../schema/catalog'
import { MODEL_OVERLAYS } from './models'
import { deepseekOverlay } from './providers/deepseek'
import { minimaxCnOverlay, minimaxOverlay } from './providers/minimax'
import { moonshotCnOverlay, moonshotOverlay } from './providers/moonshot'
import { opencodeGoOverlay, opencodeOverlay } from './providers/opencode'
import { PROTOCOL_ENDPOINT_OVERLAYS } from './providers/protocol-endpoints'
import { qianwenCnOverlay, qwenTokenPlanCnOverlay } from './providers/qianwen'
import { QWENCLOUD_OVERLAYS } from './providers/qwencloud'
import { XIAOMI_OVERLAYS } from './providers/xiaomi'
import { ZAI_OVERLAYS } from './providers/zai'
import { zhipuaiOverlay } from './providers/zhipuai'

export { MODEL_OVERLAYS }

export const PROVIDER_OVERLAYS: readonly ProviderOverlay[] = [
  deepseekOverlay,
  minimaxCnOverlay,
  minimaxOverlay,
  moonshotCnOverlay,
  moonshotOverlay,
  opencodeOverlay,
  opencodeGoOverlay,
  qianwenCnOverlay,
  qwenTokenPlanCnOverlay,
  ...QWENCLOUD_OVERLAYS,
  ...XIAOMI_OVERLAYS,
  ...ZAI_OVERLAYS,
  zhipuaiOverlay,
  ...PROTOCOL_ENDPOINT_OVERLAYS,
]
