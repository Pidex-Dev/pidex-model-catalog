import type { ProviderOverlay } from '../../schema/catalog'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_CNY, FLAT_USD } from '../../schedules/templates'

const MINIMAX_MULTIMODAL_MODALITIES = {
  input: ['text', 'image', 'video'],
  output: ['text'],
}

const MINIMAX_M3_LIMIT = {
  context: 1_000_000,
  output: 524_288,
}

const MINIMAX_M31_FLASH_COMPAT = {
  forceAdaptiveThinking: true,
} as const

const MINIMAX_M31_FLASH_THINKING_LEVEL_MAP = {
  off: null,
  minimal: null,
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
} as const

/**
 * MiniMax official pricing, modalities & thinking modes (CN & Global).
 * Sources:
 * - https://platform.minimax.cn/docs/pricing/overview (minimax-cn, CNY)
 * - https://platform.minimax.io/docs/pricing/overview (minimax, USD)
 * - https://platform.minimax.io/docs/api-reference/text-anthropic-api
 * - https://platform.minimax.io/docs/api-reference/text-openai-api
 *
 * Conventions:
 * - Official LLM pricing only lists MiniMax-M3.1-Flash and MiniMax-M3;
 *   the retired M2.7 series is filtered out in sync-upstream.ts.
 * - Both M3 and M3.1-Flash natively support text/image/video inputs, 1M context, 512K (524,288)
 *   max output tokens, and interleaved thinking (`reasoning_content` on OpenAI-compatible APIs).
 * - M3.1-Flash uses always-on adaptive thinking (`output_config.effort` / `reasoning_effort`:
 *   `low`/`medium`/`high`/`xhigh`/`max`, default `max`); disabling thinking returns HTTP 400.
 */
export const minimaxCnOverlay: ProviderOverlay = {
  providerId: 'minimax-cn',
  endpoints: ['https://api.minimaxi.com/v1', 'https://api.minimaxi.com/anthropic'],
  protocolEndpoints: {
    'anthropic-messages': 'https://api.minimax.cn/anthropic',
    'openai-completions': 'https://api.minimax.cn/v1',
  },
  models: {
    'MiniMax-M3.1-Flash': {
      pi_api: 'anthropic-messages',
      base_url: 'https://api.minimax.cn/anthropic',
      compat: { ...MINIMAX_M31_FLASH_COMPAT },
      thinking_level_map: { ...MINIMAX_M31_FLASH_THINKING_LEVEL_MAP },
      limit: MINIMAX_M3_LIMIT,
      modalities: MINIMAX_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'max' },
      ],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 1,
        output: 4,
        cacheRead: 0.1,
        cacheWrite: 0,
      }),
    },
    'MiniMax-M3': {
      base_url: 'https://api.minimax.cn/anthropic',
      limit: MINIMAX_M3_LIMIT,
      modalities: MINIMAX_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 2.1,
        output: 8.4,
        cacheRead: 0.42,
        cacheWrite: 0,
        tiers: [
          {
            inputTokensAbove: 512_000,
            input: 4.2,
            output: 16.8,
            cacheRead: 0.84,
            cacheWrite: 0,
          },
        ],
      }),
    },
  },
}

export const minimaxOverlay: ProviderOverlay = {
  providerId: 'minimax',
  protocolEndpoints: {
    'anthropic-messages': 'https://api.minimax.io/anthropic',
    'openai-completions': 'https://api.minimax.io/v1',
  },
  models: {
    'MiniMax-M3.1-Flash': {
      pi_api: 'anthropic-messages',
      base_url: 'https://api.minimax.io/anthropic',
      compat: { ...MINIMAX_M31_FLASH_COMPAT },
      thinking_level_map: { ...MINIMAX_M31_FLASH_THINKING_LEVEL_MAP },
      limit: MINIMAX_M3_LIMIT,
      modalities: MINIMAX_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'max' },
      ],
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.15,
        output: 0.6,
        cacheRead: 0.015,
        cacheWrite: 0,
      }),
    },
    'MiniMax-M3': {
      limit: MINIMAX_M3_LIMIT,
      modalities: MINIMAX_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.06,
        cacheWrite: 0,
        tiers: [
          {
            inputTokensAbove: 512_000,
            input: 0.6,
            output: 2.4,
            cacheRead: 0.12,
            cacheWrite: 0,
          },
        ],
      }),
    },
  },
}
