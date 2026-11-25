import type { ModelFactsPatch, ProviderOverlay } from '../../schema/catalog'
import type { UnitPrices } from '../../schema/pricing'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_USD } from '../../schedules/templates'

const ZERO_CASH_COST = {
  input: 0,
  output: 0,
  cache_read: 0,
  cache_write: 0,
} as const

const GLM_EFFORT_COMPAT = {
  maxTokensField: 'max_tokens',
  supportsDeveloperRole: false,
  supportsReasoningEffort: true,
  supportsStore: false,
  supportsStrictMode: true,
  thinkingFormat: 'zai',
  zaiToolStream: true,
} as const

const GLM_TOGGLE_COMPAT = {
  maxTokensField: 'max_tokens',
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsStore: false,
  supportsStrictMode: true,
  thinkingFormat: 'zai',
  zaiToolStream: true,
} as const

const GLM53_THINKING_LEVEL_MAP = {
  high: 'high',
  low: 'low',
  max: 'max',
  medium: null,
  minimal: null,
  off: null,
  xhigh: null,
} as const

const GLM52_THINKING_LEVEL_MAP = {
  high: 'high',
  low: null,
  max: 'max',
  medium: null,
  minimal: null,
  off: 'none',
  xhigh: null,
} as const

const GLM_EFFORT_OPTIONS = [
  { type: 'effort' as const, values: ['low', 'high', 'max'], default: 'max' },
]

const GLM52_REASONING_OPTIONS = [
  { type: 'toggle' as const },
  { type: 'effort' as const, values: ['high', 'max'], default: 'max' },
]

const GLM_TOGGLE_OPTIONS = [{ type: 'toggle' as const }]

const GLM_MULTIMODAL_MODALITIES = {
  input: ['text', 'image', 'video', 'pdf'],
  output: ['text'],
}

const GLM_VISION_MODALITIES = {
  input: ['text', 'image', 'video'],
  output: ['text'],
}

const GLM_TEXT_MODALITIES = {
  input: ['text'],
  output: ['text'],
}

const INTERLEAVED_REASONING = { field: 'reasoning_content' } as const

const codingModel = (baseUrl: string, patch: ModelFactsPatch): ModelFactsPatch => ({
  pi_api: 'openai-completions',
  base_url: baseUrl,
  reasoning: true,
  tool_call: true,
  interleaved: INTERLEAVED_REASONING,
  cost: ZERO_CASH_COST,
  ...patch,
})

const ZAI_GLOBAL_PAYG_URL = 'https://api.z.ai/api/paas/v4'
const ZAI_GLOBAL_OPENAI_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZAI_CN_OPENAI_URL = 'https://open.bigmodel.cn/api/coding/paas/v4'

const paygUsdModel = (
  prices: UnitPrices,
  patch: ModelFactsPatch,
): ModelFactsPatch => ({
  pi_api: 'openai-completions',
  base_url: ZAI_GLOBAL_PAYG_URL,
  reasoning: true,
  tool_call: true,
  interleaved: INTERLEAVED_REASONING,
  pricing: withFlatPricing(FLAT_USD, prices),
  ...patch,
})

/**
 * Z.AI GLM Coding Plan (Global, `api.z.ai`) official endpoints, models & subscription isolation.
 * Sources:
 * - https://docs.z.ai/devpack/overview.md
 * - https://docs.z.ai/devpack/tool/others.md
 * - https://docs.z.ai/devpack/tool/pi.md
 * - https://docs.z.ai/devpack/notice/api-key-management.md
 * - https://docs.z.ai/guides/capabilities/thinking.md
 * - https://docs.z.ai/guides/llm/glm-5.4.md
 *
 * Conventions:
 * - Per official Z.AI Pi integration docs (`docs.z.ai/devpack/tool/pi.md`), provider `zai` uses a
 *   GLM Coding Plan API key (Personal or Team) billed via subscription Credits (USD plans, 50%
 *   off-peak credit discount outside Mon-Fri 14:00-18:00 UTC+8), not pay-as-you-go balance.
 *   Marginal cash cost is 0 and V2 marks `billingMode: 'subscription'`.
 * - Includes the latest flagship `glm-5.4` (1M context, 128K max output, multimodal, forced
 *   thinking with `low`/`high`/`max` effort; Coding Plan exclusive while Model API undergoes
 *   security assessment) alongside still-callable Coding Plan models and highspeed tiers.
 * - `glm-5.3-highspeed` and `glm-5.2-highspeed` are paired as `fast` speed tiers in V2.
 */
