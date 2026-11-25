import type { ModelFactsPatch, ProviderOverlay } from '../../schema/catalog'
import type { PricingPriceTier, UnitPrices } from '../../schema/pricing'
import { withFlatPricing, withHalfPriceIdle } from '../../schedules/helpers'
import { FLAT_USD, QIANWEN_OFF_PEAK_USD } from '../../schedules/templates'

const ZERO_CASH_COST = {
  input: 0,
  output: 0,
  cache_read: 0,
  cache_write: 0,
} as const

const round6 = (value: number): number => Number(value.toPrecision(6))

const flatUsd = (prices: UnitPrices) => withFlatPricing(FLAT_USD, prices)

const flatUsdImplicit = (
  input: number,
  output: number,
  cacheRatio = 0.2,
  tiers?: ReadonlyArray<{ inputTokensAbove: number; input: number; output: number }>,
) =>
  flatUsd({
    input,
    output,
    cacheRead: round6(input * cacheRatio),
    cacheWrite: null,
    ...(tiers?.length
      ? {
          tiers: tiers.map(
            (tier): PricingPriceTier => ({
              inputTokensAbove: tier.inputTokensAbove,
              input: tier.input,
              output: tier.output,
              cacheRead: round6(tier.input * cacheRatio),
              cacheWrite: null,
            }),
          ),
        }
      : {}),
  })

const flatUsdUnknownCache = (input: number, output: number) =>
  flatUsd({
    input,
    output,
    cacheRead: null,
    cacheWrite: null,
  })

const QWEN38_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'effort' as const, values: ['low', 'medium', 'xhigh'] },
  { type: 'budget_tokens' as const, min: 0, max: 262_144 },
]

const QWEN37_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'budget_tokens' as const, min: 0, max: 262_144 },
]

const QWEN36_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'budget_tokens' as const, min: 0, max: 81_920 },
]

const DEEPSEEK_V41_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'effort' as const, values: ['low', 'high', 'max'] },
]

const DEEPSEEK_V4_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'effort' as const, values: ['high', 'max'] },
]

const GLM5_REASONING_OPTIONS = [{ type: 'effort' as const, values: ['low', 'high', 'max'] }]

const INTERLEAVED_REASONING = { field: 'reasoning_content' } as const

