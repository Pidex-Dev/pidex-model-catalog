import type { ProviderOverlay } from '../../schema/catalog'
import type { UnitPrices } from '../../schema/pricing'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_CNY } from '../../schedules/templates'

const UNKNOWN_UNIT_PRICES: UnitPrices = {
  input: null,
  output: null,
  cacheRead: null,
  cacheWrite: null,
}

/**
 * Zhipu AI (智谱开放平台) official CNY pay-as-you-go text model pricing & protocol endpoints.
 * Sources:
 * - https://docs.bigmodel.cn/cn/guide/start/pricing
 * - https://docs.bigmodel.cn/cn/guide/start/model-overview
 * - https://docs.bigmodel.cn/cn/guide/develop/openai/introduction
 * - https://docs.bigmodel.cn/cn/guide/develop/responses/introduction
 * - https://docs.bigmodel.cn/cn/guide/develop/claude/introduction
 * - https://docs.bigmodel.cn/cn/guide/capabilities/thinking
 *
 * Conventions:
 * - Pay-as-you-go API has flat CNY pricing (no off-peak discount; 50% off-peak applies only to
 *   GLM Coding Plan credits). Cache storage is currently free (0); models without context caching
 *   support record `cacheRead: null, cacheWrite: null`.
 * - Legacy models whose official tariff splits by output token length (`glm-4.7`, `glm-4.5-air`:
 *   output [0, 0.2K) vs >= 0.2K) are recorded with all-null unit prices rather than approximated
 *   or mislabelled as free (0), because PricingPriceTierSchema tiers strictly by inputTokensAbove.
 * - `GLM-5.4` is excluded until its pay-as-you-go API pricing is published (Coding Plan only).
 */
export const zhipuaiOverlay: ProviderOverlay = {
  providerId: 'zhipuai',
  name: 'Zhipu AI',
  api: 'https://open.bigmodel.cn/api/paas/v4',
  protocolEndpoints: {
    'openai-completions': 'https://open.bigmodel.cn/api/paas/v4',
    'openai-responses': 'https://open.bigmodel.cn/api/v1',
    'anthropic-messages': 'https://open.bigmodel.cn/api/anthropic',
  },
  env: ['ZHIPU_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  models: {
    'glm-5.3': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 8,
        output: 28,
        cacheRead: 2,
        cacheWrite: 0,
      }),
    },
    'glm-5.3-flash': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.8,
        output: 2.8,
        cacheRead: 0.23,
        cacheWrite: 0,
      }),
    },
    'glm-5.3-flashx': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 2,
        output: 7,
        cacheRead: 0.57,
        cacheWrite: 0,
      }),
    },
    'glm-5.3-flashx-legal': {
      name: 'GLM-5.3-FlashX-Legal',
      limit: { context: 1_000_000, output: 131_072 },
      modalities: { input: ['text', 'image', 'video', 'pdf'], output: ['text'] },
      reasoning: true,
      tool_call: true,
      structured_output: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 2,
        output: 7,
        cacheRead: 0.57,
        cacheWrite: 0,
      }),
    },
    'glm-5.2': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['high', 'max'], default: 'max' },
      ],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 8,
        output: 28,
        cacheRead: 2,
        cacheWrite: 0,
      }),
    },
    'glm-5.1': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 6,
        output: 24,
        cacheRead: 1.3,
        cacheWrite: 0,
        tiers: [
          {
            inputTokensAbove: 32_000,
            input: 8,
            output: 28,
            cacheRead: 2,
            cacheWrite: 0,
          },
        ],
      }),
    },
    'glm-5-turbo': {
      canonical_model_id: 'zhipuai/glm-5-turbo',
      name: 'GLM-5-Turbo',
      limit: { context: 200_000, output: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      reasoning: true,
      tool_call: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 5,
        output: 22,
        cacheRead: 1.2,
        cacheWrite: 0,
        tiers: [
          {
            inputTokensAbove: 32_000,
            input: 7,
            output: 26,
            cacheRead: 1.8,
            cacheWrite: 0,
          },
        ],
      }),
    },
    'glm-5': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 4,
        output: 18,
        cacheRead: 1,
        cacheWrite: 0,
        tiers: [
          {
            inputTokensAbove: 32_000,
            input: 6,
            output: 22,
            cacheRead: 1.5,
            cacheWrite: 0,
          },
        ],
      }),
    },
    // Output-length tiered ([0, 0.2K) vs >= 0.2K); left as unknown (null) per schema policy.
    'glm-4.7': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, UNKNOWN_UNIT_PRICES),
    },
    // Output-length tiered ([0, 0.2K) vs >= 0.2K); left as unknown (null) per schema policy.
    'glm-4.5-air': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, UNKNOWN_UNIT_PRICES),
    },
    'glm-4.7-flashx': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.5,
        output: 3,
        cacheRead: 0.1,
        cacheWrite: 0,
      }),
    },
    'glm-4.7-flash': {
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      }),
    },
    'glm-4-plus': {
      name: 'GLM-4-Plus',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 5,
        output: 5,
        cacheRead: 2.5,
        cacheWrite: 0,
      }),
    },
    'glm-4-air-250414': {
      name: 'GLM-4-Air-250414',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.5,
        output: 0.5,
        cacheRead: 0.25,
        cacheWrite: 0,
      }),
    },
    'glm-4-airx': {
      name: 'GLM-4-AirX',
      limit: { context: 8_192 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 10,
        output: 10,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-4-long': {
      name: 'GLM-4-Long',
      limit: { context: 1_000_000, output: 4_096 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 1,
        output: 1,
        cacheRead: 0.5,
        cacheWrite: 0,
      }),
    },
    'glm-4-assistant': {
      name: 'GLM-4-Assistant',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 5,
        output: 5,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-z1-air': {
      name: 'GLM-Z1-Air',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      reasoning: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.5,
        output: 0.5,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-z1-airx': {
      name: 'GLM-Z1-AirX',
      limit: { context: 32_768 },
      modalities: { input: ['text'], output: ['text'] },
      reasoning: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 5,
        output: 5,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-z1-flashx': {
      name: 'GLM-Z1-FlashX',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      reasoning: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.1,
        output: 0.1,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-4-flashx-250414': {
      name: 'GLM-4-FlashX-250414',
      limit: { context: 131_072, output: 16_384 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.1,
        output: 0.1,
        cacheRead: 0.05,
        cacheWrite: 0,
      }),
    },
    'glm-4-flash-250414': {
      name: 'GLM-4-Flash-250414',
      limit: { context: 131_072, output: 16_384 },
      modalities: { input: ['text'], output: ['text'] },
      tool_call: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0,
        output: 0,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'glm-z1-flash': {
      name: 'GLM-Z1-Flash',
      limit: { context: 131_072 },
      modalities: { input: ['text'], output: ['text'] },
      reasoning: true,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0,
        output: 0,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
  },
}