export const zaiOverlay: ProviderOverlay = {
  providerId: 'zai',
  name: 'Z.AI Coding Plan (Global)',
  api: ZAI_GLOBAL_OPENAI_URL,
  protocolEndpoints: {
    'openai-completions': ZAI_GLOBAL_OPENAI_URL,
    'openai-responses': 'https://api.z.ai/api/v1',
    'anthropic-messages': 'https://api.z.ai/api/anthropic',
  },
  env: ['ZAI_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  models: {
    'glm-5.4': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.4',
      name: 'GLM-5.4',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_MULTIMODAL_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3-highspeed': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3',
      name: 'GLM-5.3 Highspeed',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3-flash': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3-flash',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_MULTIMODAL_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.2': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.2',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM52_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      reasoning_options: GLM52_REASONING_OPTIONS,
    }),
    'glm-5.2-highspeed': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.2',
      name: 'GLM-5.2 Highspeed',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM52_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      reasoning_options: GLM52_REASONING_OPTIONS,
    }),
    'glm-5-turbo': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5-turbo',
      compat: { ...GLM_TOGGLE_COMPAT },
      limit: { context: 200_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      reasoning_options: GLM_TOGGLE_OPTIONS,
    }),
    'glm-4.7': codingModel(ZAI_GLOBAL_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-4.7',
      compat: { ...GLM_TOGGLE_COMPAT },
      limit: { context: 204_800, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      reasoning_options: GLM_TOGGLE_OPTIONS,
    }),
  },
}

/**
 * Zhipu AI / Z.AI GLM Coding Plan (China, `open.bigmodel.cn`) official endpoints & models.
 * Sources:
 * - https://docs.bigmodel.cn/cn/coding-plan/overview.md
 * - https://docs.bigmodel.cn/cn/coding-plan/tool/others.md
 * - https://docs.bigmodel.cn/cn/coding-plan/tool/pi.md
 * - https://docs.bigmodel.cn/cn/coding-plan/notice/api-key-management.md
 * - https://docs.bigmodel.cn/cn/coding-plan/latest-model.md
 *
 * Conventions:
 * - Uses China Coding Plan API keys (`ZAI_CODING_CN_API_KEY`) billed via CNY subscription
 *   Credits (50% off-peak credit discount outside Mon-Fri 14:00-18:00 UTC+8).
 * - Adds `glm-5.4` and keeps still-callable `glm-5.3-highspeed` (paired as `fast` tier of
 *   `glm-5.3` in V2) and `glm-4.6v`.
 */