const BASE_FACTS: Readonly<Record<string, Omit<ModelFactsPatch, 'pricing' | 'cost'>>> = {
  'qwen4-max': {
    canonical_model_id: 'alibaba/qwen4-max',
  },
  'qwen3.8-max': {
    canonical_model_id: 'alibaba/qwen3.8-max',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: QWEN38_REASONING_OPTIONS,
  },
  'qwen3.8-max-0902': {
    canonical_model_id: 'alibaba/qwen3.8-max-0902',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: QWEN38_REASONING_OPTIONS,
  },
  'qwen3.8-flash': {
    canonical_model_id: 'alibaba/qwen3.8-flash',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: QWEN38_REASONING_OPTIONS,
  },
  'qwen3.8-omni-flash': {
    canonical_model_id: 'alibaba/qwen3.8-omni-flash',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'xhigh'] }],
  },
  'qwen3.8-2.4t-a95b': {
    canonical_model_id: 'alibaba/qwen3.8-2.4t-a95b',
  },
  'qwen3.8-27b': {
    canonical_model_id: 'alibaba/qwen3.8-27b',
  },
  'qwen3.7-max': {
    canonical_model_id: 'alibaba/qwen3.7-max',
    reasoning_options: QWEN37_REASONING_OPTIONS,
  },
  'qwen3.7-plus': {
    canonical_model_id: 'alibaba/qwen3.7-plus',
    reasoning_options: QWEN37_REASONING_OPTIONS,
  },
  'qwen3.7-flash': {
    canonical_model_id: 'alibaba/qwen3.7-flash',
    reasoning_options: QWEN37_REASONING_OPTIONS,
  },
  'qwen3.6-plus': {
    canonical_model_id: 'alibaba/qwen3.6-plus',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.6-flash': {
    canonical_model_id: 'alibaba/qwen3.6-flash',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.6-35b-a3b': {
    canonical_model_id: 'alibaba/qwen3.6-35b-a3b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.6-27b': {
    canonical_model_id: 'alibaba/qwen3.6-27b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-plus': {
    canonical_model_id: 'alibaba/qwen3.5-plus',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-flash': {
    canonical_model_id: 'alibaba/qwen3.5-flash',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-397b-a17b': {
    canonical_model_id: 'alibaba/qwen3.5-397b-a17b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-122b-a10b': {
    canonical_model_id: 'alibaba/qwen3.5-122b-a10b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-35b-a3b': {
    canonical_model_id: 'alibaba/qwen3.5-35b-a3b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3.5-27b': {
    canonical_model_id: 'alibaba/qwen3.5-27b',
    reasoning_options: QWEN36_REASONING_OPTIONS,
  },
  'qwen3-vl-plus': {
    canonical_model_id: 'alibaba/qwen3-vl-plus',
  },
  'qwen3-coder-flash': {
    canonical_model_id: 'alibaba/qwen3-coder-flash',
  },
  'deepseek-v4.1-flash': {
    canonical_model_id: 'deepseek/deepseek-v4.1-flash',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: DEEPSEEK_V41_REASONING_OPTIONS,
  },
  'deepseek-v4.1-flash-1017': {
    canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: DEEPSEEK_V41_REASONING_OPTIONS,
  },
  'deepseek-v4-pro': {
    canonical_model_id: 'deepseek/deepseek-v4-pro',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: DEEPSEEK_V4_REASONING_OPTIONS,
  },
  'deepseek-v4-pro-0813': {
    canonical_model_id: 'deepseek/deepseek-v4-pro-0813',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: DEEPSEEK_V4_REASONING_OPTIONS,
  },
  'deepseek-v4-flash-0731': {
    canonical_model_id: 'deepseek/deepseek-v4-flash-0731',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: DEEPSEEK_V4_REASONING_OPTIONS,
  },
  'kimi-k3.1-pro': {
    canonical_model_id: 'moonshotai/kimi-k3.1-pro',
  },
  'kimi-k3': {
    canonical_model_id: 'moonshotai/kimi-k3',
  },
  'kimi-k2.7-code': {
    canonical_model_id: 'moonshotai/kimi-k2.7-code',
  },
  'kimi-k2.6': {
    canonical_model_id: 'moonshotai/kimi-k2.6',
  },
  'kimi-k2.5': {
    canonical_model_id: 'moonshotai/kimi-k2.5',
  },
  'glm-5.3': {
    canonical_model_id: 'zhipuai/glm-5.3',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'glm-5.3-prime': {
    canonical_model_id: 'z-ai/glm-5.3-prime',
    name: 'GLM-5.3 Prime',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'glm-5.2': {
    canonical_model_id: 'zhipuai/glm-5.2',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'glm-5.2-fast-preview': {
    canonical_model_id: 'zhipuai/glm-5.2',
    name: 'GLM-5.2 Fast Preview',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'glm-5.1': {
    canonical_model_id: 'zhipuai/glm-5.1',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'glm-5': {
    canonical_model_id: 'zhipuai/glm-5',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'ZHIPU/GLM-5.3': {
    canonical_model_id: 'zhipuai/glm-5.3',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'ZHIPU/GLM-5.2': {
    canonical_model_id: 'zhipuai/glm-5.2',
    interleaved: INTERLEAVED_REASONING,
    reasoning_options: GLM5_REASONING_OPTIONS,
  },
  'MiniMax-M2.5': {
    canonical_model_id: 'minimax/MiniMax-M2.5',
  },
  'mindlab/macaron-v1-tall': {
    name: 'Macaron V1 Tall',
    limit: { context: 131_072, output: 32_768 },
    modalities: { input: ['text'], output: ['text'] },
    reasoning: true,
    tool_call: true,
  },
  'mindlab/macaron-v1.1-venti': {
    name: 'Macaron V1.1 Venti',
    limit: { context: 131_072, output: 32_768 },
    modalities: { input: ['text'], output: ['text'] },
    reasoning: true,
    tool_call: true,
  },
  'mindlab/macaron-v1.1-coding-venti': {
    name: 'Macaron V1.1 Coding Venti',
    limit: { context: 131_072, output: 32_768 },
    modalities: { input: ['text'], output: ['text'] },
    reasoning: true,
    tool_call: true,
  },
  'mindlab/macaron-v1.1-venti-pro': {
    name: 'Macaron V1.1 Venti Pro',
    limit: { context: 131_072, output: 32_768 },
    modalities: { input: ['text', 'image'], output: ['text'] },
    reasoning: true,
    tool_call: true,
  },
}

function modelWithPricing(
  modelId: keyof typeof BASE_FACTS,
  pricing: NonNullable<ModelFactsPatch['pricing']>,
): ModelFactsPatch {
  return {
    ...BASE_FACTS[modelId],
    pricing,
  }
}

/**
 * Shared Global-scope (China mainland / Global deployment) USD pricing table used by
 * Beijing, US Virginia (Global), Frankfurt (Global), Hong Kong (Global), and Tokyo (Global).
 */
const GLOBAL_SCOPE_MODELS: Readonly<Record<string, ModelFactsPatch>> = {
  'qwen4-max': modelWithPricing(
    'qwen4-max',
    flatUsd({
      input: 1.413,
      output: 4.24,
      cacheRead: 0.071,
      cacheWrite: 1.767,
      cacheWriteByTtl: { '5m': 1.767, '1h': 2.827 },
    }),
  ),
  'qwen3.8-max': modelWithPricing('qwen3.8-max', flatUsdUnknownCache(1.65, 4.951)),
  'qwen3.8-max-0902': modelWithPricing('qwen3.8-max-0902', flatUsdUnknownCache(1.65, 4.951)),
  'qwen3.8-flash': modelWithPricing('qwen3.8-flash', flatUsdUnknownCache(0.113, 0.382)),
  'qwen3.8-omni-flash': modelWithPricing(
    'qwen3.8-omni-flash',
    flatUsd({ input: 0.113, output: 0.382, cacheRead: 0.014, cacheWrite: null }),
  ),
  'qwen3.8-2.4t-a95b': modelWithPricing('qwen3.8-2.4t-a95b', flatUsdUnknownCache(1.65, 4.951)),
  'qwen3.8-27b': modelWithPricing('qwen3.8-27b', flatUsdImplicit(0.424, 1.696)),
  'qwen3.7-max': modelWithPricing('qwen3.7-max', flatUsdImplicit(1.65, 4.951)),
  'qwen3.7-plus': modelWithPricing(
    'qwen3.7-plus',
    flatUsdImplicit(0.276, 1.101, 0.2, [{ inputTokensAbove: 256_000, input: 0.826, output: 3.301 }]),
  ),
  'qwen3.7-flash': modelWithPricing(
    'qwen3.7-flash',
    flatUsdImplicit(0.028, 0.11, 0.2, [
      { inputTokensAbove: 32_000, input: 0.083, output: 0.33 },
      { inputTokensAbove: 256_000, input: 0.165, output: 0.66 },
    ]),
  ),
  'qwen3.6-plus': modelWithPricing(
    'qwen3.6-plus',
    flatUsdImplicit(0.276, 1.651, 0.2, [{ inputTokensAbove: 256_000, input: 1.101, output: 6.602 }]),
  ),
  'qwen3.6-flash': modelWithPricing(
    'qwen3.6-flash',
    flatUsdImplicit(0.165, 0.99, 0.2, [{ inputTokensAbove: 256_000, input: 0.66, output: 3.961 }]),
  ),
  'qwen3.6-35b-a3b': modelWithPricing('qwen3.6-35b-a3b', flatUsdImplicit(0.248, 1.485)),
  'qwen3.6-27b': modelWithPricing('qwen3.6-27b', flatUsdImplicit(0.412564, 2.475384)),
  'qwen3.5-plus': modelWithPricing(
    'qwen3.5-plus',
    flatUsdImplicit(0.115, 0.688, 0.2, [
      { inputTokensAbove: 128_000, input: 0.287, output: 1.72 },
      { inputTokensAbove: 256_000, input: 0.573, output: 3.44 },
    ]),
  ),
  'qwen3.5-flash': modelWithPricing(
    'qwen3.5-flash',
    flatUsdImplicit(0.029, 0.287, 0.2, [
      { inputTokensAbove: 128_000, input: 0.115, output: 1.147 },
      { inputTokensAbove: 256_000, input: 0.172, output: 1.72 },
    ]),
  ),
  'qwen3.5-397b-a17b': modelWithPricing(
    'qwen3.5-397b-a17b',
    flatUsdImplicit(0.172, 1.032, 0.2, [{ inputTokensAbove: 128_000, input: 0.43, output: 2.58 }]),
  ),
  'qwen3.5-122b-a10b': modelWithPricing(
    'qwen3.5-122b-a10b',
    flatUsdImplicit(0.115, 0.917, 0.2, [{ inputTokensAbove: 128_000, input: 0.287, output: 2.294 }]),
  ),
  'qwen3.5-35b-a3b': modelWithPricing(
    'qwen3.5-35b-a3b',
    flatUsdImplicit(0.057, 0.459, 0.2, [{ inputTokensAbove: 128_000, input: 0.229, output: 1.835 }]),
  ),
  'qwen3.5-27b': modelWithPricing(
    'qwen3.5-27b',
    flatUsdImplicit(0.086, 0.688, 0.2, [{ inputTokensAbove: 128_000, input: 0.258, output: 2.064 }]),
  ),
  'qwen3-vl-plus': modelWithPricing(
    'qwen3-vl-plus',
    flatUsdImplicit(0.143, 1.434, 0.2, [
      { inputTokensAbove: 32_000, input: 0.215, output: 2.15 },
      { inputTokensAbove: 128_000, input: 0.43, output: 4.301 },
    ]),
  ),
  'qwen3-coder-flash': modelWithPricing(
    'qwen3-coder-flash',
    flatUsdImplicit(0.144, 0.574, 0.2, [
      { inputTokensAbove: 32_000, input: 0.216, output: 0.861 },
      { inputTokensAbove: 128_000, input: 0.359, output: 1.434 },
      { inputTokensAbove: 256_000, input: 0.717, output: 3.584 },
    ]),
  ),
  'deepseek-v4.1-flash': modelWithPricing(
    'deepseek-v4.1-flash',
    withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
      input: 0.283,
      output: 1.131,
      cacheRead: 0.006,
      cacheWrite: null,
    }),
  ),
  'deepseek-v4.1-flash-1017': modelWithPricing(
    'deepseek-v4.1-flash-1017',
    withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
      input: 0.283,
      output: 1.131,
      cacheRead: 0.006,
      cacheWrite: null,
    }),
  ),
  'deepseek-v4-pro': modelWithPricing('deepseek-v4-pro', flatUsdUnknownCache(1.65, 3.301)),
  'deepseek-v4-pro-0813': modelWithPricing(
    'deepseek-v4-pro-0813',
    withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
      input: 1.272,
      output: 3.816,
      cacheRead: 0.1272,
      cacheWrite: null,
    }),
  ),
  'deepseek-v4-flash-0731': modelWithPricing(
    'deepseek-v4-flash-0731',
    withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
      input: 0.424,
      output: 1.272,
      cacheRead: 0.0424,
      cacheWrite: null,
    }),
  ),
  'kimi-k3.1-pro': modelWithPricing(
    'kimi-k3.1-pro',
    flatUsd({ input: 1.837, output: 9.611, cacheRead: 0.184, cacheWrite: null }),
  ),
  'kimi-k3': modelWithPricing('kimi-k3', flatUsdImplicit(2.827, 14.133)),
  'kimi-k2.7-code': modelWithPricing('kimi-k2.7-code', flatUsdImplicit(0.894, 3.713)),
  'kimi-k2.6': modelWithPricing('kimi-k2.6', flatUsdImplicit(0.8939, 3.7131)),
  'kimi-k2.5': modelWithPricing('kimi-k2.5', flatUsdImplicit(0.574, 3.011)),
  'glm-5.3': modelWithPricing('glm-5.3', flatUsdImplicit(1.131, 3.957)),
  'glm-5.2': modelWithPricing('glm-5.2', flatUsdImplicit(1.1, 3.851)),
  'glm-5.2-fast-preview': modelWithPricing('glm-5.2-fast-preview', flatUsdImplicit(2.2, 7.702)),
  'glm-5.1': modelWithPricing(
    'glm-5.1',
    flatUsdImplicit(0.825, 3.301, 0.1857, [{ inputTokensAbove: 32_000, input: 1.1, output: 3.851 }]),
  ),
  'glm-5': modelWithPricing(
    'glm-5',
    flatUsdImplicit(0.573, 2.58, 0.2, [{ inputTokensAbove: 32_000, input: 0.86, output: 3.154 }]),
  ),
  'MiniMax-M2.5': modelWithPricing('MiniMax-M2.5', flatUsdImplicit(0.304, 1.213)),
}

const pickGlobalModels = (
  ids: readonly (keyof typeof GLOBAL_SCOPE_MODELS)[],
  overrides?: Readonly<Record<string, ModelFactsPatch>>,
): Record<string, ModelFactsPatch> => {
  const out: Record<string, ModelFactsPatch> = {}
  for (const id of ids) {
    out[id] = overrides?.[id] ?? GLOBAL_SCOPE_MODELS[id]!
  }
  return out
}

const regionProtocolEndpoints = (regionCode: string) => ({
  'openai-completions': `https://${regionCode}.maas.qwencloudapi.com/compatible-mode/v1`,
  'openai-responses': `https://${regionCode}.maas.qwencloudapi.com/compatible-mode/v1`,
  'anthropic-messages': `https://${regionCode}.maas.qwencloudapi.com/apps/anthropic`,
})

function makeRegionOverlay(params: {
  providerId: string
  name: string
  regionCode: string
  endpoints?: readonly string[]
  models: Readonly<Record<string, ModelFactsPatch>>
}): ProviderOverlay {
  const api = `https://${params.regionCode}.maas.qwencloudapi.com/compatible-mode/v1`
  return {
    providerId: params.providerId,
    name: params.name,
    api,
    ...(params.endpoints?.length ? { endpoints: params.endpoints } : {}),
    protocolEndpoints: regionProtocolEndpoints(params.regionCode),
    env: ['DASHSCOPE_API_KEY'],
    npm: '@ai-sdk/openai-compatible',
    models: params.models,
  }
}

/**
 * QwenCloud Singapore (ap-southeast-1) — International deployment scope, USD billing.
 * Sources:
 * - https://docs.qwencloud.com/developer-guides/getting-started/regions.md
 * - https://docs.qwencloud.com/developer-guides/getting-started/model-prices.md
 * - https://www.qwencloud.com/models?region=ap-southeast-1
 */
export const qwencloudSingaporeOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-singapore',
  name: 'QwenCloud (Singapore)',
  regionCode: 'ap-southeast-1',
  endpoints: [
    'https://maas.qwencloudapi.com/compatible-mode/v1',
    'https://maas.qwencloudapi.com/apps/anthropic',
  ],
  models: {
    'qwen4-max': modelWithPricing(
      'qwen4-max',
      flatUsd({
        input: 1.5,
        output: 4.5,
        cacheRead: 0.075,
        cacheWrite: 1.875,
        cacheWriteByTtl: { '5m': 1.875, '1h': 3 },
      }),
    ),
    'qwen3.8-max': modelWithPricing('qwen3.8-max', flatUsdUnknownCache(2, 6)),
    'qwen3.8-max-0902': modelWithPricing('qwen3.8-max-0902', flatUsdUnknownCache(2, 6)),
    'qwen3.8-flash': modelWithPricing('qwen3.8-flash', flatUsdUnknownCache(0.15, 0.47)),
    'qwen3.8-omni-flash': modelWithPricing(
      'qwen3.8-omni-flash',
      flatUsd({ input: 0.15, output: 0.47, cacheRead: 0.016, cacheWrite: null }),
    ),
    'qwen3.8-2.4t-a95b': modelWithPricing('qwen3.8-2.4t-a95b', flatUsdUnknownCache(2, 6)),
    'qwen3.8-27b': modelWithPricing('qwen3.8-27b', flatUsdImplicit(0.5, 3)),
    'qwen3.7-max': modelWithPricing('qwen3.7-max', flatUsdImplicit(2.5, 7.5)),
    'qwen3.7-plus': modelWithPricing(
      'qwen3.7-plus',
      flatUsdImplicit(0.4, 1.6, 0.2, [{ inputTokensAbove: 256_000, input: 1.2, output: 4.8 }]),
    ),
    'qwen3.7-flash': modelWithPricing(
      'qwen3.7-flash',
      flatUsdImplicit(0.03, 0.13, 0.2, [
        { inputTokensAbove: 32_000, input: 0.1, output: 0.4 },
        { inputTokensAbove: 256_000, input: 0.2, output: 0.8 },
      ]),
    ),
    'qwen3.6-plus': modelWithPricing(
      'qwen3.6-plus',
      flatUsdImplicit(0.5, 3, 0.2, [{ inputTokensAbove: 256_000, input: 2, output: 6 }]),
    ),
    'qwen3.6-flash': modelWithPricing(
      'qwen3.6-flash',
      flatUsdImplicit(0.25, 1.5, 0.2, [{ inputTokensAbove: 256_000, input: 1, output: 4 }]),
    ),
    'qwen3.6-35b-a3b': modelWithPricing('qwen3.6-35b-a3b', flatUsdImplicit(0.375, 2.25)),
    'qwen3.6-27b': modelWithPricing('qwen3.6-27b', flatUsdImplicit(0.6, 3.6)),
    'qwen3.5-plus': modelWithPricing(
      'qwen3.5-plus',
      flatUsdImplicit(0.4, 2.4, 0.2, [{ inputTokensAbove: 256_000, input: 0.5, output: 3 }]),
    ),
    'qwen3.5-flash': modelWithPricing('qwen3.5-flash', flatUsdImplicit(0.1, 0.4)),
    'qwen3.5-397b-a17b': modelWithPricing('qwen3.5-397b-a17b', flatUsdImplicit(0.6, 3.6)),
    'qwen3.5-122b-a10b': modelWithPricing('qwen3.5-122b-a10b', flatUsdImplicit(0.4, 3.2)),
    'qwen3.5-35b-a3b': modelWithPricing('qwen3.5-35b-a3b', flatUsdImplicit(0.25, 2)),
    'qwen3.5-27b': modelWithPricing('qwen3.5-27b', flatUsdImplicit(0.3, 2.4)),
    'qwen3-vl-plus': modelWithPricing(
      'qwen3-vl-plus',
      flatUsdImplicit(0.2, 1.6, 0.2, [
        { inputTokensAbove: 32_000, input: 0.3, output: 2.4 },
        { inputTokensAbove: 128_000, input: 0.6, output: 4.8 },
      ]),
    ),
    'qwen3-coder-flash': modelWithPricing(
      'qwen3-coder-flash',
      flatUsdImplicit(0.3, 1.5, 0.2, [
        { inputTokensAbove: 32_000, input: 0.5, output: 2.5 },
        { inputTokensAbove: 128_000, input: 0.8, output: 4 },
        { inputTokensAbove: 256_000, input: 1.6, output: 9.6 },
      ]),
    ),
    'deepseek-v4.1-flash': modelWithPricing(
      'deepseek-v4.1-flash',
      withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: null,
      }),
    ),
    'deepseek-v4.1-flash-1017': modelWithPricing(
      'deepseek-v4.1-flash-1017',
      withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
        input: 0.3,
        output: 1.2,
        cacheRead: 0.006,
        cacheWrite: null,
      }),
    ),
    'deepseek-v4-pro': modelWithPricing('deepseek-v4-pro', flatUsdUnknownCache(2.4, 4.8)),
    'deepseek-v4-pro-0813': modelWithPricing(
      'deepseek-v4-pro-0813',
      withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
        input: 1.32,
        output: 3.96,
        cacheRead: 0.132,
        cacheWrite: null,
      }),
    ),
    'deepseek-v4-flash-0731': modelWithPricing(
      'deepseek-v4-flash-0731',
      withHalfPriceIdle(QIANWEN_OFF_PEAK_USD, {
        input: 0.44,
        output: 1.32,
        cacheRead: 0.044,
        cacheWrite: null,
      }),
    ),
    'kimi-k3.1-pro': modelWithPricing(
      'kimi-k3.1-pro',
      flatUsd({ input: 2, output: 10, cacheRead: 0.2, cacheWrite: null }),
    ),
    'kimi-k3': modelWithPricing('kimi-k3', flatUsdImplicit(3, 15)),
    'kimi-k2.7-code': modelWithPricing('kimi-k2.7-code', flatUsdImplicit(0.95, 4)),
    'glm-5.3': modelWithPricing('glm-5.3', flatUsdImplicit(1.4, 4.4)),
    'glm-5.3-prime': modelWithPricing('glm-5.3-prime', flatUsdImplicit(2.8, 8.8)),
    'glm-5.2': modelWithPricing('glm-5.2', flatUsdImplicit(1.4, 4.4)),
    'glm-5.2-fast-preview': modelWithPricing('glm-5.2-fast-preview', flatUsdImplicit(2.8, 8.8)),
    'glm-5.1': modelWithPricing('glm-5.1', flatUsdImplicit(1.4, 4.4, 0.1857)),
    'ZHIPU/GLM-5.3': modelWithPricing('ZHIPU/GLM-5.3', flatUsdImplicit(1.4, 4.4)),
    'ZHIPU/GLM-5.2': modelWithPricing('ZHIPU/GLM-5.2', flatUsdImplicit(1.4, 4.4)),
    'mindlab/macaron-v1-tall': modelWithPricing(
      'mindlab/macaron-v1-tall',
      flatUsdUnknownCache(0.45, 2.6),
    ),
    'mindlab/macaron-v1.1-venti': modelWithPricing(
      'mindlab/macaron-v1.1-venti',
      flatUsdUnknownCache(1.19, 3.74),
    ),
    'mindlab/macaron-v1.1-coding-venti': modelWithPricing(
      'mindlab/macaron-v1.1-coding-venti',
      flatUsdUnknownCache(1.19, 3.74),
    ),
    'mindlab/macaron-v1.1-venti-pro': modelWithPricing(
      'mindlab/macaron-v1.1-venti-pro',
      flatUsdUnknownCache(2, 10),
    ),
  },
})

