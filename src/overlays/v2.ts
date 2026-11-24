import { withFlatPricing } from '../schedules/helpers'
import { FLAT_USD } from '../schedules/templates'
import type { PricingPromotion, V2Api } from '../schema/catalog-v2'

const OPENAI_FIRST_PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages'] as const
const MINIMAX_PROTOCOLS = ['anthropic-messages', 'openai-completions'] as const

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
  'qwen-token-plan': { billingMode: 'subscription' },
  'qwen-token-plan-individual': { billingMode: 'subscription' },
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
}