export const zaiCodingCnOverlay: ProviderOverlay = {
  providerId: 'zai-coding-cn',
  name: 'Z.AI Coding Plan (China)',
  api: ZAI_CN_OPENAI_URL,
  protocolEndpoints: {
    'openai-completions': ZAI_CN_OPENAI_URL,
    'openai-responses': 'https://open.bigmodel.cn/api/v1',
    'anthropic-messages': 'https://open.bigmodel.cn/api/anthropic',
  },
  env: ['ZAI_CODING_CN_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  models: {
    'glm-5.4': codingModel(ZAI_CN_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.4',
      name: 'GLM-5.4',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_MULTIMODAL_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3': codingModel(ZAI_CN_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3-highspeed': codingModel(ZAI_CN_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3',
      name: 'GLM-5.3 Highspeed',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_TEXT_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-5.3-flash': codingModel(ZAI_CN_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-5.3-flash',
      compat: { ...GLM_EFFORT_COMPAT },
      thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
      limit: { context: 1_000_000, output: 131_072 },
      modalities: GLM_MULTIMODAL_MODALITIES,
      structured_output: true,
      reasoning_options: GLM_EFFORT_OPTIONS,
    }),
    'glm-4.6v': codingModel(ZAI_CN_OPENAI_URL, {
      canonical_model_id: 'zhipuai/glm-4.6v',
      compat: { ...GLM_TOGGLE_COMPAT },
      limit: { context: 128_000, output: 32_768 },
      modalities: GLM_VISION_MODALITIES,
      reasoning_options: GLM_TOGGLE_OPTIONS,
    }),
  },
}

/**
 * Z.AI (Global, `api.z.ai/api/paas/v4`) official USD pay-as-you-go text & vision model pricing.
 * Sources:
 * - https://docs.z.ai/guides/overview/pricing.md
 * - https://docs.z.ai/guides/overview/overview.md
 * - https://docs.z.ai/guides/capabilities/thinking.md
 * - https://docs.z.ai/devpack/notice/api-key-management.md
 *
 * Conventions:
 * - Standard API keys bill per 1M tokens in flat USD (no context-length tiering or off-peak
 *   discount). Cached input storage is limited-time free (`cacheWrite: 0`); models without context
 *   caching record `cacheRead: null, cacheWrite: null`.
 * - `GLM-5.4` is excluded until Z.AI opens its pay-as-you-go Model API after security assessment.
 */