/** QwenCloud China North 2 (Beijing, cn-beijing) — USD billing. */
export const qwencloudBeijingOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-beijing',
  name: 'QwenCloud (Beijing)',
  regionCode: 'cn-beijing',
  models: pickGlobalModels([
    'qwen4-max',
    'qwen3.8-max',
    'qwen3.8-max-0902',
    'qwen3.8-flash',
    'qwen3.8-omni-flash',
    'qwen3.8-2.4t-a95b',
    'qwen3.8-27b',
    'qwen3.7-max',
    'qwen3.7-plus',
    'qwen3.7-flash',
    'qwen3.6-plus',
    'qwen3.6-flash',
    'qwen3.6-35b-a3b',
    'qwen3.6-27b',
    'qwen3.5-plus',
    'qwen3.5-flash',
    'qwen3.5-397b-a17b',
    'qwen3.5-122b-a10b',
    'qwen3.5-35b-a3b',
    'qwen3.5-27b',
    'qwen3-vl-plus',
    'qwen3-coder-flash',
    'deepseek-v4.1-flash',
    'deepseek-v4.1-flash-1017',
    'deepseek-v4-pro',
    'deepseek-v4-pro-0813',
    'deepseek-v4-flash-0731',
    'kimi-k3.1-pro',
    'kimi-k3',
    'kimi-k2.7-code',
    'kimi-k2.6',
    'kimi-k2.5',
    'glm-5.3',
    'glm-5.2',
    'glm-5.2-fast-preview',
    'glm-5.1',
    'glm-5',
    'MiniMax-M2.5',
  ]),
})

