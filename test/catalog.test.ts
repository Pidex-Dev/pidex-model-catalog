import { describe, expect, test } from 'bun:test'
import { buildCatalog } from '../scripts/build'
import { validateCatalogDocument } from '../scripts/validate'
import { validateOptionSpecs } from '../src/schema/cel-check'
import { validatePricing } from '../src/schema/pricing'
import { withHalfPriceIdle, withOffPeakSchedule } from '../src/schedules/helpers'
import { DEEPSEEK_OFF_PEAK_CN, QIANWEN_OFF_PEAK_CN } from '../src/schedules/templates'
import { EXTRA_RECOMMENDATION_PROVIDERS, MARKET_VISIBLE_PROVIDERS } from '../src/allowlist'

describe('pidex-model-catalog', () => {
  test('DeepSeek half-price idle overlay builds valid pricing', () => {
    const pricing = withHalfPriceIdle(DEEPSEEK_OFF_PEAK_CN, {
      input: 2,
      output: 8,
      cacheRead: 0.04,
      cacheWrite: 0,
      tiers: [{ inputTokensAbove: 128_000, input: 4, output: 12, cacheRead: 0.08, cacheWrite: 0 }],
    })
    const validated = validatePricing(pricing, 'deepseek-test')
    expect(validated.idle.input).toBe(1)
    expect(validated.idle.cacheRead).toBe(0.02)
    expect(validated.idle.tiers?.[0]?.input).toBe(2)
  })

  test('pricing validator rejects duplicate tiers and conflicting busy/idle rules', () => {
    const base = withOffPeakSchedule(DEEPSEEK_OFF_PEAK_CN, {
      busy: {
        input: 2,
        output: 8,
        cacheRead: 0.04,
        cacheWrite: 0,
        tiers: [
          { inputTokensAbove: 128_000, input: 3, output: 10, cacheRead: 0.1, cacheWrite: 0 },
          { inputTokensAbove: 128_000, input: 4, output: 12, cacheRead: 0.2, cacheWrite: 0 },
        ],
      },
      idle: { input: 1, output: 4, cacheRead: 0.02, cacheWrite: 0 },
    })
    expect(() => validatePricing(base)).toThrow('不能重复')

    const conflict = {
      ...DEEPSEEK_OFF_PEAK_CN,
      busy: { input: 2, output: 8, cacheRead: 0.04, cacheWrite: 0 },
      idle: { input: 1, output: 4, cacheRead: 0.02, cacheWrite: 0 },
      rules: [
        ...DEEPSEEK_OFF_PEAK_CN.rules,
        {
          period: 'idle' as const,
          weekdays: [1],
          holiday: 'exclude-cn' as const,
          intervals: [{ start: '10:00', end: '11:00' }],
        },
      ],
    }
    expect(() => validatePricing(conflict)).toThrow('冲突')
  })

  test('CEL option_specs validator accepts valid JSON Merge Patch maps and rejects invalid ones', () => {
    expect(() =>
      validateOptionSpecs(
        {
          reasoningLevel: {
            values: ['low', 'high'],
            map: '{"reasoning_effort": reasoningLevel}',
          },
        },
        'valid-test',
      ),
    ).not.toThrow()

    expect(() =>
      validateOptionSpecs(
        {
          reasoningLevel: {
            values: ['low'],
            map: 'unknownVar()',
          },
        },
        'invalid-test',
      ),
    ).toThrow('Invalid reasoningLevel.map')
  })

  test('full 3-layer catalog build succeeds, passes validation and keeps market isolation', async () => {
    const doc = await buildCatalog()
    const piUpstream = (await Bun.file('src/upstream/pi-models.json').json()) as Record<
      string,
      unknown
    >
    validateCatalogDocument(doc, new Set(Object.keys(piUpstream)))

    const visibleProviders = Object.entries(doc.providers)
      .filter(([, provider]) => provider.marketVisible)
      .map(([id]) => id)
      .sort()
    expect(visibleProviders).toEqual([...MARKET_VISIBLE_PROVIDERS].sort())

    // Hidden Pi providers remain in catalog.providers (marketVisible: false) for smartConfig.
    expect(doc.providers.openai?.marketVisible).toBe(false)
    expect(doc.providers.anthropic?.marketVisible).toBe(false)
    expect(Object.keys(doc.models).length).toBeGreaterThan(100)

    const flash = doc.providers.deepseek?.models['deepseek-flash']
    expect(flash?.pricing?.currency).toBe('CNY')
    expect(flash?.pricing?.idle.input).toBe(1)
    expect(flash?.pricing?.busy.input).toBe(2)
    expect(flash?.reasoning_options).toEqual([
      { type: 'toggle' },
      { type: 'effort', values: ['low', 'high', 'max'], default: 'high' },
    ])

    const minimaxCnM3 = doc.providers['minimax-cn']?.models['MiniMax-M3']
    expect(minimaxCnM3?.pricing?.currency).toBe('CNY')
    expect(minimaxCnM3?.pricing?.idle.input).toBe(2.1)
    expect(minimaxCnM3?.pricing?.idle.tiers?.[0]).toEqual({
      inputTokensAbove: 512_000,
      input: 4.2,
      output: 16.8,
      cacheRead: 0.84,
      cacheWrite: 0,
    })

    const minimaxCnFlash = doc.providers['minimax-cn']?.models['MiniMax-M3.1-Flash']
    expect(minimaxCnFlash?.pi_api).toBe('anthropic-messages')
    expect(minimaxCnFlash?.base_url).toBe('https://api.minimaxi.com/anthropic')
    expect(minimaxCnFlash?.limit?.context).toBe(1_000_000)
    expect(minimaxCnFlash?.pricing?.currency).toBe('CNY')
    expect(minimaxCnFlash?.pricing?.idle.input).toBe(1)
    expect(minimaxCnFlash?.reasoning_options).toEqual([
      { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'max' },
    ])

    const minimaxGlobalFlash = doc.providers.minimax?.models['MiniMax-M3.1-Flash']
    expect(minimaxGlobalFlash?.pricing?.currency).toBe('USD')
    expect(minimaxGlobalFlash?.pricing?.idle.input).toBe(0.15)

    const qianwenCn = doc.providers['qianwen-cn']
    expect(qianwenCn?.marketVisible).toBe(false)
    expect(qianwenCn?.api).toBe('https://maas.qianwenaiapi.com/compatible-mode/v1')
    expect(qianwenCn?.endpoints).toEqual(['https://maas.qianwenaiapi.com/apps/anthropic'])
    expect(qianwenCn?.protocolEndpoints).toEqual({
      'openai-completions': 'https://maas.qianwenaiapi.com/compatible-mode/v1',
      'anthropic-messages': 'https://maas.qianwenaiapi.com/apps/anthropic',
    })
    expect(qianwenCn?.models['deepseek-v4.1-flash']?.pricing).toMatchObject({
      currency: 'CNY',
      timeZone: 'Asia/Shanghai',
      defaultPeriod: 'idle',
      idle: { input: 1, output: 4, cacheRead: 0.02, cacheWrite: null },
      busy: { input: 2, output: 8, cacheRead: 0.04, cacheWrite: null },
      rules: QIANWEN_OFF_PEAK_CN.rules,
    })
    expect(qianwenCn?.models['deepseek-v4-pro-0813']?.pricing).toMatchObject({
      idle: { input: 4.5, output: 13.5, cacheRead: 0.45, cacheWrite: null },
      busy: { input: 9, output: 27, cacheRead: 0.9, cacheWrite: null },
    })
    expect(qianwenCn?.models['qwen3.7-plus']?.pricing?.idle).toEqual({
      input: 2,
      output: 8,
      cacheRead: 0.4,
      cacheWrite: null,
      tiers: [{ inputTokensAbove: 256_000, input: 6, output: 24, cacheRead: 1.2, cacheWrite: null }],
    })
    expect(qianwenCn?.models['qwen3.7-flash']?.pricing?.idle.tiers).toEqual([
      { inputTokensAbove: 32_000, input: 0.6, output: 2.4, cacheRead: 0.12, cacheWrite: null },
      { inputTokensAbove: 256_000, input: 1.2, output: 4.8, cacheRead: 0.24, cacheWrite: null },
    ])
    expect(qianwenCn?.models['qwen3.7-text-embedding-flash']?.type).toBe('embedding')
    expect(qianwenCn?.models['qwen3.7-text-rerank']?.type).toBe('rerank')

    const tokenPlanCn = doc.providers['qwen-token-plan-cn']
    expect(tokenPlanCn?.marketVisible).toBe(false)
    expect(tokenPlanCn?.api).toBe('https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1')
    expect(tokenPlanCn?.endpoints).toEqual([
      'https://token-plan.maas.qianwenaiapi.com/apps/anthropic',
      'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    ])
    expect(tokenPlanCn?.protocolEndpoints).toEqual({
      'openai-completions': 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
      'anthropic-messages': 'https://token-plan.maas.qianwenaiapi.com/apps/anthropic',
    })
    expect(doc.providers.deepseek?.protocolEndpoints).toEqual({
      'openai-completions': 'https://api.deepseek.com',
      'openai-responses': 'https://api.deepseek.com',
      'anthropic-messages': 'https://api.deepseek.com/anthropic',
    })
    expect(doc.providers['minimax-cn']?.protocolEndpoints).toEqual({
      'anthropic-messages': 'https://api.minimaxi.com/anthropic',
      'openai-completions': 'https://api.minimax.cn/v1',
    })
    expect(doc.providers.openai?.protocolEndpoints?.['openai-completions']).toBe(
      'https://api.openai.com/v1',
    )
    expect(doc.providers.google?.protocolEndpoints?.['openai-completions']).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai',
    )
    expect(tokenPlanCn?.models['deepseek-v4.1-flash-1017']?.pricing).toBeUndefined()
    expect(tokenPlanCn?.models['deepseek-v4.1-flash-1017']?.cost).toEqual({
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
    })

    for (const extra of EXTRA_RECOMMENDATION_PROVIDERS) {
      if (doc.providers[extra]) {
        expect(doc.providers[extra].marketVisible).toBe(false)
      }
    }
  })
})
