import type { ProviderOverlay } from '../../schema/catalog'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_CNY, FLAT_USD } from '../../schedules/templates'

/**
 * MiniMax official pricing & thinking modes (CN & Global).
 * Sources:
 * - https://platform.minimax.cn/docs/pricing/overview (minimax-cn, CNY)
 * - https://platform.minimax.io/docs/pricing/overview (minimax, USD)
 *
 * Official LLM pricing only lists MiniMax-M3.1-Flash and MiniMax-M3;
 * the retired M2.7 series is filtered out in sync-upstream.ts.
 */
export const minimaxCnOverlay: ProviderOverlay = {
  providerId: 'minimax-cn',
  protocolEndpoints: {
    'anthropic-messages': 'https://api.minimaxi.com/anthropic',
    'openai-completions': 'https://api.minimax.cn/v1',
  },
  models: {
    'MiniMax-M3.1-Flash': {
      pi_api: 'anthropic-messages',
      base_url: 'https://api.minimaxi.com/anthropic',
      reasoning: true,
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
      reasoning: true,
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
      reasoning: true,
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
      reasoning: true,
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