const GLOBAL_US_DE_MODEL_IDS = [
  'qwen4-max',
  'qwen3.8-max',
  'qwen3.8-max-0902',
  'qwen3.8-flash',
  'qwen3.8-omni-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.7-flash',
  'qwen3.6-plus',
  'qwen3.6-flash',
  'qwen3.6-35b-a3b',
  'qwen3.5-plus',
  'qwen3.5-flash',
  'qwen3.5-397b-a17b',
  'qwen3.5-122b-a10b',
  'qwen3.5-35b-a3b',
  'qwen3.5-27b',
  'qwen3-vl-plus',
  'qwen3-coder-flash',
  'deepseek-v4.1-flash',
  'deepseek-v4.1-flash-1017',
  'deepseek-v4-pro',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  'kimi-k3.1-pro',
  'kimi-k3',
  'kimi-k2.7-code',
  'kimi-k2.5',
  'glm-5.3',
  'glm-5.2',
  'glm-5.1',
] as const

/** QwenCloud US (Virginia, us-east-1) — default Global deployment scope, USD billing. */
export const qwencloudVirginiaOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-virginia',
  name: 'QwenCloud (US Virginia)',
  regionCode: 'us-east-1',
  models: pickGlobalModels(GLOBAL_US_DE_MODEL_IDS),
})

