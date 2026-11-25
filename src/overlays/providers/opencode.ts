import type { ModelFactsPatch, ProtocolEndpointApi, ProviderOverlay } from '../../schema/catalog'
import type { UnitPrices } from '../../schema/pricing'
import { withFlatPricing } from '../../schedules/helpers'
import { FLAT_USD } from '../../schedules/templates'

type OpenCodeTextProtocol = Extract<
  ProtocolEndpointApi,
  'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
>

const ZERO_CASH_COST = {
  input: 0,
  output: 0,
  cache_read: 0,
  cache_write: 0,
} as const

export const OPENCODE_PROTOCOL_ENDPOINTS: Readonly<Record<OpenCodeTextProtocol, string>> = {
  'openai-completions': 'https://opencode.ai/inference/openai/v1',
  'openai-responses': 'https://opencode.ai/inference/openai/v1',
  'anthropic-messages': 'https://opencode.ai/inference/anthropic',
  'google-generative-ai': 'https://opencode.ai/inference/google/v1beta',
}

export const OPENCODE_GO_PROTOCOL_ENDPOINTS: Readonly<Record<OpenCodeTextProtocol, string>> = {
  'openai-completions': 'https://opencode.ai/inference/go/openai/v1',
  'openai-responses': 'https://opencode.ai/inference/go/openai/v1',
  'anthropic-messages': 'https://opencode.ai/inference/go/anthropic',
  'google-generative-ai': 'https://opencode.ai/inference/go/google/v1beta',
}

const paygModel = (
  protocol: OpenCodeTextProtocol,
  prices: UnitPrices,
  patch: ModelFactsPatch = {},
): ModelFactsPatch => ({
  ...patch,
  pi_api: protocol,
  base_url: OPENCODE_PROTOCOL_ENDPOINTS[protocol],
  reasoning: true,
  pricing: withFlatPricing(FLAT_USD, prices),
})

const goModel = (
  protocol: OpenCodeTextProtocol,
  patch: ModelFactsPatch = {},
): ModelFactsPatch => ({
  ...patch,
  pi_api: protocol,
  base_url: OPENCODE_GO_PROTOCOL_ENDPOINTS[protocol],
  reasoning: true,
  cost: ZERO_CASH_COST,
})

/**
 * OpenCode Console (Pay-as-you-go) callable chat models, native protocols, thinking efforts & list pricing.
 * Sources:
 * - https://opencode.ai/docs/console/api/inference
 * - https://opencode.ai/docs/console/models
 * - https://opencode.ai/inference/v1/models (captured 2026-11-25)
 *
 * Conventions:
 * - Only paid chat models callable from external clients are included (73 models). Free-tier chat
 *   models (`big-pickle`, `*-free`) are excluded because OpenCode restricts them to its own client
 *   and returns HTTP 403 for external harnesses/API keys; non-chat models (embedding, decision,
 *   image, video, realtime) are also excluded.
 * - Original (list) USD prices are recorded for promotional models (Gemini 4 Carbon/Argon, Gemini
 *   3.6/3.7/3.8 Flash, GLM 5.3, DeepSeek V4.1 Flash, Mistral Large 4) so estimates stay accurate
 *   when temporary discounts end.
 * - Each model declares its native recommended protocol (`pi_api` & `base_url`); OpenCode Console
 *   also translates all four text protocols, declared in `src/overlays/v2.ts` with the native
 *   protocol listed first.
 */
