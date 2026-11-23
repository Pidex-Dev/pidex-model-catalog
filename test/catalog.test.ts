import { describe, expect, test } from 'bun:test'
import { buildCatalog } from '../scripts/build'
import { buildCatalogV2 } from '../scripts/build-v2'
import { validateCatalogDocument } from '../scripts/validate'
import { ModelsV2, ProvidersV2 } from '../src/schema/catalog-v2'
import { validateOptionSpecs } from '../src/schema/cel-check'
import { validatePricing } from '../src/schema/pricing'
import { scaleUnitPrices, withHalfPriceIdle, withOffPeakSchedule } from '../src/schedules/helpers'
import { DEEPSEEK_OFF_PEAK_CN, FLAT_USD, QIANWEN_OFF_PEAK_CN } from '../src/schedules/templates'
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

    const zhipuai = doc.providers.zhipuai
    expect(zhipuai?.marketVisible).toBe(false)
    expect(zhipuai?.api).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(zhipuai?.protocolEndpoints).toEqual({
      'openai-completions': 'https://open.bigmodel.cn/api/paas/v4',
      'openai-responses': 'https://open.bigmodel.cn/api/v1',
      'anthropic-messages': 'https://open.bigmodel.cn/api/anthropic',
    })
    expect(zhipuai?.models['glm-5.3']?.pricing?.busy).toEqual({
      input: 8,
      output: 28,
      cacheRead: 2,
      cacheWrite: 0,
    })
    expect(zhipuai?.models['glm-5.3-flash']?.pricing?.busy).toEqual({
      input: 0.8,
      output: 2.8,
      cacheRead: 0.23,
      cacheWrite: 0,
    })
    expect(zhipuai?.models['glm-5.1']?.pricing?.busy).toEqual({
      input: 6,
      output: 24,
      cacheRead: 1.3,
      cacheWrite: 0,
      tiers: [{ inputTokensAbove: 32_000, input: 8, output: 28, cacheRead: 2, cacheWrite: 0 }],
    })
    expect(zhipuai?.models['glm-5-turbo']?.pricing?.busy).toEqual({
      input: 5,
      output: 22,
      cacheRead: 1.2,
      cacheWrite: 0,
      tiers: [{ inputTokensAbove: 32_000, input: 7, output: 26, cacheRead: 1.8, cacheWrite: 0 }],
    })
    expect(zhipuai?.models['glm-4.7']?.pricing?.busy).toEqual({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
    })
    expect(zhipuai?.models['glm-4.5-air']?.pricing?.busy).toEqual({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
    })

    for (const extra of EXTRA_RECOMMENDATION_PROVIDERS) {
      if (doc.providers[extra]) {
        expect(doc.providers[extra].marketVisible).toBe(false)
      }
    }
  })

  test('catalog v2 speedTiers validates standard, fast and ultrafast while remaining backward compatible', () => {
    const header = {
      owner: 'pidex-model-catalog' as const,
      schemaVersion: 2 as const,
      generatedAt: '2026-11-24T00:00:00.000Z',
      piVersion: '0.99.2',
    }
    const providersParsed = ProvidersV2.parse({
      ...header,
      providers: {
        acme: {
          name: 'Acme',
          marketVisible: false,
          defaultProtocol: 'openai-completions',
          protocolEndpoints: { 'openai-completions': 'https://api.acme.example/v1' },
          models: {
            'acme-pro': {
              modelRef: 'acme/acme-pro',
              speedTiers: {
                standard: { requestModelId: 'acme-pro' },
                fast: { requestModelId: 'acme-pro-fast' },
                ultrafast: { requestModelId: 'acme-pro-ultrafast', payloadPatch: { service_tier: 'ultrafast' } },
              },
            },
            'acme-legacy': {
              modelRef: 'acme/acme-legacy',
              speedTiers: {
                fast: { requestModelId: 'acme-legacy-fast' },
              },
            },
          },
        },
      },
    })
    expect(providersParsed.providers.acme?.models['acme-pro']?.speedTiers?.ultrafast).toEqual({
      requestModelId: 'acme-pro-ultrafast',
      payloadPatch: { service_tier: 'ultrafast' },
    })
    expect(providersParsed.providers.acme?.models['acme-legacy']?.speedTiers?.ultrafast).toBeUndefined()

    const modelsParsed = ModelsV2.parse({
      ...header,
      pricingSchedules: {
        'flat-usd': {
          currency: FLAT_USD.currency,
          timeZone: FLAT_USD.timeZone,
          defaultPeriod: FLAT_USD.defaultPeriod,
          rules: [...FLAT_USD.rules],
          dateOverrides: [...FLAT_USD.dateOverrides],
        },
      },
      models: {
        'acme/acme-pro': {
          id: 'acme/acme-pro',
          name: 'Acme Pro',
          vendor: 'acme',
          type: 'chat',
          providers: {
            acme: {
              available: true,
              providerModelId: 'acme-pro',
              pricing: {
                scheduleId: 'flat-usd',
                busy: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2.5 },
              },
              speedTiers: {
                standard: {
                  label: 'Standard',
                  speedMultiplier: 1,
                  pricing: {
                    scheduleId: 'flat-usd',
                    busy: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2.5 },
                  },
                },
                fast: {
                  label: 'Fast',
                  speedMultiplier: 2,
                  pricing: {
                    scheduleId: 'flat-usd',
                    busy: { input: 4, output: 16, cacheRead: 0.4, cacheWrite: 5 },
                  },
                },
                ultrafast: {
                  label: 'Ultrafast',
                  speedMultiplier: 4,
                  pricing: {
                    scheduleId: 'flat-usd',
                    busy: {
                      input: 8,
                      output: 32,
                      cacheRead: 0.8,
                      cacheWrite: 10,
                      cacheWriteByTtl: { '5m': 10, '1h': 16 },
                    },
                  },
                },
              },
            },
          },
        },
        'acme/acme-legacy': {
          id: 'acme/acme-legacy',
          name: 'Acme Legacy',
          vendor: 'acme',
          type: 'chat',
          providers: {
            acme: {
              available: true,
              providerModelId: 'acme-legacy',
              pricing: {
                scheduleId: 'flat-usd',
                busy: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: 0 },
              },
              speedTiers: {
                fast: {
                  label: 'Fast',
                  pricing: {
                    scheduleId: 'flat-usd',
                    busy: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 0 },
                  },
                },
              },
            },
          },
        },
      },
    })
    expect(
      modelsParsed.models['acme/acme-pro']?.providers.acme?.speedTiers?.ultrafast?.speedMultiplier,
    ).toBe(4)
    expect(
      modelsParsed.models['acme/acme-pro']?.providers.acme?.speedTiers?.ultrafast?.pricing.busy
        ?.cacheWriteByTtl,
    ).toEqual({ '5m': 10, '1h': 16 })
    expect(
      modelsParsed.models['acme/acme-legacy']?.providers.acme?.speedTiers?.ultrafast,
    ).toBeUndefined()
  })

  test('cacheWriteByTtl survives validatePricing and scales correctly with scaleUnitPrices / withHalfPriceIdle', () => {
    const busy = {
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: 3.75,
      cacheWriteByTtl: { '5m': 3.75, '1h': 6, '12h': null },
      tiers: [
        {
          inputTokensAbove: 200_000,
          input: 6,
          output: 22.5,
          cacheRead: 0.6,
          cacheWrite: 7.5,
          cacheWriteByTtl: { '5m': 7.5, '1h': 12, '12h': null },
        },
      ],
    }

    const scaled = scaleUnitPrices(busy, 0.5)
    expect(scaled.cacheWriteByTtl).toEqual({ '5m': 1.875, '1h': 3, '12h': null })
    expect(scaled.tiers?.[0]?.cacheWriteByTtl).toEqual({ '5m': 3.75, '1h': 6, '12h': null })

    const halfPricePricing = withHalfPriceIdle(DEEPSEEK_OFF_PEAK_CN, busy)
    const validated = validatePricing(halfPricePricing, 'ttl-cache-test')
    expect(validated.busy.cacheWriteByTtl).toEqual({ '5m': 3.75, '1h': 6, '12h': null })
    expect(validated.idle.cacheWriteByTtl).toEqual({ '5m': 1.875, '1h': 3, '12h': null })
    expect(validated.busy.tiers?.[0]?.cacheWriteByTtl).toEqual({ '5m': 7.5, '1h': 12, '12h': null })
    expect(validated.idle.tiers?.[0]?.cacheWriteByTtl).toEqual({ '5m': 3.75, '1h': 6, '12h': null })

    // Empty cacheWriteByTtl objects are omitted cleanly; configs without cacheWriteByTtl stay compatible.
    const emptyTtl = validatePricing(
      withOffPeakSchedule(DEEPSEEK_OFF_PEAK_CN, {
        busy: {
          input: 2,
          output: 8,
          cacheRead: 0.2,
          cacheWrite: 0,
          cacheWriteByTtl: {},
          tiers: [
            {
              inputTokensAbove: 128_000,
              input: 4,
              output: 12,
              cacheRead: 0.4,
              cacheWrite: 0,
              cacheWriteByTtl: {},
            },
          ],
        },
        idle: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: 0 },
      }),
      'empty-ttl-test',
    )
    expect(emptyTtl.busy.cacheWriteByTtl).toBeUndefined()
    expect(emptyTtl.busy.tiers?.[0]?.cacheWriteByTtl).toBeUndefined()
    expect(emptyTtl.idle.cacheWriteByTtl).toBeUndefined()
  })
})