/** QwenCloud Germany (Frankfurt, eu-central-1) — default Global deployment scope, USD billing. */
export const qwencloudFrankfurtOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-frankfurt',
  name: 'QwenCloud (Frankfurt)',
  regionCode: 'eu-central-1',
  models: pickGlobalModels(GLOBAL_US_DE_MODEL_IDS),
})

/** QwenCloud China (Hong Kong, cn-hongkong) — default Global deployment scope, USD billing. */
export const qwencloudHongkongOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-hongkong',
  name: 'QwenCloud (Hong Kong)',
  regionCode: 'cn-hongkong',
  models: pickGlobalModels([
    'qwen4-max',
    'qwen3.8-max',
    'qwen3.8-max-0902',
    'qwen3.8-flash',
    'qwen3.8-omni-flash',
    'qwen3.7-max',
    'qwen3.7-plus',
    'qwen3.7-flash',
    'qwen3.6-plus',
    'qwen3.6-flash',
    'deepseek-v4.1-flash',
    'deepseek-v4.1-flash-1017',
    'deepseek-v4-pro-0813',
    'deepseek-v4-flash-0731',
    'kimi-k3.1-pro',
    'kimi-k3',
    'kimi-k2.7-code',
    'glm-5.3',
    'glm-5.2',
  ]),
})

