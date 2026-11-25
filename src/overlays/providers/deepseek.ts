import type { ProviderOverlay } from '../../schema/catalog'
import { DEEPSEEK_OFF_PEAK_CN } from '../../schedules/templates'

/**
 * DeepSeek official pricing & thinking modes.
 * Sources:
 * - https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 * - https://api-docs.deepseek.com/zh-cn/guides/thinking_mode
 */
export const deepseekOverlay: ProviderOverlay = {
  providerId: 'deepseek',
  providerPricingRule: {
    kind: 'off-peak-factor',
    schedule: DEEPSEEK_OFF_PEAK_CN,
    idleFactor: 0.5,
  },
  protocolEndpoints: {
    'openai-completions': 'https://api.deepseek.com',
    'openai-responses': 'https://api.deepseek.com',
    'anthropic-messages': 'https://api.deepseek.com/anthropic',
  },
  models: {
    'deepseek-flash': {
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'max'], default: 'high' },
      ],
      busyPricing: {
        input: 2,
        output: 8,
        cacheRead: 0.04,
        cacheWrite: 0,
      },
    },
    'deepseek-v4-pro': {
      thinking_level_map: { high: 'high', low: 'low', max: 'max', medium: null, minimal: null },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'max'], default: 'high' },
      ],
      busyPricing: {
        input: 9,
        output: 27,
        cacheRead: 0.3,
        cacheWrite: 0,
      },
    },
  },
}
