import { withFlatPricing } from '../schedules/helpers'
import { FLAT_USD } from '../schedules/templates'
import type { ProviderOverlay } from '../schema/catalog'
import type { ModelsDocumentV2, PricingPromotion, V2Api } from '../schema/catalog-v2'
import { opencodeGoOverlay, opencodeOverlay } from './providers/opencode'
import {
  qwenTokenPlanOverlay,
  qwencloudBeijingOverlay,
  qwencloudFrankfurtOverlay,
  qwencloudHongkongOverlay,
  qwencloudSingaporeOverlay,
  qwencloudTokyoOverlay,
  qwencloudVirginiaOverlay,
} from './providers/qwencloud'
import { zaiApiOverlay } from './providers/zai'

const OPENAI_FIRST_PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const
const MINIMAX_PROTOCOLS = ['anthropic-messages', 'openai-completions'] as const
const OPENCODE_ALL_TEXT_PROTOCOLS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai',
] as const

const openAiFirstProtocolsFor = (
  overlay: ProviderOverlay,
): Readonly<Record<string, readonly V2Api[]>> =>
  Object.fromEntries(Object.keys(overlay.models ?? {}).map((id) => [id, OPENAI_FIRST_PROTOCOLS]))

const opencodeProtocolsFor = (
  overlay: ProviderOverlay,
): Readonly<Record<string, readonly V2Api[]>> =>
  Object.fromEntries(
    Object.entries(overlay.models ?? {}).map(([id, model]) => {
      const native = (model.pi_api ?? 'openai-completions') as V2Api
      return [
        id,
        [native, ...OPENCODE_ALL_TEXT_PROTOCOLS.filter((protocol) => protocol !== native)],
      ]
    }),
  )

const MINIMAX_V2_RULE = {
  supportedProtocols: {
    'MiniMax-M3.1-Flash': MINIMAX_PROTOCOLS,
    'MiniMax-M3': MINIMAX_PROTOCOLS,
  },
} as const

const MOONSHOT_V2_RULE = {
  fastModels: {
    'kimi-k3.1-pro': 'kimi-k3.1-pro-highspeed',
    'kimi-k2.7-code': 'kimi-k2.7-code-highspeed',
  },
  supportedProtocols: {
    'kimi-k3.1-pro': OPENAI_FIRST_PROTOCOLS,
    'kimi-k3': OPENAI_FIRST_PROTOCOLS,
    'kimi-k2.7-code': ['openai-completions'],
    'kimi-k2.6': ['openai-completions'],
  },
} as const

export const canonicalModelNames: Readonly<Record<string, string>> = {
  'glm-5.3-flashx': 'zhipuai/glm-5.3-flashx',
}

export const catalogOptionRules = [
  {
    modelMatch: 'kimi-k3\\.1-pro-prime',
    apiTypeMatch: 'openai-responses',
    baseUrlMatch: 'https://maas\\.qianwenaiapi\\.com/compatible-mode/v1/?',
    optionSpecs: {
      reasoningLevel: {
        values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
        map: '{"reasoning": {"effort": reasoningLevel}}',
      },
    },
  },
  {
    modelMatch: 'kimi-k3\\.1-pro-prime',
    apiTypeMatch: 'anthropic-messages',
    baseUrlMatch: 'https://maas\\.qianwenaiapi\\.com/apps/anthropic/?',
    optionSpecs: {
      reasoningLevel: {
        values: ['disabled', 'low', 'medium', 'high', 'xhigh', 'max'],
        map: `reasoningLevel == "disabled"
          ? {"thinking": {"type": "disabled"}}
          : {"output_config": {"effort": reasoningLevel}}`,
      },
    },
  },
  {
    modelMatch: 'glm-5\\.3-flashx-legal',
    apiTypeMatch: 'openai-completions',
    baseUrlMatch: 'https://api\\.z\\.ai/api/paas/v4/?',
    optionSpecs: {
      reasoningLevel: {
        map: '{"thinking": {"type": "enabled"}, "reasoning_effort": reasoningLevel}',
      },
    },
  },
  {
    modelMatch: 'qwen3\\.8-(?:max|flash)',
    apiTypeMatch: 'anthropic-messages',
    baseUrlMatch: 'https://maas\\.qianwenaiapi\\.com/apps/anthropic/?',
    optionSpecs: {
      reasoningLevel: {
        map: `reasoningLevel == "none"
          ? {"thinking": {"type": "disabled"}}
          : {"output_config": {"effort": reasoningLevel}}`,
      },
    },
  },
] satisfies NonNullable<ModelsDocumentV2['optionRules']>

export const providerRules: Readonly<
  Record<
    string,
    {
      billingMode?: 'subscription' | 'free'
      scheduleId?: string
      endpointAliases?: readonly string[]
      routers?: readonly string[]
      routerPrefixes?: readonly string[]
      canonicalIds?: Readonly<Record<string, string>>
      fastModels?: Readonly<Record<string, string>>
      ultrafastModels?: Readonly<Record<string, string>>
      supportedProtocols?: Readonly<Record<string, readonly V2Api[]>>
      promotions?: Readonly<Record<string, readonly PricingPromotion[]>>
    }
  >