/** QwenCloud Japan (Tokyo, ap-northeast-1) — default Global deployment scope, USD billing. */
export const qwencloudTokyoOverlay: ProviderOverlay = makeRegionOverlay({
  providerId: 'qwencloud-tokyo',
  name: 'QwenCloud (Tokyo)',
  regionCode: 'ap-northeast-1',
  models: pickGlobalModels(
    [
      'qwen4-max',
      'qwen3.8-max',
      'qwen3.8-max-0902',
      'qwen3.8-flash',
      'qwen3.8-omni-flash',
      'qwen3.7-max',
      'qwen3.7-plus',
      'qwen3.7-flash',
      'qwen3.6-plus',
      'qwen3.6-flash',
      'deepseek-v4.1-flash',
      'deepseek-v4.1-flash-1017',
      'deepseek-v4-pro',
      'deepseek-v4-pro-0813',
      'deepseek-v4-flash-0731',
      'kimi-k3.1-pro',
      'kimi-k3',
      'kimi-k2.7-code',
      'kimi-k2.5',
      'glm-5.3',
      'glm-5.1',
    ],
    {
      // Tokyo Global scope lists distinct input tariffs for qwen3.6-plus ($0.5/$1.651 and $2/$6.602).
      'qwen3.6-plus': modelWithPricing(
        'qwen3.6-plus',
        flatUsdImplicit(0.5, 1.651, 0.2, [{ inputTokensAbove: 256_000, input: 2, output: 6.602 }]),
      ),
    },
  ),
})

