import type { ModelOverlayMap } from '../../schema/catalog'

const MINIMAX_M3_LIMIT = {
  context: 1_000_000,
  output: 524_288,
}

const INTERLEAVED_REASONING = { field: 'reasoning_content' } as const
const XIAOMI_TOGGLE_REASONING = {
  interleaved: INTERLEAVED_REASONING,
  reasoning_options: [{ type: 'toggle' as const }],
}

export const MODEL_OVERLAYS: ModelOverlayMap = {
  'minimax/MiniMax-M3': {
    limit: MINIMAX_M3_LIMIT,
  },
  'minimax/MiniMax-M3.1-Flash': {
    limit: MINIMAX_M3_LIMIT,
  },
  'xiaomi/mimo-v2.6-pro': XIAOMI_TOGGLE_REASONING,
  'xiaomi/mimo-v2.6-pro-ultraspeed': XIAOMI_TOGGLE_REASONING,
  'xiaomi/mimo-v2.6-flash': XIAOMI_TOGGLE_REASONING,
  'xiaomi/mimo-v2.5': XIAOMI_TOGGLE_REASONING,
  'xiaomi/mimo-v2.5-pro': XIAOMI_TOGGLE_REASONING,
  'xiaomi/mimo-v2.5-pro-ultraspeed': XIAOMI_TOGGLE_REASONING,
  'zhipuai/glm-5.4': {
    interleaved: INTERLEAVED_REASONING,
    structured_output: true,
    reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
  },
}
