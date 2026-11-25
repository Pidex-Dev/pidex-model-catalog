import type { ModelFactsPatch, ProviderOverlay } from '../../schema/catalog'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_CNY, FLAT_USD } from '../../schedules/templates'

const ZERO_CASH_COST = {
  input: 0,
  output: 0,
  cache_read: 0,
  cache_write: 0,
} as const

const XIAOMI_V26_LIMIT = {
  context: 1_048_576,
  output: 131_072,
}

const XIAOMI_V26_MODALITIES = {
  input: ['text', 'image', 'audio', 'video'],
  output: ['text'],
}

const XIAOMI_COMPAT = {
  requiresReasoningContentOnAssistantMessages: true,
  supportsReasoningEffort: false,
  supportsStrictMode: true,
  thinkingFormat: 'deepseek',
} as const

const XIAOMI_THINKING_LEVEL_MAP = {
  high: 'high',
  low: null,
  max: null,
  medium: null,
  minimal: null,
  off: 'off',
  xhigh: null,
} as const

const XIAOMI_REASONING_OPTIONS = [{ type: 'toggle' as const }]

/**
 * Retired MiMo-V2.5 text models (officially sunset on 2026-10-21 10:00 UTC+8 in favor of V2.6).
 * Excluded from callable provider model lists while preserved as deprecated canonical entries in
 * `v2/models.json` for smartConfig matching.
 */
export const XIAOMI_RETIRED_MODELS = [
  'mimo-v2.5',
  'mimo-v2.5-pro',
  'mimo-v2.5-pro-ultraspeed',
] as const

const v26BaseModel = (
  baseUrl: string,
  extra: ModelFactsPatch = {},
): ModelFactsPatch => ({
  pi_api: 'openai-completions',
  base_url: baseUrl,
  compat: { ...XIAOMI_COMPAT },
  thinking_level_map: { ...XIAOMI_THINKING_LEVEL_MAP },
  limit: XIAOMI_V26_LIMIT,
  modalities: XIAOMI_V26_MODALITIES,
  reasoning: true,
  tool_call: true,
  interleaved: { field: 'reasoning_content' },
  reasoning_options: XIAOMI_REASONING_OPTIONS,
  ...extra,
})

/**
 * Xiaomi MiMo Open Platform pay-as-you-go (`sk-` key) official USD pricing & protocol endpoints.
 * Sources:
 * - https://platform.xiaomimimo.com/#/docs (Pay-As-You-Go API, MiMo-V2.6 pricing & endpoints)
 *
 * Conventions:
 * - Pay-as-you-go API supports OpenAI Chat Completions (`/v1`), OpenAI Responses (`/v1/responses`),
 *   and Anthropic Messages (`/anthropic`).
 * - MiMo-V2.6 models natively accept text/image/audio/video with 1M context and 128K max output,
 *   and support toggleable thinking (`thinking.type: enabled|disabled`; Responses `reasoning.effort: none`
 *   disables thinking while any other value enables identical default reasoning).
 * - `mimo-v2.6-pro-ultraspeed` is paired as the `ultrafast` speed tier of `mimo-v2.6-pro` in V2.
 * - Cache write is limited-time free (`0`); pay-as-you-go USD tariffs are flat across context lengths.
 */
export const xiaomiOverlay: ProviderOverlay = {
  providerId: 'xiaomi',
  name: 'Xiaomi MiMo',
  api: 'https://api.xiaomimimo.com/v1',
  protocolEndpoints: {
    'openai-completions': 'https://api.xiaomimimo.com/v1',
    'openai-responses': 'https://api.xiaomimimo.com/v1',
    'anthropic-messages': 'https://api.xiaomimimo.com/anthropic',
  },
  env: ['XIAOMI_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  excludeModels: XIAOMI_RETIRED_MODELS,
  models: {
    'mimo-v2.6-pro': v26BaseModel('https://api.xiaomimimo.com/v1', {
      canonical_model_id: 'xiaomi/mimo-v2.6-pro',
      name: 'MiMo-V2.6-Pro',
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.435,
        output: 0.87,
        cacheRead: 0.0036,
        cacheWrite: 0,
      }),
    }),
    'mimo-v2.6-pro-ultraspeed': v26BaseModel('https://api.xiaomimimo.com/v1', {
      name: 'MiMo-V2.6-Pro-UltraSpeed',
      pricing: withFlatPricing(FLAT_USD, {
        input: 4.35,
        output: 8.7,
        cacheRead: 0.036,
        cacheWrite: 0,
      }),
    }),
    'mimo-v2.6-flash': v26BaseModel('https://api.xiaomimimo.com/v1', {
      canonical_model_id: 'xiaomi/mimo-v2.6-flash',
      name: 'MiMo-V2.6-Flash',
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.0028,
        cacheWrite: 0,
      }),
    }),
  },
}