export const opencodeOverlay: ProviderOverlay = {
  providerId: 'opencode',
  name: 'OpenCode',
  api: OPENCODE_PROTOCOL_ENDPOINTS['openai-completions'],
  endpoints: ['https://opencode.ai/inference/v1', 'https://opencode.ai/inference'],
  protocolEndpoints: { ...OPENCODE_PROTOCOL_ENDPOINTS },
  env: ['OPENCODE_API_KEY'],
  replaceModels: true,
  models: {
    'claude-fable-5': paygModel('anthropic-messages', { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 }, {
        canonical_model_id: 'anthropic/claude-fable-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-fable-5-1': paygModel('anthropic-messages', { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 }, {
        canonical_model_id: 'anthropic/claude-fable-5-1',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-fable-5-2': paygModel('anthropic-messages', { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 10 }, {
        canonical_model_id: 'anthropic/claude-fable-5-2',
        limit: { context: 1_000_000, output: 128_000 },
        compat: { forceAdaptiveThinking: true, supportsMidConvoSystemMessages: true },
        thinking_level_map: { max: 'max', off: null, xhigh: 'xhigh' },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-haiku-4-5': paygModel('anthropic-messages', { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }, {
        canonical_model_id: 'anthropic/claude-haiku-4-5',
        limit: { context: 200_000, output: 64_000 },
        reasoning_options: [{ type: 'budget_tokens', min: 1024 }],
      }),
    'claude-haiku-5-5': paygModel('anthropic-messages', {
        input: 0.1,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
        tiers: [{ inputTokensAbove: 100_000, input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 }],
      }, {
        canonical_model_id: 'anthropic/claude-haiku-5-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-opus-4-5': paygModel('anthropic-messages', { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }, {
        canonical_model_id: 'anthropic/claude-opus-4-5',
        limit: { context: 200_000, output: 64_000 },
        reasoning_options: [
          { type: 'effort', values: ['low', 'medium', 'high'] },
          { type: 'budget_tokens', min: 1024 },
        ],
      }),
    'claude-opus-4-6': paygModel('anthropic-messages', { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }, {
        canonical_model_id: 'anthropic/claude-opus-4-6',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [
          { type: 'effort', values: ['low', 'medium', 'high', 'max'] },
          { type: 'budget_tokens', min: 1024 },
        ],
      }),
    'claude-opus-4-7': paygModel('anthropic-messages', { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }, {
        canonical_model_id: 'anthropic/claude-opus-4-7',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-opus-4-8': paygModel('anthropic-messages', { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }, {
        canonical_model_id: 'anthropic/claude-opus-4-8',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-opus-5': paygModel('anthropic-messages', { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }, {
        canonical_model_id: 'anthropic/claude-opus-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-opus-5-5': paygModel('anthropic-messages', { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }, {
        canonical_model_id: 'anthropic/claude-opus-5-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-sonnet-4-5': paygModel('anthropic-messages', {
        input: 3,
        output: 15,
        cacheRead: 0.3,
        cacheWrite: 3.75,
        tiers: [{ inputTokensAbove: 200_000, input: 6, output: 22.5, cacheRead: 0.6, cacheWrite: 7.5 }],
      }, {
        canonical_model_id: 'anthropic/claude-sonnet-4-5',
        limit: { context: 1_000_000, output: 64_000 },
        reasoning_options: [{ type: 'budget_tokens', min: 1024 }],
      }),
    'claude-sonnet-4-6': paygModel('anthropic-messages', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }, {
        canonical_model_id: 'anthropic/claude-sonnet-4-6',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [
          { type: 'effort', values: ['low', 'medium', 'high', 'max'] },
          { type: 'budget_tokens', min: 1024 },
        ],
      }),
    'claude-sonnet-5': paygModel('anthropic-messages', { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 }, {
        canonical_model_id: 'anthropic/claude-sonnet-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'claude-sonnet-5-5': paygModel('anthropic-messages', { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 }, {
        canonical_model_id: 'anthropic/claude-sonnet-5-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'deepseek-v4-pro': paygModel('openai-completions', { input: 1.74, output: 3.48, cacheRead: 0.145, cacheWrite: 0 }, {
        canonical_model_id: 'deepseek/deepseek-v4-pro',
        limit: { context: 1_000_000, output: 384_000 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['high', 'max'] }],
      }),
    'deepseek-v4.1-flash': paygModel('openai-completions', { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 }, {
        canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
        limit: { context: 1_000_000, output: 384_000 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'gemini-3.5-flash': paygModel('google-generative-ai', { input: 1.5, output: 9, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-3.5-flash',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
      }),
    'gemini-3.5-flash-lite': paygModel('google-generative-ai', { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-3.5-flash-lite',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
      }),
    'gemini-3.6-flash': paygModel('google-generative-ai', { input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-3.6-flash',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
      }),
    'gemini-3.7-flash': paygModel('google-generative-ai', { input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-3.7-flash',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gemini-3.8-flash': paygModel('google-generative-ai', { input: 1.5, output: 7.5, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-3.8-flash',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gemini-4-argon': paygModel('google-generative-ai', { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-4-argon',
        limit: { context: 1048576, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gemini-4-carbon': paygModel('google-generative-ai', { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-4-carbon',
        limit: { context: 1048576, output: 65536 },
        thinking_level_map: { high: 'high', low: 'low', max: null, medium: 'medium', minimal: null, off: null, xhigh: null },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gemini-4-hydrogen': paygModel('google-generative-ai', { input: 1.5, output: 7.5, cacheRead: 0.075, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-4-hydrogen',
        limit: { context: 1048576, output: 65536 },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: null,
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'], default: 'high' }],
      }),
    'gemini-4-neon': paygModel('google-generative-ai', { input: 3, output: 15, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'google/gemini-4-neon',
        limit: { context: 1048576, output: 65536 },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: null,
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'], default: 'high' }],
      }),
    'glm-5.3': paygModel('openai-completions', { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 }, {
        canonical_model_id: 'zhipuai/glm-5.3',
        limit: { context: 1_000_000, output: 131072 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'glm-5.3-flash': paygModel('openai-completions', { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 }, {
        canonical_model_id: 'zhipuai/glm-5.3-flash',
        limit: { context: 1_000_000, output: 131072 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'gpt-5': paygModel('openai-responses', { input: 1.07, output: 8.5, cacheRead: 0.107, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
      }),
    'gpt-5-codex': paygModel('openai-responses', { input: 1.07, output: 8.5, cacheRead: 0.107, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5-codex',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gpt-5-nano': paygModel('openai-responses', { input: 0.05, output: 0.4, cacheRead: 0.005, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5-nano',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }],
      }),
    'gpt-5.1': paygModel('openai-responses', { input: 1.07, output: 8.5, cacheRead: 0.107, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.1',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high'] }],
      }),
    'gpt-5.1-codex': paygModel('openai-responses', { input: 1.07, output: 8.5, cacheRead: 0.107, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.1-codex',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gpt-5.1-codex-max': paygModel('openai-responses', { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.1-codex-max',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.1-codex-mini': paygModel('openai-responses', { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.1-codex-mini',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'gpt-5.2': paygModel('openai-responses', { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.2',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.2-codex': paygModel('openai-responses', { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.2-codex',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.3-codex': paygModel('openai-responses', { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.3-codex',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.3-codex-spark': paygModel('openai-responses', { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.3-codex-spark',
        limit: { context: 128_000, input: 128_000, output: 128_000 },
        compat: { sessionAffinityFormat: 'openai-nosession', supportsOpenAIGrammarTools: true },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: null,
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.4': paygModel('openai-responses', {
        input: 2.5,
        output: 15,
        cacheRead: 0.25,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 272_000, input: 5, output: 22.5, cacheRead: 0.5, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'openai/gpt-5.4',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.4-mini': paygModel('openai-responses', { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.4-mini',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.4-nano': paygModel('openai-responses', { input: 0.2, output: 1.25, cacheRead: 0.02, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.4-nano',
        limit: { context: 400_000, input: 272_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.4-pro': paygModel('openai-responses', { input: 30, output: 180, cacheRead: 30, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.4-pro',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.5': paygModel('openai-responses', {
        input: 5,
        output: 30,
        cacheRead: 0.5,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 272_000, input: 10, output: 45, cacheRead: 1, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'openai/gpt-5.5',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.5-pro': paygModel('openai-responses', { input: 30, output: 180, cacheRead: 30, cacheWrite: 0 }, {
        canonical_model_id: 'openai/gpt-5.5-pro',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['medium', 'high', 'xhigh'] }],
      }),
    'gpt-5.6-luna': paygModel('openai-responses', {
        input: 0.2,
        output: 1.2,
        cacheRead: 0.02,
        cacheWrite: 0.25,
        cacheWriteByTtl: { '30m': 0.25, '12h': 0.5 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 0.4,
            output: 1.8,
            cacheRead: 0.04,
            cacheWrite: 0.5,
            cacheWriteByTtl: { '30m': 0.5, '12h': 1 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-5.6-luna',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-5.6-sol': paygModel('openai-responses', {
        input: 4,
        output: 20,
        cacheRead: 0.4,
        cacheWrite: 5,
        cacheWriteByTtl: { '30m': 5, '12h': 10 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 8,
            output: 30,
            cacheRead: 0.8,
            cacheWrite: 10,
            cacheWriteByTtl: { '30m': 10, '12h': 20 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-5.6-sol',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-5.6-terra': paygModel('openai-responses', {
        input: 2,
        output: 12,
        cacheRead: 0.2,
        cacheWrite: 2.5,
        cacheWriteByTtl: { '30m': 2.5, '12h': 5 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 4,
            output: 18,
            cacheRead: 0.4,
            cacheWrite: 5,
            cacheWriteByTtl: { '30m': 5, '12h': 10 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-5.6-terra',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6-astra': paygModel('openai-responses', {
        input: 10,
        output: 50,
        cacheRead: 1,
        cacheWrite: 12.5,
        cacheWriteByTtl: { '30m': 12.5, '12h': 25 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 20,
            output: 75,
            cacheRead: 2,
            cacheWrite: 25,
            cacheWriteByTtl: { '30m': 25, '12h': 50 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6-astra',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6-luna': paygModel('openai-responses', {
        input: 0.1,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite: 0.125,
        cacheWriteByTtl: { '30m': 0.125, '12h': 0.25 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 0.2,
            output: 0.75,
            cacheRead: 0.02,
            cacheWrite: 0.25,
            cacheWriteByTtl: { '30m': 0.25, '12h': 0.5 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6-luna',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6-sol': paygModel('openai-responses', {
        input: 2,
        output: 10,
        cacheRead: 0.2,
        cacheWrite: 2.5,
        cacheWriteByTtl: { '30m': 2.5, '12h': 5 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 4,
            output: 15,
            cacheRead: 0.4,
            cacheWrite: 5,
            cacheWriteByTtl: { '30m': 5, '12h': 10 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6-sol',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6.1-sol': paygModel('openai-responses', {
        input: 2,
        output: 10,
        cacheRead: 0.1,
        cacheWrite: 2.5,
        cacheWriteByTtl: { '30m': 2.5, '12h': 5 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 4,
            output: 15,
            cacheRead: 0.2,
            cacheWrite: 5,
            cacheWriteByTtl: { '30m': 5, '12h': 10 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6.1-sol',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6.2-astra': paygModel('openai-responses', {
        input: 8,
        output: 40,
        cacheRead: 0.4,
        cacheWrite: 10,
        cacheWriteByTtl: { '30m': 10, '12h': 20 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 16,
            output: 60,
            cacheRead: 0.8,
            cacheWrite: 20,
            cacheWriteByTtl: { '30m': 20, '12h': 40 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6.2-astra',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        compat: {
          sessionAffinityFormat: 'openai-nosession',
          supportsAdditionalTools: true,
          supportsMidConvoSystemMessages: true,
          supportsOpenAIGrammarTools: true,
        },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: 'max',
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6.2-sol': paygModel('openai-responses', {
        input: 2,
        output: 10,
        cacheRead: 0.1,
        cacheWrite: 2.5,
        cacheWriteByTtl: { '30m': 2.5, '12h': 5 },
        tiers: [
          {
            inputTokensAbove: 272_000,
            input: 4,
            output: 15,
            cacheRead: 0.2,
            cacheWrite: 5,
            cacheWriteByTtl: { '30m': 5, '12h': 10 },
          },
        ],
      }, {
        canonical_model_id: 'openai/gpt-6.2-sol',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        compat: {
          sessionAffinityFormat: 'openai-nosession',
          supportsAdditionalTools: true,
          supportsMidConvoSystemMessages: true,
          supportsOpenAIGrammarTools: true,
        },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: 'max',
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'grok-4.5': paygModel('openai-responses', {
        input: 2,
        output: 6,
        cacheRead: 0.3,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 200_000, input: 4, output: 12, cacheRead: 0.6, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'xai/grok-4.5',
        limit: { context: 500_000, output: 500_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'grok-4.6': paygModel('openai-responses', {
        input: 2,
        output: 6,
        cacheRead: 0.5,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 200_000, input: 4, output: 12, cacheRead: 1, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'xai/grok-4.6',
        limit: { context: 500_000, output: 500_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'grok-4.7': paygModel('openai-responses', {
        input: 2,
        output: 6,
        cacheRead: 0.5,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 200_000, input: 4, output: 12, cacheRead: 1, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'xai/grok-4.7',
        limit: { context: 500_000, output: 500_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'grok-build-0.1': paygModel('openai-responses', { input: 1, output: 2, cacheRead: 0.2, cacheWrite: 0 }, { canonical_model_id: 'xai/grok-build-0.1', limit: { context: 256_000, output: 256_000 } }),
    'kimi-k2.7-code': paygModel('openai-completions', { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 }, {
        canonical_model_id: 'moonshotai/kimi-k2.7-code',
        limit: { context: 262144, output: 262144 },
        interleaved: { field: 'reasoning_content' },
      }),
    'kimi-k3': paygModel('openai-completions', { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3 }, {
        canonical_model_id: 'moonshotai/kimi-k3',
        limit: { context: 1048576, output: 1048576 },
        thinking_level_map: { high: 'high', low: 'low', max: 'max', medium: null, minimal: null, off: null, xhigh: null },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'kimi-k3.1-pro': paygModel('openai-completions', { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2 }, {
        canonical_model_id: 'moonshotai/kimi-k3.1-pro',
        limit: { context: 1048576, output: 1048576 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsMidConvoSystemMessages: true,
          supportsMidConvoToolAdditions: true,
          supportsStore: false,
          supportsStrictMode: true,
        },
        thinking_level_map: { high: 'high', low: 'low', max: 'max', medium: null, minimal: null, off: null, xhigh: null },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      }),
    'minimax-m2.5': paygModel('openai-completions', { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 }, {
        canonical_model_id: 'minimax/MiniMax-M2.5',
        limit: { context: 204800, output: 131072 },
        interleaved: { field: 'reasoning_content' },
      }),
    'minimax-m2.7': paygModel('openai-completions', { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 }, {
        canonical_model_id: 'minimax/MiniMax-M2.7',
        limit: { context: 204800, output: 131072 },
        interleaved: { field: 'reasoning_content' },
      }),
    'minimax-m3': paygModel('openai-completions', { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 }, {
        canonical_model_id: 'minimax/MiniMax-M3',
        limit: { context: 512_000, output: 128_000 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'toggle' }],
      }),
    'mistral-large-4': paygModel('openai-completions', { input: 1.36, output: 4.18, cacheRead: 0.14, cacheWrite: 0 }, {
        canonical_model_id: 'mistral/mistral-large-4',
        limit: { context: 524288, output: 262144 },
        reasoning_options: [{ type: 'effort', values: ['none', 'high'] }],
      }),
    'muse-ember-1.0': paygModel('openai-responses', {
        input: 0.1,
        output: 0.5,
        cacheRead: 0.004,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 200_000, input: 0.3, output: 1.5, cacheRead: 0.012, cacheWrite: 0 }],
      }, {
        canonical_model_id: 'meta/muse-ember-1.0',
        limit: { context: 1048576, output: 270_000 },
        compat: { sessionAffinityFormat: 'openai-nosession' },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: 'max',
          medium: 'medium',
          minimal: 'minimal',
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'muse-spark-1.2': paygModel('openai-responses', { input: 1.25, output: 4.25, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'meta/muse-spark-1.2',
        limit: { context: 1048576, output: 131072 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'muse-spark-1.3': paygModel('openai-responses', { input: 1.25, output: 4.25, cacheRead: 0.15, cacheWrite: 0 }, {
        canonical_model_id: 'meta/muse-spark-1.3',
        limit: { context: 1048576, output: 131072 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'muse-wonder-1.0': paygModel('openai-responses', { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0 }, {
        canonical_model_id: 'meta/muse-wonder-1.0',
        limit: { context: 1048576, output: 131072 },
        compat: { sessionAffinityFormat: 'openai-nosession' },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: 'max',
          medium: 'medium',
          minimal: 'minimal',
          off: null,
          xhigh: 'xhigh',
        },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'qwen3.5-plus': paygModel('anthropic-messages', { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25 }, {
        canonical_model_id: 'alibaba/qwen3.5-plus',
        limit: { context: 262144, output: 65536 },
        reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens' }],
      }),
    'qwen3.6-plus': paygModel('anthropic-messages', { input: 0.5, output: 3, cacheRead: 0.05, cacheWrite: 0.625 }, {
        canonical_model_id: 'alibaba/qwen3.6-plus',
        limit: { context: 262144, output: 65536 },
        reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens' }],
      }),
    'qwen3.8-flash': paygModel('anthropic-messages', { input: 0.15, output: 0.47, cacheRead: 0.016, cacheWrite: 0.2 }, {
        canonical_model_id: 'alibaba/qwen3.8-flash',
        limit: { context: 1_000_000, output: 131072 },
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['low', 'medium', 'xhigh'] },
          { type: 'budget_tokens' },
        ],
      }),
    'qwen3.8-max': paygModel('openai-completions', { input: 2, output: 6, cacheRead: 0.25, cacheWrite: 2.5 }, {
        canonical_model_id: 'alibaba/qwen3.8-max',
        limit: { context: 262144, output: 131072 },
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['low', 'medium', 'xhigh'] },
          { type: 'budget_tokens', min: 1024 },
        ],
      }),
  },
}

/**
 * OpenCode Go (Subscription) callable chat models, native protocols & thinking efforts.
 * Sources:
 * - https://opencode.ai/docs/console/go
 * - https://opencode.ai/inference/go/v1/models (captured 2026-11-25)
 *
 * Conventions:
 * - Only paid Go-tier chat models callable from external clients are included (27 models);
 *   OpenCode-only free models (`beam-free`, `hy4-flash-free`, `iceman-contributor-free`,
 *   `hungerg-free`) and non-chat models (decision, embedding) are excluded.
 * - Go draws from a monthly subscription allowance rather than pay-as-you-go credits, so V1 cash
 *   `cost` is kept at 0 and V2 sets `billingMode: 'subscription'` in `src/overlays/v2.ts`.
 * - Each model uses its Go-specific native protocol, limits, and reasoning capabilities (for
 *   example `minimax-m3` and `qwen3.8-max` use `anthropic-messages` with 1M context on Go, and
 *   `kimi-k3` exposes `effort: ['max']` on Go).
 */
export const opencodeGoOverlay: ProviderOverlay = {
  providerId: 'opencode-go',
  name: 'OpenCode Go',
  api: OPENCODE_GO_PROTOCOL_ENDPOINTS['openai-completions'],
  endpoints: ['https://opencode.ai/inference/go/v1', 'https://opencode.ai/inference/go'],
  protocolEndpoints: { ...OPENCODE_GO_PROTOCOL_ENDPOINTS },
  env: ['OPENCODE_API_KEY'],
  replaceModels: true,
  models: {
    'claude-haiku-5-5': goModel('anthropic-messages', {
        canonical_model_id: 'anthropic/claude-haiku-5-5',
        limit: { context: 1_000_000, output: 128_000 },
        reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'deepseek-v4-pro': goModel('openai-completions', {
        canonical_model_id: 'deepseek/deepseek-v4-pro',
        limit: { context: 1_000_000, output: 384_000 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['high', 'max'] }],
      }),
    'deepseek-v4.1-flash': goModel('openai-completions', {
        canonical_model_id: 'deepseek/deepseek-v4.1-flash-1017',
        limit: { context: 1_000_000, output: 384_000 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'gemini-4-argon': goModel('google-generative-ai', {
        canonical_model_id: 'google/gemini-4-argon',
        limit: { context: 1048576, output: 65536 },
        thinking_level_map: { high: 'high', low: 'low', max: null, medium: 'medium', minimal: null, off: null, xhigh: null },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
    'glm-5.3': goModel('openai-completions', {
        canonical_model_id: 'zhipuai/glm-5.3',
        limit: { context: 1_000_000, output: 131072 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'glm-5.3-flash': goModel('openai-completions', {
        canonical_model_id: 'zhipuai/glm-5.3-flash',
        limit: { context: 1_000_000, output: 131072 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
      }),
    'gpt-5.6-luna': goModel('openai-responses', {
        canonical_model_id: 'openai/gpt-5.6-luna',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'gpt-6-luna': goModel('openai-responses', {
        canonical_model_id: 'openai/gpt-6-luna',
        limit: { context: 1_050_000, input: 922_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'grok-4.7': goModel('openai-responses', {
        canonical_model_id: 'xai/grok-4.7',
        limit: { context: 500_000, output: 500_000 },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
      }),
    'hy3': goModel('openai-completions', {
        canonical_model_id: 'tencent/hy3',
        limit: { context: 256_000, input: 192_000, output: 128_000 },
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'high'] }],
      }),
    'hy4': goModel('openai-completions', {
        canonical_model_id: 'tencent/hy4',
        limit: { context: 1048576, input: 983040, output: 65536 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsStore: false,
          supportsStrictMode: true,
        },
        thinking_level_map: { high: 'high', low: null, max: null, medium: null, minimal: null, off: 'none', xhigh: null },
        reasoning_options: [{ type: 'effort', values: ['none', 'high'] }],
      }),
    'hy4-preview': goModel('openai-completions', {
        canonical_model_id: 'tencent/hy4-preview',
        limit: { context: 1048576, input: 983040, output: 65536 },
        reasoning_options: [{ type: 'effort', values: ['none', 'high'] }],
      }),
    'kimi-k2.7-code': goModel('openai-completions', {
        canonical_model_id: 'moonshotai/kimi-k2.7-code',
        limit: { context: 262144, output: 262144 },
        interleaved: { field: 'reasoning_content' },
      }),
    'kimi-k3': goModel('openai-completions', {
        canonical_model_id: 'moonshotai/kimi-k3',
        limit: { context: 1048576, output: 1048576 },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['max'] }],
      }),
    'kimi-k3.1-pro': goModel('openai-completions', {
        canonical_model_id: 'moonshotai/kimi-k3.1-pro',
        limit: { context: 1048576, output: 1048576 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsMidConvoSystemMessages: true,
          supportsMidConvoToolAdditions: true,
          supportsStore: false,
          supportsStrictMode: true,
        },
        thinking_level_map: { high: 'high', low: 'low', max: 'max', medium: null, minimal: null, off: null, xhigh: null },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'], default: 'max' }],
      }),
    'longcat-2.5': goModel('openai-completions', {
        canonical_model_id: 'meituan/longcat-2.5',
        limit: { context: 1_000_000, output: 262144 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsStore: false,
          supportsStrictMode: true,
        },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'toggle' }],
      }),
    'mimo-v2.6-flash': goModel('openai-completions', {
        canonical_model_id: 'xiaomi/mimo-v2.6-flash',
        limit: { context: 1048576, output: 131072 },
        interleaved: { field: 'reasoning_content' },
      }),
    'mimo-v2.6-pro': goModel('openai-completions', {
        canonical_model_id: 'xiaomi/mimo-v2.6-pro',
        limit: { context: 1048576, output: 131072 },
        interleaved: { field: 'reasoning_content' },
      }),
    'minimax-m3': goModel('anthropic-messages', {
        canonical_model_id: 'minimax/MiniMax-M3',
        limit: { context: 1_000_000, output: 131072 },
        reasoning_options: [{ type: 'toggle' }],
      }),
    'minimax-m3.1-flash': goModel('openai-completions', {
        canonical_model_id: 'minimax/MiniMax-M3.1-Flash',
        limit: { context: 1_000_000, output: 512_000 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsStore: false,
          supportsStrictMode: true,
        },
        thinking_level_map: {
          high: 'high',
          low: 'low',
          max: 'max',
          medium: 'medium',
          minimal: null,
          off: null,
          xhigh: 'xhigh',
        },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }],
      }),
    'muse-spark-1.2-contributor': goModel('openai-responses', {
        canonical_model_id: 'meta/muse-spark-1.2',
        limit: { context: 1048576, output: 131072 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'muse-spark-1.3-contributor': goModel('openai-responses', {
        canonical_model_id: 'meta/muse-spark-1.3',
        limit: { context: 1048576, output: 131072 },
        reasoning_options: [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high', 'xhigh'] }],
      }),
    'qwen3.7-plus': goModel('anthropic-messages', {
        canonical_model_id: 'alibaba/qwen3.7-plus',
        limit: { context: 1_000_000, output: 65536 },
        reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', max: 262144 }],
      }),
    'qwen3.8-flash': goModel('anthropic-messages', {
        canonical_model_id: 'alibaba/qwen3.8-flash',
        limit: { context: 1_000_000, output: 131072 },
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['low', 'medium', 'xhigh'] },
          { type: 'budget_tokens' },
        ],
      }),
    'qwen3.8-max': goModel('anthropic-messages', {
        canonical_model_id: 'alibaba/qwen3.8-max',
        limit: { context: 1_000_000, output: 131072 },
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['low', 'medium', 'xhigh'] },
          { type: 'budget_tokens', max: 262144 },
        ],
      }),
    'qwen4-max': goModel('anthropic-messages', {
        canonical_model_id: 'alibaba/qwen4-max',
        limit: { context: 1_000_000, output: 262144 },
        thinking_level_map: { xhigh: 'xhigh' },
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['low', 'high', 'xhigh'] },
          { type: 'budget_tokens', max: 262144 },
        ],
      }),
    'step-5-preview': goModel('openai-completions', {
        canonical_model_id: 'stepfun/step-5-preview',
        limit: { context: 1_000_000, input: 1_000_000, output: 65536 },
        compat: {
          maxTokensField: 'max_tokens',
          supportsDeveloperRole: false,
          supportsStore: false,
          supportsStrictMode: true,
        },
        thinking_level_map: { high: 'high', low: 'low', max: null, medium: 'medium', minimal: null, off: null, xhigh: null },
        interleaved: { field: 'reasoning_content' },
        reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
      }),
  },
}