test('v2 isolates routes, preserves retired reference prices, and pairs speed invocation with priced offerings', async () => {
  const legacy = await buildCatalog()
  const v2 = buildCatalogV2(legacy)
  const catalog = ProvidersV2.parse(v2.providers)
  const knowledge = ModelsV2.parse(v2.models)
  const tokenPlan = catalog.providers['qwen-token-plan-cn']!
  expect(tokenPlan.models.auto?.modelRef).toBeUndefined()
  expect(tokenPlan.models.auto?.routerFallback?.billingMode).toBe('subscription')
  expect(Object.keys(knowledge.models).some((id) => id.endsWith('/auto'))).toBe(false)
  expect(knowledge.models['minimax/minimax-m2.7']?.referencePricing?.pricing.busy?.input).toBe(0.3)
  expect(catalog.providers['minimax-cn']?.models['MiniMax-M2.7']).toBeUndefined()
  expect(knowledge.models['zhipuai/glm-5.3-flashx']?.id).toBe('zhipuai/glm-5.3-flashx')
  const gateway = catalog.providers['qianwen-cn']!
  const kimiId = 'kimi/kimi-k3.1-pro'
  const fastId = 'kimi/kimi-k3.1-pro-highspeed'
  expect(gateway.models[kimiId]?.speedTiers?.fast?.requestModelId).toBe(fastId)
  expect(gateway.models[fastId]).toBeUndefined()
  expect(knowledge.models['moonshotai/kimi-k3.1-pro']?.providers['qianwen-cn']?.speedTiers?.fast?.pricing.busy?.input).toBe(26)
  expect(legacy.providers['qianwen-cn']?.models[fastId]).toBeDefined()
})
