import type { ModelOverlayMap } from '../../schema/catalog'

const MINIMAX_M3_LIMIT = {
  context: 1_000_000,
  output: 524_288,
}

export const MODEL_OVERLAYS: ModelOverlayMap = {
  'minimax/MiniMax-M3': {
    limit: MINIMAX_M3_LIMIT,
  },
  'minimax/MiniMax-M3.1-Flash': {
    limit: MINIMAX_M3_LIMIT,
  },
}