export const zaiApiOverlay: ProviderOverlay = {
  providerId: 'zai-api',
  name: 'Z.AI (Global)',
  api: ZAI_GLOBAL_PAYG_URL,
  protocolEndpoints: {
    'openai-completions': ZAI_GLOBAL_PAYG_URL,
    'openai-responses': 'https://api.z.ai/api/v1',
    'anthropic-messages': 'https://api.z.ai/api/anthropic',
  },
  env: ['ZAI_API_KEY'],
  npm: '@ai-sdk/openai-compatible',
  models: {
    'glm-5.3': paygUsdModel(
      { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.3',
        name: 'GLM-5.3',
        compat: { ...GLM_EFFORT_COMPAT },
        thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
        limit: { context: 1_000_000, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        structured_output: true,
        reasoning_options: GLM_EFFORT_OPTIONS,
      },
    ),
    'glm-5.3-flash': paygUsdModel(
      { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.3-flash',
        name: 'GLM-5.3-Flash',
        compat: { ...GLM_EFFORT_COMPAT },
        thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
        limit: { context: 1_000_000, output: 131_072 },
        modalities: GLM_MULTIMODAL_MODALITIES,
        structured_output: true,
        reasoning_options: GLM_EFFORT_OPTIONS,
      },
    ),
    'glm-5.3-flashx': paygUsdModel(
      { input: 0.37, output: 1.25, cacheRead: 0.075, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.3-flashx',
        name: 'GLM-5.3-FlashX',
        compat: { ...GLM_EFFORT_COMPAT },
        thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
        limit: { context: 1_000_000, output: 131_072 },
        modalities: GLM_MULTIMODAL_MODALITIES,
        structured_output: true,
        reasoning_options: GLM_EFFORT_OPTIONS,
      },
    ),
    'glm-5.3-flashx-legal': paygUsdModel(
      { input: 0.37, output: 1.25, cacheRead: 0.075, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.3-flashx-legal',
        name: 'GLM-5.3-FlashX-Legal',
        compat: { ...GLM_EFFORT_COMPAT },
        thinking_level_map: { ...GLM53_THINKING_LEVEL_MAP },
        limit: { context: 1_000_000, output: 131_072 },
        modalities: GLM_MULTIMODAL_MODALITIES,
        structured_output: true,
        reasoning_options: GLM_EFFORT_OPTIONS,
      },
    ),
    'glm-5.2': paygUsdModel(
      { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.2',
        name: 'GLM-5.2',
        compat: { ...GLM_EFFORT_COMPAT },
        thinking_level_map: { ...GLM52_THINKING_LEVEL_MAP },
        limit: { context: 1_000_000, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM52_REASONING_OPTIONS,
      },
    ),
    'glm-5.1': paygUsdModel(
      { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5.1',
        name: 'GLM-5.1',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 200_000, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-5': paygUsdModel(
      { input: 1, output: 3.2, cacheRead: 0.2, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-5',
        name: 'GLM-5',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 204_800, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.7': paygUsdModel(
      { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.7',
        name: 'GLM-4.7',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 204_800, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.7-flashx': paygUsdModel(
      { input: 0.07, output: 0.4, cacheRead: 0.01, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.7-flashx',
        name: 'GLM-4.7-FlashX',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 200_000, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.7-flash': paygUsdModel(
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.7-flash',
        name: 'GLM-4.7-Flash',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 200_000, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.6': paygUsdModel(
      { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.6',
        name: 'GLM-4.6',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 204_800, output: 131_072 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.6v': paygUsdModel(
      { input: 0.3, output: 0.9, cacheRead: 0.05, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.6v',
        name: 'GLM-4.6V',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 128_000, output: 32_768 },
        modalities: GLM_VISION_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.6v-flashx': paygUsdModel(
      { input: 0.04, output: 0.4, cacheRead: 0.004, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.6v-flashx',
        name: 'GLM-4.6V-FlashX',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 128_000, output: 32_768 },
        modalities: GLM_VISION_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.6v-flash': paygUsdModel(
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.6v-flash',
        name: 'GLM-4.6V-Flash',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 128_000, output: 32_768 },
        modalities: GLM_VISION_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5': paygUsdModel(
      { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5',
        name: 'GLM-4.5',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 131_072, output: 98_304 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5-x': paygUsdModel(
      { input: 2.2, output: 8.9, cacheRead: 0.45, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5-x',
        name: 'GLM-4.5-X',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 131_072, output: 98_304 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5-air': paygUsdModel(
      { input: 0.2, output: 1.1, cacheRead: 0.03, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5-air',
        name: 'GLM-4.5-Air',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 131_072, output: 98_304 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5-airx': paygUsdModel(
      { input: 1.1, output: 4.5, cacheRead: 0.22, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5-airx',
        name: 'GLM-4.5-AirX',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 131_072, output: 98_304 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5-flash': paygUsdModel(
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5-flash',
        name: 'GLM-4.5-Flash',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 131_072, output: 98_304 },
        modalities: GLM_TEXT_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4.5v': paygUsdModel(
      { input: 0.6, output: 1.8, cacheRead: 0.11, cacheWrite: 0 },
      {
        canonical_model_id: 'zhipuai/glm-4.5v',
        name: 'GLM-4.5V',
        compat: { ...GLM_TOGGLE_COMPAT },
        limit: { context: 64_000, output: 16_384 },
        modalities: GLM_VISION_MODALITIES,
        reasoning_options: GLM_TOGGLE_OPTIONS,
      },
    ),
    'glm-4-32b-0414-128k': paygUsdModel(
      { input: 0.1, output: 0.1, cacheRead: null, cacheWrite: null },
      {
        canonical_model_id: 'zhipuai/glm-4-32b-0414-128k',
        name: 'GLM-4-32B-0414-128K',
        reasoning: false,
        interleaved: undefined,
        limit: { context: 128_000, output: 16_384 },
        modalities: GLM_TEXT_MODALITIES,
      },
    ),
  },
}

export const ZAI_OVERLAYS: readonly ProviderOverlay[] = [
  zaiApiOverlay,
  zaiOverlay,
  zaiCodingCnOverlay,
]
