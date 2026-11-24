import type { ProviderOverlay } from '../../schema/catalog'
import { withFlatPricing, withHalfPriceIdle } from '../../schedules/helpers'
import { FLAT_CNY, QIANWEN_OFF_PEAK_CN } from '../../schedules/templates'

const ZERO_CASH_COST = {
  input: 0,
  output: 0,
  cache_read: 0,
  cache_write: 0,
} as const

/**
 * Qwen AI Platform (千问AI平台) pay-as-you-go CNY pricing & model specs.
 * Sources:
 * - https://platform.qianwenai.com/pricing/api
 * - https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/other-tools
 *
 * Conventions:
 * - List prices are recorded for promotional models (e.g. qwen3.7-plus) so
 *   cost estimates stay conservative if temporary discounts end.
 * - `cacheWrite` is `null` because `/pricing/api` omits explicit cache-write
 *   tariffs: implicit-cache calls (`cacheWrite = 0`) price normally while
 *   explicit cache-write calls are safely flagged unknown.
 */
export const qianwenCnOverlay: ProviderOverlay = {
  providerId: 'qianwen-cn',
  name: 'Qwen AI (China)',
  api: 'https://maas.qianwenaiapi.com/compatible-mode/v1',
  protocolEndpoints: {
    'openai-completions': 'https://maas.qianwenaiapi.com/compatible-mode/v1',
    'openai-responses': 'https://maas.qianwenaiapi.com/compatible-mode/v1',
    'anthropic-messages': 'https://maas.qianwenaiapi.com/apps/anthropic',
  },
  env: ['DASHSCOPE_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  models: {
    'qwen4-max': {
      canonical_model_id: 'alibaba/qwen4-max',
      reasoning: true,
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
      ],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 10,
        output: 30,
        cacheRead: 0.5,
        cacheWrite: null,
      }),
    },
    'qwen3.8-max': {
      canonical_model_id: 'alibaba/qwen3.8-max',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'medium', 'xhigh'] },
        { type: 'budget_tokens', min: 0, max: 262_144 },
      ],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 12,
        output: 36,
        cacheRead: 1.5,
        cacheWrite: null,
      }),
    },
    'qwen3.8-flash': {
      canonical_model_id: 'alibaba/qwen3.8-flash',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'medium', 'xhigh'] },
        { type: 'budget_tokens', min: 0, max: 262_144 },
      ],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.8,
        output: 2.7,
        cacheRead: 0.1,
        cacheWrite: null,
      }),
    },
    'qwen3.8-2.4t-a95b': {
      canonical_model_id: 'alibaba/qwen3.8-2.4t-a95b',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 12,
        output: 36,
        cacheRead: 1.5,
        cacheWrite: null,
      }),
    },
    'qwen3.7-plus': {
      canonical_model_id: 'alibaba/qwen3.7-plus',
      reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 0, max: 262_144 }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 2,
        output: 8,
        cacheRead: 0.4,
        cacheWrite: null,
        tiers: [
          {
            inputTokensAbove: 256_000,
            input: 6,
            output: 24,
            cacheRead: 1.2,
            cacheWrite: null,
          },
        ],
      }),
    },
    'qwen3.7-max': {
      canonical_model_id: 'alibaba/qwen3.7-max',
      reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 0, max: 262_144 }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 12,
        output: 36,
        cacheRead: 2.4,
        cacheWrite: null,
      }),
    },
    'qwen3.7-flash': {
      canonical_model_id: 'alibaba/qwen3.7-flash',
      reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 0, max: 262_144 }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.2,
        output: 0.8,
        cacheRead: 0.04,
        cacheWrite: null,
        tiers: [
          {
            inputTokensAbove: 32_000,
            input: 0.6,
            output: 2.4,
            cacheRead: 0.12,
            cacheWrite: null,
          },
          {
            inputTokensAbove: 256_000,
            input: 1.2,
            output: 4.8,
            cacheRead: 0.24,
            cacheWrite: null,
          },
        ],
      }),
    },
    'qwen3.8-omni-flash': {
      canonical_model_id: 'alibaba/qwen3.8-omni-flash',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'xhigh'] }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.8,
        output: 2.7,
        cacheRead: 0.1,
        cacheWrite: null,
      }),
    },
    'ZHIPU/GLM-5.3': {
      canonical_model_id: 'zhipuai/glm-5.3',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 8,
        output: 28,
        cacheRead: 2,
        cacheWrite: null,
      }),
    },
    'ZHIPU/GLM-5.3-Flash': {
      canonical_model_id: 'zhipuai/glm-5.3-flash',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.8,
        output: 2.8,
        cacheRead: 0.23,
        cacheWrite: null,
      }),
    },
    'ZHIPU/GLM-5.3-FlashX': {
      canonical_model_id: 'zhipuai/glm-5.3-flash',
      name: 'GLM-5.3-FlashX',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 2,
        output: 7,
        cacheRead: 0.57,
        cacheWrite: null,
      }),
    },
    'deepseek-v4.1-flash': {
      canonical_model_id: 'deepseek/deepseek-v4.1-flash',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'max'] },
      ],
      pricing: withHalfPriceIdle(QIANWEN_OFF_PEAK_CN, {
        input: 2,
        output: 8,
        cacheRead: 0.04,
        cacheWrite: null,
      }),
    },
    'deepseek-v4.1-flash-1017': {
      canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'max'] },
      ],
      pricing: withHalfPriceIdle(QIANWEN_OFF_PEAK_CN, {
        input: 2,
        output: 8,
        cacheRead: 0.04,
        cacheWrite: null,
      }),
    },
    'deepseek-v4-pro-0813': {
      canonical_model_id: 'deepseek/deepseek-v4-pro-0813',
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['high', 'max'] }],
      pricing: withHalfPriceIdle(QIANWEN_OFF_PEAK_CN, {
        input: 9,
        output: 27,
        cacheRead: 0.9,
        cacheWrite: null,
      }),
    },
    'kimi/kimi-k3.1-pro': {
      canonical_model_id: 'moonshotai/kimi-k3.1-pro',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 13,
        output: 68,
        cacheRead: 1.3,
        cacheWrite: null,
      }),
    },
    'kimi/kimi-k3.1-pro-highspeed': {
      canonical_model_id: 'moonshotai/kimi-k3.1-pro',
      name: 'Kimi K3.1 Pro Highspeed',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 26,
        output: 136,
        cacheRead: 1.3,
        cacheWrite: null,
      }),
    },
    'qwen3.7-text-embedding-flash': {
      name: 'Qwen3.7 Text Embedding Flash',
      type: 'embedding',
      modalities: { input: ['text'], output: [] },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.125,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'qwen3.7-text-rerank': {
      name: 'Qwen3.7 Text Rerank',
      type: 'rerank',
      modalities: { input: ['text'], output: [] },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.5,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
    'qwen3-vl-embedding': {
      name: 'Qwen3 VL Embedding',
      type: 'embedding',
      description: 'Multimodal embedding model (text input ¥0.7/M tokens; image input ¥1.8/M tokens).',
      modalities: { input: ['text', 'image'], output: [] },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 0.7,
        output: null,
        cacheRead: null,
        cacheWrite: null,
      }),
    },
  },
}

