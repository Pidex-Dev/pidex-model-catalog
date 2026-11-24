import type { ProviderOverlay } from '../../schema/catalog'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_CNY, FLAT_USD } from '../../schedules/templates'

const K3_COMPAT = {
  maxTokensField: 'max_tokens',
  requiresReasoningContentOnAssistantMessages: true,
  supportsDeveloperRole: false,
  supportsMidConvoSystemMessages: true,
  supportsMidConvoToolAdditions: true,
  supportsReasoningEffort: true,
  supportsStore: false,
  supportsStrictMode: false,
  thinkingFormat: 'openai',
} as const

const K3_THINKING_LEVEL_MAP = {
  high: 'high',
  low: 'low',
  max: 'max',
  medium: null,
  minimal: null,
  off: null,
  xhigh: null,
} as const

const K3_REASONING_OPTIONS = [
  { type: 'effort' as const, values: ['low', 'high', 'max'], default: 'max' },
]

const KIMI_MULTIMODAL_MODALITIES = {
  input: ['text', 'image', 'video'],
  output: ['text'],
}

/**
 * Moonshot AI / Kimi official pay-as-you-go pricing, protocol endpoints & model specs (CN & Global).
 * Sources:
 * - https://platform.kimi.com/docs/pricing/chat (moonshotai-cn, CNY)
 * - https://platform.kimi.ai/docs/pricing/chat (moonshotai, USD)
 * - https://platform.kimi.com/docs/api/overview & https://platform.kimi.ai/docs/api/overview
 * - https://platform.kimi.com/docs/api/models-overview
 *
 * Conventions:
 * - K3 series auto-enables context caching with a default 5m TTL and optional 1h TTL;
 *   `cacheWrite` carries the default 5m tariff and `cacheWriteByTtl` records both `5m` and `1h`.
 * - K2 series (`kimi-k2.7-code`, `kimi-k2.7-code-highspeed`, `kimi-k2.6`) remains callable for
 *   existing users until planned late-December 2026 retirement and does not bill cache writes (`0`).
 * - `kimi-k2.7-code` is thinking-only (always-on reasoning, no disable toggle or effort levels;
 *   Pi records `thinkingLevelMap: { off: null }`), so `reasoning_options` is intentionally omitted.
 * - OpenAI Responses and Anthropic Messages endpoints only support K3 series models; per-model
 *   `supportedProtocols` constraints are declared in `src/overlays/v2.ts`.
 */
export const moonshotCnOverlay: ProviderOverlay = {
  providerId: 'moonshotai-cn',
  protocolEndpoints: {
    'openai-completions': 'https://api.moonshot.cn/v1',
    'openai-responses': 'https://api.moonshot.cn/v1',
    'anthropic-messages': 'https://api.moonshot.cn/anthropic',
  },
  models: {
    'kimi-k3.1-pro': {
      pi_api: 'openai-completions',
      base_url: 'https://api.moonshot.cn/v1',
      compat: { ...K3_COMPAT },
      thinking_level_map: { ...K3_THINKING_LEVEL_MAP },
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 13,
        output: 68,
        cacheRead: 1.3,
        cacheWrite: 13,
        cacheWriteByTtl: { '5m': 13, '1h': 26 },
      }),
    },
    'kimi-k3.1-pro-highspeed': {
      pi_api: 'openai-completions',
      base_url: 'https://api.moonshot.cn/v1',
      compat: { ...K3_COMPAT },
      thinking_level_map: { ...K3_THINKING_LEVEL_MAP },
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 26,
        output: 136,
        cacheRead: 1.3,
        cacheWrite: 26,
        cacheWriteByTtl: { '5m': 26, '1h': 52 },
      }),
    },
    'kimi-k3': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_CNY, {
        input: 20,
        output: 100,
        cacheRead: 2,
        cacheWrite: 20,
        cacheWriteByTtl: { '5m': 20, '1h': 40 },
      }),
    },
    'kimi-k2.7-code': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 6.5,
        output: 27,
        cacheRead: 1.3,
        cacheWrite: 0,
      }),
    },
    'kimi-k2.7-code-highspeed': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      pricing: withFlatPricing(FLAT_CNY, {
        input: 13,
        output: 54,
        cacheRead: 2.6,
        cacheWrite: 0,
      }),
    },
    'kimi-k2.6': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_CNY, {
        input: 6.5,
        output: 27,
        cacheRead: 1.1,
        cacheWrite: 0,
      }),
    },
  },
}

export const moonshotOverlay: ProviderOverlay = {
  providerId: 'moonshotai',
  protocolEndpoints: {
    'openai-completions': 'https://api.moonshot.ai/v1',
    'openai-responses': 'https://api.moonshot.ai/v1',
    'anthropic-messages': 'https://api.moonshot.ai/anthropic',
  },
  models: {
    'kimi-k3.1-pro': {
      pi_api: 'openai-completions',
      base_url: 'https://api.moonshot.ai/v1',
      compat: { ...K3_COMPAT },
      thinking_level_map: { ...K3_THINKING_LEVEL_MAP },
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_USD, {
        input: 2,
        output: 10,
        cacheRead: 0.2,
        cacheWrite: 2,
        cacheWriteByTtl: { '5m': 2, '1h': 4 },
      }),
    },
    'kimi-k3.1-pro-highspeed': {
      pi_api: 'openai-completions',
      base_url: 'https://api.moonshot.ai/v1',
      compat: { ...K3_COMPAT },
      thinking_level_map: { ...K3_THINKING_LEVEL_MAP },
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_USD, {
        input: 4,
        output: 20,
        cacheRead: 0.2,
        cacheWrite: 4,
        cacheWriteByTtl: { '5m': 4, '1h': 8 },
      }),
    },
    'kimi-k3': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: K3_REASONING_OPTIONS,
      pricing: withFlatPricing(FLAT_USD, {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3,
        cacheWriteByTtl: { '5m': 3, '1h': 6 },
      }),
    },
    'kimi-k2.7-code': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.95,
        output: 4,
        cacheRead: 0.19,
        cacheWrite: 0,
      }),
    },
    'kimi-k2.7-code-highspeed': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      pricing: withFlatPricing(FLAT_USD, {
        input: 1.9,
        output: 8,
        cacheRead: 0.38,
        cacheWrite: 0,
      }),
    },
    'kimi-k2.6': {
      modalities: KIMI_MULTIMODAL_MODALITIES,
      reasoning: true,
      interleaved: { field: 'reasoning_content' },
      reasoning_options: [{ type: 'toggle' }],
      pricing: withFlatPricing(FLAT_USD, {
        input: 0.95,
        output: 4,
        cacheRead: 0.16,
        cacheWrite: 0,
      }),
    },
  },
}