/**
 * Xiaomi MiMo Open Platform pay-as-you-go (`sk-` key) official CNY pricing for China Mainland accounts.
 * Shares the same pay-as-you-go endpoints (`https://api.xiaomimimo.com/{v1,anthropic}`) as `xiaomi`,
 * billed in CNY per 1M tokens.
 */
export const xiaomiCnOverlay: ProviderOverlay = {
  providerId: 'xiaomi-cn',
  name: 'Xiaomi MiMo (China)',
  api: 'https://api.xiaomimimo.com/v1',
  protocolEndpoints: {
    'openai-completions': 'https://api.xiaomimimo.com/v1',
    'openai-responses': 'https://api.xiaomimimo.com/v1',
    'anthropic-messages': 'https://api.xiaomimimo.com/anthropic',
  },
  env: ['XIAOMI_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  excludeModels: XIAOMI_RETIRED_MODELS,
  models: {
    'mimo-v2.6-pro': v26BaseModel('https://api.xiaomimimo.com/v1', {
      canonical_model_id: 'xiaomi/mimo-v2.6-pro',
      name: 'MiMo-V2.6-Pro',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 3,
        output: 6,
        cacheRead: 0.025,
        cacheWrite: 0,
      }),
    }),
    'mimo-v2.6-pro-ultraspeed': v26BaseModel('https://api.xiaomimimo.com/v1', {
      name: 'MiMo-V2.6-Pro-UltraSpeed',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 30,
        output: 60,
        cacheRead: 0.25,
        cacheWrite: 0,
      }),
    }),
    'mimo-v2.6-flash': v26BaseModel('https://api.xiaomimimo.com/v1', {
      canonical_model_id: 'xiaomi/mimo-v2.6-flash',
      name: 'MiMo-V2.6-Flash',
      pricing: withFlatPricing(FLAT_CNY, {
        input: 1,
        output: 2,
        cacheRead: 0.02,
        cacheWrite: 0,
      }),
    }),
  },
}

const makeTokenPlanOverlay = (opts: {
  providerId: string
  name: string
  host: string
}): ProviderOverlay => {
  const openAiUrl = `https://${opts.host}/v1`
  const anthropicUrl = `https://${opts.host}/anthropic`
  return {
    providerId: opts.providerId,
    name: opts.name,
    api: openAiUrl,
    protocolEndpoints: {
      'openai-completions': openAiUrl,
      'openai-responses': openAiUrl,
      'anthropic-messages': anthropicUrl,
    },
    env: ['XIAOMI_API_KEY'],
    npm: '@ai-sdk/openai-compatible',
    excludeModels: XIAOMI_RETIRED_MODELS,
    models: {
      'mimo-v2.6-pro': v26BaseModel(openAiUrl, {
        canonical_model_id: 'xiaomi/mimo-v2.6-pro',
        name: 'MiMo-V2.6-Pro',
        cost: ZERO_CASH_COST,
      }),
      'mimo-v2.6-pro-ultraspeed': v26BaseModel(openAiUrl, {
        name: 'MiMo-V2.6-Pro-UltraSpeed',
        cost: ZERO_CASH_COST,
      }),
      'mimo-v2.6-flash': v26BaseModel(openAiUrl, {
        canonical_model_id: 'xiaomi/mimo-v2.6-flash',
        name: 'MiMo-V2.6-Flash',
        cost: ZERO_CASH_COST,
      }),
    },
  }
}

/**
 * Xiaomi MiMo Token Plan regional clusters (`tp-` / `ttp-` subscription keys).
 * Keys are strictly scoped to their purchased cluster (cross-region calls return HTTP 401).
 * Usage consumes subscription Credits (0.8x off-peak rate 00:00-08:00 UTC+8); marginal cash cost is 0.
 * `mimo-v2.6-pro-ultraspeed` is available on Pro/Max tiers and paired as `ultrafast` speed tier in V2.
 */
export const xiaomiTokenPlanCnOverlay: ProviderOverlay = makeTokenPlanOverlay({
  providerId: 'xiaomi-token-plan-cn',
  name: 'Xiaomi MiMo Token Plan (China)',
  host: 'token-plan-cn.xiaomimimo.com',
})

export const xiaomiTokenPlanSgpOverlay: ProviderOverlay = makeTokenPlanOverlay({
  providerId: 'xiaomi-token-plan-sgp',
  name: 'Xiaomi MiMo Token Plan (Singapore)',
  host: 'token-plan-sgp.xiaomimimo.com',
})

export const xiaomiTokenPlanAmsOverlay: ProviderOverlay = makeTokenPlanOverlay({
  providerId: 'xiaomi-token-plan-ams',
  name: 'Xiaomi MiMo Token Plan (Amsterdam)',
  host: 'token-plan-ams.xiaomimimo.com',
})

export const XIAOMI_OVERLAYS: readonly ProviderOverlay[] = [
  xiaomiOverlay,
  xiaomiCnOverlay,
  xiaomiTokenPlanCnOverlay,
  xiaomiTokenPlanSgpOverlay,
  xiaomiTokenPlanAmsOverlay,
]