> = {
  deepseek: {
    supportedProtocols: {
      'deepseek-flash': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4-pro': OPENAI_FIRST_PROTOCOLS,
    },
  },
  minimax: MINIMAX_V2_RULE,
  'minimax-cn': MINIMAX_V2_RULE,
  moonshotai: MOONSHOT_V2_RULE,
  'moonshotai-cn': MOONSHOT_V2_RULE,
  opencode: {
    endpointAliases: ['https://opencode.ai/inference/v1', 'https://opencode.ai/inference'],
    supportedProtocols: opencodeProtocolsFor(opencodeOverlay),
  },
  'opencode-go': {
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
    endpointAliases: ['https://opencode.ai/inference/go/v1', 'https://opencode.ai/inference/go'],
    supportedProtocols: opencodeProtocolsFor(opencodeGoOverlay),
  },
  'qianwen-cn': {
    canonicalIds: {
      'ZHIPU/GLM-5.3-FlashX': 'zhipuai/glm-5.3-flashx',
      'qwen3.7-text-embedding-flash': 'alibaba/qwen3.7-text-embedding-flash',
      'qwen3.7-text-rerank': 'alibaba/qwen3.7-text-rerank',
      'qwen3-vl-embedding': 'alibaba/qwen3-vl-embedding',
    },
    fastModels: { 'kimi/kimi-k3.1-pro': 'kimi/kimi-k3.1-pro-highspeed' },
    supportedProtocols: {
      'qwen4-max': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-max': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-flash': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-2.4t-a95b': OPENAI_FIRST_PROTOCOLS,
      'qwen3.7-plus': OPENAI_FIRST_PROTOCOLS,
      'qwen3.7-max': OPENAI_FIRST_PROTOCOLS,
      'qwen3.7-flash': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-omni-flash': OPENAI_FIRST_PROTOCOLS,
      'ZHIPU/GLM-5.3': OPENAI_FIRST_PROTOCOLS,
      'ZHIPU/GLM-5.3-Flash': OPENAI_FIRST_PROTOCOLS,
      'ZHIPU/GLM-5.3-FlashX': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4.1-flash': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4.1-flash-1017': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4-pro-0813': OPENAI_FIRST_PROTOCOLS,
      'kimi/kimi-k3.1-pro': OPENAI_FIRST_PROTOCOLS,
      'kimi-k3.1-pro-prime': ['openai-responses', 'anthropic-messages'],
    },
    promotions: {
      'qwen3.7-plus': [
        {
          id: 'qianwen-qwen3.7-plus-launch',
          label: '限时 5 折',
          startAt: '2026-11-01T00:00:00+08:00',
          endAt: '2026-12-31T23:59:59+08:00',
          discountFactor: 0.5,
        },
      ],
    },
  },
  'qwen-token-plan-cn': {
    billingMode: 'subscription',
    scheduleId: 'flat-cny',
    endpointAliases: ['https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'],
    routers: ['auto', 'decision-model-preview'],
    supportedProtocols: {
      auto: OPENAI_FIRST_PROTOCOLS,
      'decision-model-preview': ['openai-completions'],
      'qwen4-max': OPENAI_FIRST_PROTOCOLS,
      'qwen4-max-preview': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-max': OPENAI_FIRST_PROTOCOLS,
      'qwen3.8-flash': OPENAI_FIRST_PROTOCOLS,
      'qwen3.7-plus': OPENAI_FIRST_PROTOCOLS,
      'qwen3.7-max': OPENAI_FIRST_PROTOCOLS,
      'qwen3.6-flash': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4.1-flash': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4.1-flash-1017': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4-pro': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4-pro-0813': OPENAI_FIRST_PROTOCOLS,
      'deepseek-v4-flash-0731': OPENAI_FIRST_PROTOCOLS,
      'ZHIPU/GLM-5.3': OPENAI_FIRST_PROTOCOLS,
      'ZHIPU/GLM-5.2': OPENAI_FIRST_PROTOCOLS,
      'glm-5.3': OPENAI_FIRST_PROTOCOLS,
      'glm-5.2': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'qwen-token-plan': {
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
    endpointAliases: ['https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'],
    routers: ['auto'],
    supportedProtocols: openAiFirstProtocolsFor(qwenTokenPlanOverlay),
  },
  'qwen-token-plan-individual': { billingMode: 'subscription' },
  'qwencloud-singapore': {
    endpointAliases: [
      'https://maas.qwencloudapi.com/compatible-mode/v1',
      'https://maas.qwencloudapi.com/apps/anthropic',
    ],
    supportedProtocols: openAiFirstProtocolsFor(qwencloudSingaporeOverlay),
  },
  'qwencloud-beijing': {
    supportedProtocols: openAiFirstProtocolsFor(qwencloudBeijingOverlay),
  },
  'qwencloud-virginia': {
    supportedProtocols: openAiFirstProtocolsFor(qwencloudVirginiaOverlay),
  },
  'qwencloud-frankfurt': {
    supportedProtocols: openAiFirstProtocolsFor(qwencloudFrankfurtOverlay),
  },
  'qwencloud-hongkong': {
    supportedProtocols: openAiFirstProtocolsFor(qwencloudHongkongOverlay),
  },
  'qwencloud-tokyo': {
    supportedProtocols: openAiFirstProtocolsFor(qwencloudTokyoOverlay),
  },
  xiaomi: {
    ultrafastModels: {
      'mimo-v2.6-pro': 'mimo-v2.6-pro-ultraspeed',
    },
    supportedProtocols: {
      'mimo-v2.6-pro': OPENAI_FIRST_PROTOCOLS,
      'mimo-v2.6-flash': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'xiaomi-cn': {
    ultrafastModels: {
      'mimo-v2.6-pro': 'mimo-v2.6-pro-ultraspeed',
    },
    supportedProtocols: {
      'mimo-v2.6-pro': OPENAI_FIRST_PROTOCOLS,
      'mimo-v2.6-flash': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'xiaomi-token-plan-cn': {
    billingMode: 'subscription',
    scheduleId: 'flat-cny',
    ultrafastModels: {
      'mimo-v2.6-pro': 'mimo-v2.6-pro-ultraspeed',
    },
    supportedProtocols: {
      'mimo-v2.6-pro': OPENAI_FIRST_PROTOCOLS,
      'mimo-v2.6-flash': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'xiaomi-token-plan-sgp': {
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
    ultrafastModels: {
      'mimo-v2.6-pro': 'mimo-v2.6-pro-ultraspeed',
    },
    supportedProtocols: {
      'mimo-v2.6-pro': OPENAI_FIRST_PROTOCOLS,
      'mimo-v2.6-flash': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'xiaomi-token-plan-ams': {
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
    ultrafastModels: {
      'mimo-v2.6-pro': 'mimo-v2.6-pro-ultraspeed',
    },
    supportedProtocols: {
      'mimo-v2.6-pro': OPENAI_FIRST_PROTOCOLS,
      'mimo-v2.6-flash': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'zai-api': {
    canonicalIds: { 'glm-5.3-flashx': 'zhipuai/glm-5.3-flashx' },
    supportedProtocols: openAiFirstProtocolsFor(zaiApiOverlay),
  },
  zai: {
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
    fastModels: {
      'glm-5.3': 'glm-5.3-highspeed',
      'glm-5.2': 'glm-5.2-highspeed',
    },
    supportedProtocols: {
      'glm-5.4': OPENAI_FIRST_PROTOCOLS,
      'glm-5.3': OPENAI_FIRST_PROTOCOLS,
      'glm-5.3-flash': OPENAI_FIRST_PROTOCOLS,
      'glm-5.2': OPENAI_FIRST_PROTOCOLS,
      'glm-5-turbo': OPENAI_FIRST_PROTOCOLS,
      'glm-4.7': OPENAI_FIRST_PROTOCOLS,
    },
  },
  'zai-coding-cn': {
    billingMode: 'subscription',
    scheduleId: 'flat-cny',
    fastModels: {
      'glm-5.3': 'glm-5.3-highspeed',
    },
    supportedProtocols: {
      'glm-5.4': OPENAI_FIRST_PROTOCOLS,
      'glm-5.3': OPENAI_FIRST_PROTOCOLS,
      'glm-5.3-flash': OPENAI_FIRST_PROTOCOLS,
      'glm-4.6v': OPENAI_FIRST_PROTOCOLS,
    },
  },
  openrouter: {
    routerPrefixes: ['~'],
    routers: [
      'auto',
      'openrouter/auto',
      'openrouter/auto-beta',
      'openrouter/free',
      'openrouter/fusion',
      'openrouter/pareto-code',
    ],
  },
  fireworks: { routerPrefixes: ['accounts/fireworks/routers/'] },
  typesafe: { routers: ['typesafe/jev-router'] },
  zhipuai: { canonicalIds: { 'glm-5.3-flashx': 'zhipuai/glm-5.3-flashx' } },
}

export const historicalReference = {
  'minimax/minimax-m2.7': withFlatPricing(FLAT_USD, {
    input: 0.3,
    output: 1.2,
    cacheRead: 0.06,
    cacheWrite: 0.375,
  }),
  'minimax/minimax-m2.7-highspeed': withFlatPricing(FLAT_USD, {
    input: 0.6,
    output: 2.4,
    cacheRead: 0.06,
    cacheWrite: 0.375,
  }),
  'xiaomi/mimo-v2.5': withFlatPricing(FLAT_USD, {
    input: 0.14,
    output: 0.28,
    cacheRead: 0.0028,
    cacheWrite: 0,
  }),
  'xiaomi/mimo-v2.5-pro': withFlatPricing(FLAT_USD, {
    input: 0.435,
    output: 0.87,
    cacheRead: 0.0036,
    cacheWrite: 0,
  }),
  'xiaomi/mimo-v2.5-pro-ultraspeed': withFlatPricing(FLAT_USD, {
    input: 1.305,
    output: 2.61,
    cacheRead: 0.0108,
    cacheWrite: 0,
  }),
}