/**
 * Qwen AI Platform Token Plan (China) endpoint & zero marginal cash-cost isolation.
 * Sources:
 * - https://platform.qianwenai.com/docs/token-plan/token-plan-usage-quota
 * - https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/other-tools
 *
 * Token Plan draws from subscription Credits rather than pay-as-you-go CNY balance,
 * and per-model Credit tariffs are not published as a static formula. Keeping cash
 * cost at 0 on Token Plan endpoints isolates subscription usage from pay-as-you-go
 * billing.
 *
 * Live model list source: DashScope `listTokenPlanModels` (zelda api) response
 * captured 2026-11-23, text-generation models (capabilities include TG). Entries
 * absent from that response were removed. `auto` and `decision-model-preview` are
 * Token-Plan-only router/domain models without a models.dev canonical entry.
 */
export const qwenTokenPlanCnOverlay: ProviderOverlay = {
  providerId: 'qwen-token-plan-cn',
  name: 'Qwen AI Token Plan (China)',
  api: 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
  protocolEndpoints: {
    'openai-completions': 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
    'openai-responses': 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
    'anthropic-messages': 'https://token-plan.maas.qianwenaiapi.com/apps/anthropic',
  },
  endpoints: ['https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'],
  models: {
    'auto': {
      name: 'Auto',
      cost: ZERO_CASH_COST,
    },
    'qwen4-max': {
      canonical_model_id: 'alibaba/qwen4-max',
      reasoning: true,
      reasoning_options: [
        { type: 'toggle' },
        { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
      ],
      cost: ZERO_CASH_COST,
    },
    'qwen4-max-preview': {
      canonical_model_id: 'alibaba/qwen4-max',
      name: 'Qwen4 Max Preview',
      aliases: ['qwen4.0-max-preview'],
      cost: ZERO_CASH_COST,
    },
    'qwen3.8-max': {
      canonical_model_id: 'alibaba/qwen3.8-max',
      cost: ZERO_CASH_COST,
    },
    'qwen3.8-flash': {
      canonical_model_id: 'alibaba/qwen3.8-flash',
      cost: ZERO_CASH_COST,
    },
    'qwen3.7-plus': {
      canonical_model_id: 'alibaba/qwen3.7-plus',
      cost: ZERO_CASH_COST,
    },
    'qwen3.7-max': {
      canonical_model_id: 'alibaba/qwen3.7-max',
      cost: ZERO_CASH_COST,
    },
    'qwen3.6-flash': {
      canonical_model_id: 'alibaba/qwen3.6-flash',
      cost: ZERO_CASH_COST,
    },
    'deepseek-v4.1-flash': {
      canonical_model_id: 'deepseek/deepseek-v4.1-flash',
      cost: ZERO_CASH_COST,
    },
    'deepseek-v4.1-flash-1017': {
      canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
      cost: ZERO_CASH_COST,
    },
    'deepseek-v4-pro': {
      canonical_model_id: 'deepseek/deepseek-v4-pro',
      cost: ZERO_CASH_COST,
    },
    'deepseek-v4-pro-0813': {
      canonical_model_id: 'deepseek/deepseek-v4-pro-0813',
      cost: ZERO_CASH_COST,
    },
    'deepseek-v4-flash-0731': {
      canonical_model_id: 'deepseek/deepseek-v4-flash-0731',
      cost: ZERO_CASH_COST,
    },
    'ZHIPU/GLM-5.3': {
      canonical_model_id: 'zhipuai/glm-5.3',
      cost: ZERO_CASH_COST,
    },
    'ZHIPU/GLM-5.2': {
      canonical_model_id: 'zhipuai/glm-5.2',
      cost: ZERO_CASH_COST,
    },
    'decision-model-preview': {
      name: 'Decision Model Preview',
      cost: ZERO_CASH_COST,
    },
  },
}