const TOKEN_PLAN_OPENAI_URL = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1'
const TOKEN_PLAN_ANTHROPIC_URL = 'https://token-plan.maas.qwencloudapi.com/apps/anthropic'

const tokenPlanModel = (patch: ModelFactsPatch = {}): ModelFactsPatch => ({
  ...patch,
  base_url: TOKEN_PLAN_OPENAI_URL,
  cost: ZERO_CASH_COST,
})

/**
 * QwenCloud Token Plan (Singapore) — subscription endpoint & zero marginal cash-cost isolation.
 * Overlays Pi's built-in `qwen-token-plan` provider, migrating primary endpoints from legacy
 * `token-plan.ap-southeast-1.maas.aliyuncs.com` (retained as alias) to `token-plan.maas.qwencloudapi.com`.
 * Sources:
 * - https://docs.qwencloud.com/token-plan/overview.md
 * - https://docs.qwencloud.com/token-plan/token-plan-usage-quota.md
 */
export const qwenTokenPlanOverlay: ProviderOverlay = {
  providerId: 'qwen-token-plan',
  name: 'QwenCloud Token Plan (Singapore)',
  api: TOKEN_PLAN_OPENAI_URL,
  endpoints: ['https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'],
  protocolEndpoints: {
    'openai-completions': TOKEN_PLAN_OPENAI_URL,
    'openai-responses': TOKEN_PLAN_OPENAI_URL,
    'anthropic-messages': TOKEN_PLAN_ANTHROPIC_URL,
  },
  models: {
    auto: tokenPlanModel({ name: 'Auto' }),
    'qwen4-max': tokenPlanModel({ canonical_model_id: 'alibaba/qwen4-max' }),
    'qwen4-max-preview': tokenPlanModel({
      canonical_model_id: 'alibaba/qwen4-max',
      name: 'Qwen4 Max Preview',
      aliases: ['qwen4.0-max-preview'],
    }),
    'qwen3.8-max': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.8-max' }),
    'qwen3.8-flash': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.8-flash' }),
    'qwen3.7-max': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.7-max' }),
    'qwen3.7-plus': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.7-plus' }),
    'qwen3.6-plus': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.6-plus' }),
    'qwen3.6-flash': tokenPlanModel({ canonical_model_id: 'alibaba/qwen3.6-flash' }),
    'deepseek-v4.1-flash': tokenPlanModel({ canonical_model_id: 'deepseek/deepseek-v4.1-flash' }),
    'deepseek-v4.1-flash-1017': tokenPlanModel({
      canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
    }),
    'deepseek-v4-pro': tokenPlanModel({ canonical_model_id: 'deepseek/deepseek-v4-pro' }),
    'deepseek-v4-pro-0813': tokenPlanModel({ canonical_model_id: 'deepseek/deepseek-v4-pro-0813' }),
    'deepseek-v4-flash': tokenPlanModel({ canonical_model_id: 'deepseek/deepseek-v4-flash' }),
    'deepseek-v4-flash-0731': tokenPlanModel({
      canonical_model_id: 'deepseek/deepseek-v4-flash-0731',
    }),
    'deepseek-v3.2': tokenPlanModel(),
    'glm-5.3': tokenPlanModel({ canonical_model_id: 'zhipuai/glm-5.3' }),
    'glm-5.2': tokenPlanModel({ canonical_model_id: 'zhipuai/glm-5.2' }),
    'glm-5.1': tokenPlanModel({ canonical_model_id: 'zhipuai/glm-5.1' }),
    'glm-5': tokenPlanModel({ canonical_model_id: 'zhipuai/glm-5' }),
    'kimi-k2.7-code': tokenPlanModel({ canonical_model_id: 'moonshotai/kimi-k2.7-code' }),
    'kimi-k2.6': tokenPlanModel({ canonical_model_id: 'moonshotai/kimi-k2.6' }),
    'kimi-k2.5': tokenPlanModel({ canonical_model_id: 'moonshotai/kimi-k2.5' }),
    'MiniMax-M2.5': tokenPlanModel({ canonical_model_id: 'minimax/MiniMax-M2.5' }),
  },
}

export const QWENCLOUD_OVERLAYS: readonly ProviderOverlay[] = [
  qwencloudSingaporeOverlay,
  qwencloudBeijingOverlay,
  qwencloudVirginiaOverlay,
  qwencloudFrankfurtOverlay,
  qwencloudHongkongOverlay,
  qwencloudTokyoOverlay,
  qwenTokenPlanOverlay,
]
