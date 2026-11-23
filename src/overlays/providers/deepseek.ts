import type { ProviderOverlay } from '../../schema/catalog'
import { withHalfPriceIdle } from '../../schedules/helpers'
import { DEEPSEEK_OFF_PEAK_CN } from '../../schedules/templates'

/**
 * DeepSeek official pricing & thinking modes.
 * Sources:
 * - https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 * - https://api-docs.deepseek.com/zh-cn/guides/thinking_mode
 */
export const deepseekOverlay: ProviderOverlay = {
  providerId: 'deepseek',
  models: {
    'deepseek-flash': {
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'max'], default: 'high' },
      ],
      pricing: withHalfPriceIdle(DEEPSEEK_OFF_PEAK_CN, {
        input: 2,
        output: 8,
        cacheRead: 0.04,
        cacheWrite: 0,
      }),
    },
    'deepseek-v4-pro': {
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['high', 'max'], default: 'high' },
      ],
      pricing: withHalfPriceIdle(DEEPSEEK_OFF_PEAK_CN, {
        input: 9,
        output: 27,
        cacheRead: 0.3,
        cacheWrite: 0,
      }),
    },
  },
}
