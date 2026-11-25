import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCatalog } from '../scripts/build'
import { buildCatalogV2, writeCatalogV2 } from '../scripts/build-v2'
import { validateCatalogDocument } from '../scripts/validate'
import { validateCatalogV2 } from '../scripts/validate-v2'
import { ManifestV2, ModelsV2, ProvidersV2, type V2Api } from '../src/schema/catalog-v2'
import { validateOptionSpecs } from '../src/schema/cel-check'
import { validatePricing } from '../src/schema/pricing'
import { scaleUnitPrices, withHalfPriceIdle, withOffPeakSchedule } from '../src/schedules/helpers'
import { DEEPSEEK_OFF_PEAK_CN, FLAT_USD, QIANWEN_OFF_PEAK_CN, QIANWEN_OFF_PEAK_USD } from '../src/schedules/templates'
import { EXTRA_RECOMMENDATION_PROVIDERS, MARKET_VISIBLE_PROVIDERS } from '../src/allowlist'
import { providerRules } from '../src/overlays/v2'

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

    const v4Pro = doc.providers.deepseek?.models['deepseek-v4-pro']
    expect(v4Pro?.reasoning_options).toEqual([
      { type: 'toggle' },
      { type: 'effort', values: ['low', 'high', 'max'], default: 'high' },
    ])
    expect(v4Pro?.thinking_level_map).toEqual({
      high: 'high',
      low: 'low',
      max: 'max',
      medium: null,
      minimal: null,
    })

    const minimaxCnM3 = doc.providers['minimax-cn']?.models['MiniMax-M3']
    expect(minimaxCnM3?.base_url).toBe('https://api.minimax.cn/anthropic')
    expect(minimaxCnM3?.limit).toEqual({ context: 1_000_000, output: 524_288 })
    expect(minimaxCnM3?.modalities?.input).toEqual(['text', 'image', 'video'])
    expect(minimaxCnM3?.interleaved).toEqual({ field: 'reasoning_content' })
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
    expect(minimaxCnFlash?.base_url).toBe('https://api.minimax.cn/anthropic')
    expect(minimaxCnFlash?.limit).toEqual({ context: 1_000_000, output: 524_288 })
    expect(minimaxCnFlash?.modalities?.input).toEqual(['text', 'image', 'video'])
    expect(minimaxCnFlash?.interleaved).toEqual({ field: 'reasoning_content' })
    expect(minimaxCnFlash?.compat).toEqual({ forceAdaptiveThinking: true })
    expect(minimaxCnFlash?.thinking_level_map).toEqual({
      off: null,
      minimal: null,
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
      max: 'max',
    })
    expect(minimaxCnFlash?.pricing?.currency).toBe('CNY')
    expect(minimaxCnFlash?.pricing?.idle.input).toBe(1)
    expect(minimaxCnFlash?.reasoning_options).toEqual([
      { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'max' },
    ])

    const minimaxGlobalFlash = doc.providers.minimax?.models['MiniMax-M3.1-Flash']
    expect(minimaxGlobalFlash?.pricing?.currency).toBe('USD')
    expect(minimaxGlobalFlash?.pricing?.idle.input).toBe(0.15)

    const moonshotCn = doc.providers['moonshotai-cn']
    expect(moonshotCn?.marketVisible).toBe(true)
    expect(moonshotCn?.protocolEndpoints).toEqual({
      'openai-completions': 'https://api.moonshot.cn/v1',
      'openai-responses': 'https://api.moonshot.cn/v1',
      'anthropic-messages': 'https://api.moonshot.cn/anthropic',
    })
    expect(moonshotCn?.models['kimi-k3.1-pro']?.pricing?.currency).toBe('CNY')
    expect(moonshotCn?.models['kimi-k3.1-pro']?.pricing?.busy).toEqual({
      input: 13,
      output: 68,
      cacheRead: 1.3,
      cacheWrite: 13,
      cacheWriteByTtl: { '5m': 13, '1h': 26 },
    })
    expect(moonshotCn?.models['kimi-k3.1-pro']?.modalities?.input).toContain('video')
    expect(moonshotCn?.models['kimi-k3.1-pro']?.reasoning_options).toEqual([
      { type: 'effort', values: ['low', 'high', 'max'], default: 'max' },
    ])
    expect(moonshotCn?.models['kimi-k3.1-pro-highspeed']?.pricing?.busy).toEqual({
      input: 26,
      output: 136,
      cacheRead: 1.3,
      cacheWrite: 26,
      cacheWriteByTtl: { '5m': 26, '1h': 52 },
    })
    expect(moonshotCn?.models['kimi-k3']?.pricing?.busy).toEqual({
      input: 20,
      output: 100,
      cacheRead: 2,
      cacheWrite: 20,
      cacheWriteByTtl: { '5m': 20, '1h': 40 },
    })
    expect(moonshotCn?.models['kimi-k2.7-code']?.pricing?.busy).toEqual({
      input: 6.5,
      output: 27,
      cacheRead: 1.3,
      cacheWrite: 0,
    })
    expect(moonshotCn?.models['kimi-k2.6']?.pricing?.busy).toEqual({
      input: 6.5,
      output: 27,
      cacheRead: 1.1,
      cacheWrite: 0,
    })

    const moonshotGlobal = doc.providers.moonshotai
    expect(moonshotGlobal?.marketVisible).toBe(true)
    expect(moonshotGlobal?.protocolEndpoints).toEqual({
      'openai-completions': 'https://api.moonshot.ai/v1',
      'openai-responses': 'https://api.moonshot.ai/v1',
      'anthropic-messages': 'https://api.moonshot.ai/anthropic',
    })
    expect(moonshotGlobal?.models['kimi-k3.1-pro']?.pricing?.currency).toBe('USD')
    expect(moonshotGlobal?.models['kimi-k3.1-pro']?.pricing?.busy).toEqual({
      input: 2,
      output: 10,
      cacheRead: 0.2,
      cacheWrite: 2,
      cacheWriteByTtl: { '5m': 2, '1h': 4 },
    })
    expect(moonshotGlobal?.models['kimi-k3.1-pro-highspeed']?.pricing?.busy).toEqual({
      input: 4,
      output: 20,
      cacheRead: 0.2,
      cacheWrite: 4,
      cacheWriteByTtl: { '5m': 4, '1h': 8 },
    })
    expect(moonshotGlobal?.models['kimi-k3']?.pricing?.busy).toEqual({
      input: 3,
      output: 15,
      cacheRead: 0.3,
      cacheWrite: 3,
      cacheWriteByTtl: { '5m': 3, '1h': 6 },
    })
    expect(moonshotGlobal?.models['kimi-k2.7-code']?.pricing?.busy).toEqual({
      input: 0.95,
      output: 4,
      cacheRead: 0.19,
      cacheWrite: 0,
    })
    expect(moonshotGlobal?.models['kimi-k2.6']?.pricing?.busy).toEqual({
      input: 0.95,
      output: 4,
      cacheRead: 0.16,
      cacheWrite: 0,
    })

    const qianwenCn = doc.providers['qianwen-cn']
    expect(qianwenCn?.marketVisible).toBe(true)
    expect(qianwenCn?.api).toBe('https://maas.qianwenaiapi.com/compatible-mode/v1')
    expect(qianwenCn?.endpoints).toEqual(['https://maas.qianwenaiapi.com/apps/anthropic'])
    expect(qianwenCn?.protocolEndpoints).toEqual({
      'openai-completions': 'https://maas.qianwenaiapi.com/compatible-mode/v1',
      'openai-responses': 'https://maas.qianwenaiapi.com/compatible-mode/v1',
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
    expect(qianwenCn?.models['qwen4-max']?.reasoning).toBe(true)
    expect(qianwenCn?.models['qwen4-max']?.reasoning_options).toEqual([
      { type: 'toggle' },
      { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
    ])
    expect(qianwenCn?.models['qwen3.7-text-embedding-flash']?.type).toBe('embedding')
    expect(qianwenCn?.models['qwen3.7-text-rerank']?.type).toBe('rerank')

    const tokenPlanCn = doc.providers['qwen-token-plan-cn']
    expect(tokenPlanCn?.marketVisible).toBe(true)
    expect(tokenPlanCn?.api).toBe('https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1')
    expect(tokenPlanCn?.endpoints).toEqual([
      'https://token-plan.maas.qianwenaiapi.com/apps/anthropic',
      'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    ])
    expect(tokenPlanCn?.protocolEndpoints).toEqual({
      'openai-completions': 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
      'openai-responses': 'https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1',
      'anthropic-messages': 'https://token-plan.maas.qianwenaiapi.com/apps/anthropic',
    })
    expect(tokenPlanCn?.models['qwen4-max']?.reasoning).toBe(true)
    expect(tokenPlanCn?.models['qwen4-max']?.reasoning_options).toEqual([
      { type: 'toggle' },
      { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
    ])
    expect(tokenPlanCn?.models['qwen4-max-preview']?.reasoning_options).toBeUndefined()
    expect(doc.providers.deepseek?.protocolEndpoints).toEqual({
      'openai-completions': 'https://api.deepseek.com',
      'openai-responses': 'https://api.deepseek.com',
      'anthropic-messages': 'https://api.deepseek.com/anthropic',
    })
    expect(doc.providers['minimax-cn']?.protocolEndpoints).toEqual({
      'anthropic-messages': 'https://api.minimax.cn/anthropic',
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
  expect(gateway.marketVisible).toBe(true)
  expect(gateway.defaultProtocol).toBe('openai-completions')
  expect(gateway.models['qwen4-max']?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(gateway.models[kimiId]?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(gateway.models['qwen3.7-text-embedding-flash']?.supportedProtocols).toBeUndefined()
  expect(tokenPlan.marketVisible).toBe(true)
  expect(tokenPlan.models.auto?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(tokenPlan.models['decision-model-preview']?.supportedProtocols).toEqual(['openai-completions'])
  expect(tokenPlan.models['qwen4-max']?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(gateway.models[kimiId]?.speedTiers?.fast?.requestModelId).toBe(fastId)
  expect(gateway.models[fastId]).toBeUndefined()
  expect(knowledge.models['moonshotai/kimi-k3.1-pro']?.providers['qianwen-cn']?.speedTiers?.fast?.pricing.busy?.input).toBe(26)
  expect(legacy.providers['qianwen-cn']?.models[fastId]).toBeDefined()

  for (const [providerId, modelIds, protocols] of [
    ['deepseek', ['deepseek-flash', 'deepseek-v4-pro'], ['openai-completions', 'openai-responses', 'anthropic-messages']],
    ['minimax', ['MiniMax-M3.1-Flash', 'MiniMax-M3'], ['anthropic-messages', 'openai-completions']],
    ['minimax-cn', ['MiniMax-M3.1-Flash', 'MiniMax-M3'], ['anthropic-messages', 'openai-completions']],
  ] as const) {
    const provider = catalog.providers[providerId]!
    expect(provider.marketVisible).toBe(true)
    for (const id of modelIds) {
      expect(provider.models[id]?.supportedProtocols).toEqual([...protocols])
    }
  }
  expect(catalog.providers['minimax-cn']?.endpointAliases).toContain('https://api.minimaxi.com/v1')
  expect(catalog.providers['minimax-cn']?.endpointAliases).toContain(
    'https://api.minimaxi.com/anthropic',
  )
  for (const binding of Object.values(catalog.providers['minimax-cn']!.models)) {
    expect(binding.baseUrl).toBeUndefined()
  }
  for (const binding of Object.values(tokenPlan.models)) {
    expect(binding.baseUrl).toBeUndefined()
  }
  expect(catalog.providers.deepseek?.models['deepseek-v4-pro']?.thinkingLevelMap?.low).toBe('low')
  expect(
    knowledge.models['alibaba/qwen4-max']?.providers['qianwen-cn']?.overrides?.reasoning_options,
  ).toEqual([
    { type: 'toggle' },
    { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
  ])
  expect(
    knowledge.models['alibaba/qwen4-max']?.providers['qwen-token-plan-cn']?.overrides
      ?.reasoning_options,
  ).toEqual([
    { type: 'toggle' },
    { type: 'effort', values: ['low', 'high', 'xhigh'], default: 'high' },
  ])
  expect(
    knowledge.models['alibaba/qwen4-max']?.providers['qwen-token-plan-cn']?.modelOverrides?.[
      'qwen4-max-preview'
    ]?.overrides?.reasoning_options,
  ).toBeUndefined()
  expect(catalog.providers['minimax-cn']?.models['MiniMax-M3.1-Flash']?.thinkingLevelMap).toEqual({
    off: null,
    minimal: null,
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
    max: 'max',
  })
  expect(knowledge.models['minimax/minimax-m3']?.providers['minimax-cn']?.overrides?.modalities).toBeUndefined()
  expect(knowledge.models['minimax/minimax-m3']?.providers['minimax-cn']?.overrides?.limit).toBeUndefined()
  expect(knowledge.models['minimax/minimax-m3.1-flash']?.providers['minimax-cn']?.overrides?.limit).toBeUndefined()
  expect(knowledge.models['deepseek/deepseek-v4.1-flash-1017']?.providers.deepseek?.reasoningCost).toBeUndefined()
  expect(knowledge.models['deepseek/deepseek-v4-pro-0813']?.providers.deepseek?.reasoningCost).toBeUndefined()

  for (const pid of ['moonshotai-cn', 'moonshotai'] as const) {
    const provider = catalog.providers[pid]!
    expect(provider.marketVisible).toBe(true)
    expect(provider.defaultProtocol).toBe('openai-completions')
    expect(provider.models['kimi-k3.1-pro']?.supportedProtocols).toEqual([
      'openai-completions',
      'openai-responses',
      'anthropic-messages',
    ])
    expect(provider.models['kimi-k3']?.supportedProtocols).toEqual([
      'openai-completions',
      'openai-responses',
      'anthropic-messages',
    ])
    expect(provider.models['kimi-k2.7-code']?.supportedProtocols).toEqual(['openai-completions'])
    expect(provider.models['kimi-k2.6']?.supportedProtocols).toEqual(['openai-completions'])
    expect(provider.models['kimi-k3.1-pro']?.speedTiers?.fast?.requestModelId).toBe(
      'kimi-k3.1-pro-highspeed',
    )
    expect(provider.models['kimi-k3.1-pro-highspeed']).toBeUndefined()
    expect(provider.models['kimi-k2.7-code']?.speedTiers?.fast?.requestModelId).toBe(
      'kimi-k2.7-code-highspeed',
    )
    expect(provider.models['kimi-k2.7-code-highspeed']).toBeUndefined()
  }
  const k31Pro = knowledge.models['moonshotai/kimi-k3.1-pro']!
  expect(k31Pro.referencePricing?.sourceProviderId).toBe('moonshotai')
  expect(k31Pro.referencePricing?.pricing.busy?.cacheWriteByTtl).toEqual({ '5m': 2, '1h': 4 })
  expect(k31Pro.providers['moonshotai-cn']?.speedTiers?.fast?.pricing.busy?.cacheWriteByTtl).toEqual(
    { '5m': 26, '1h': 52 },
  )
  expect(k31Pro.providers.moonshotai?.speedTiers?.fast?.pricing.busy?.cacheWriteByTtl).toEqual({
    '5m': 4,
    '1h': 8,
  })
})

test('v2 rejects invalid market protocol declarations after verifying artifact checksums', async () => {
  const legacy = await buildCatalog()
  const directory = await mkdtemp(join(tmpdir(), 'pidex-catalog-test-'))
  const providersPath = join(directory, 'providers.json')
  const modelsPath = join(directory, 'models.json')
  const manifestPath = join(directory, 'manifest.json')
  try {
    await writeCatalogV2(directory, legacy, undefined)
    await validateCatalogV2(directory)
    const providers = ProvidersV2.parse(await Bun.file(providersPath).json())
    const manifest = ManifestV2.parse(await Bun.file(manifestPath).json())
    const binding = providers.providers.deepseek!.models['deepseek-flash']!
    const cases: [V2Api[] | undefined, string][] = [
      [['openai-responses', 'openai-completions'], 'must start with the effective default protocol'],
      [['openai-completions', 'openai-completions'], 'contains duplicate protocols'],
      [['openai-completions', 'google-generative-ai'], 'references unconfigured protocol'],
      [[], 'must not be empty'],
      [undefined, 'market chat models must declare supportedProtocols'],
    ]
    for (const [protocols, error] of cases) {
      binding.supportedProtocols = protocols
      const json = JSON.stringify(providers)
      manifest.files.providers.bytes = Buffer.byteLength(json)
      manifest.files.providers.sha256 = createHash('sha256').update(json).digest('hex')
      await Bun.write(providersPath, json)
      await Bun.write(manifestPath, JSON.stringify(manifest))
      await expect(validateCatalogV2(directory)).rejects.toThrow(error)
    }
  } finally {
    await Promise.allSettled([providersPath, modelsPath, manifestPath].map((path) => unlink(path)))
    await rmdir(directory)
  }
})

test('v2 build rejects orphan, speed-tier, and unknown-provider supportedProtocols rules', async () => {
  const legacy = await buildCatalog()

  const missingModel = structuredClone(legacy)
  delete missingModel.providers.deepseek!.models['deepseek-flash']
  expect(() => buildCatalogV2(missingModel)).toThrow(
    'supportedProtocols references unknown model: deepseek/deepseek-flash',
  )

  const withSpeedTierKey = {
    ...providerRules,
    moonshotai: {
      ...providerRules.moonshotai,
      supportedProtocols: {
        ...providerRules.moonshotai?.supportedProtocols,
        'kimi-k3.1-pro-highspeed': ['openai-completions'] as const,
      },
    },
  }
  expect(() => buildCatalogV2(legacy, undefined, withSpeedTierKey)).toThrow(
    'supportedProtocols must not target speed-tier model: moonshotai/kimi-k3.1-pro-highspeed',
  )

  const withUnknownProvider = {
    ...providerRules,
    'nonexistent-provider': {
      supportedProtocols: {
        'ghost-model': ['openai-completions'] as const,
      },
    },
  }
  expect(() => buildCatalogV2(legacy, undefined, withUnknownProvider)).toThrow(
    'supportedProtocols references unknown provider: nonexistent-provider',
  )
})

test('QwenCloud 6 regions and Singapore Token Plan build with regional pricing, schedules, and endpoints', async () => {
  const legacy = await buildCatalog()
  const v2 = buildCatalogV2(legacy)
  const catalog = ProvidersV2.parse(v2.providers)
  const knowledge = ModelsV2.parse(v2.models)

  expect(knowledge.pricingSchedules['qianwen-off-peak-usd']).toEqual({
    currency: 'USD',
    timeZone: 'Asia/Shanghai',
    defaultPeriod: 'idle',
    rules: [...QIANWEN_OFF_PEAK_USD.rules.map((r) => ({ ...r, weekdays: [...r.weekdays], intervals: r.intervals.map((i) => ({ ...i })) }))],
    dateOverrides: [],
  })

  const expectedRegions = [
    ['qwencloud-singapore', 'QwenCloud (Singapore)', 'ap-southeast-1'],
    ['qwencloud-beijing', 'QwenCloud (Beijing)', 'cn-beijing'],
    ['qwencloud-virginia', 'QwenCloud (US Virginia)', 'us-east-1'],
    ['qwencloud-frankfurt', 'QwenCloud (Frankfurt)', 'eu-central-1'],
    ['qwencloud-hongkong', 'QwenCloud (Hong Kong)', 'cn-hongkong'],
    ['qwencloud-tokyo', 'QwenCloud (Tokyo)', 'ap-northeast-1'],
  ] as const

  for (const [providerId, name, regionCode] of expectedRegions) {
    const provider = catalog.providers[providerId]!
    expect(provider).toBeDefined()
    expect(provider.name).toBe(name)
    expect(provider.marketVisible).toBe(true)
    expect(provider.defaultProtocol).toBe('openai-completions')
    expect(provider.protocolEndpoints).toEqual({
      'openai-completions': `https://${regionCode}.maas.qwencloudapi.com/compatible-mode/v1`,
      'openai-responses': `https://${regionCode}.maas.qwencloudapi.com/compatible-mode/v1`,
      'anthropic-messages': `https://${regionCode}.maas.qwencloudapi.com/apps/anthropic`,
    })
    expect(provider.models['qwen4-max']?.supportedProtocols).toEqual([
      'openai-completions',
      'openai-responses',
      'anthropic-messages',
    ])
  }

  expect(catalog.providers['qwencloud-singapore']?.endpointAliases).toEqual([
    'https://maas.qwencloudapi.com/compatible-mode/v1',
    'https://maas.qwencloudapi.com/apps/anthropic',
  ])

  // Verify regional pricing & cacheWriteByTtl differences.
  const qwen4 = knowledge.models['alibaba/qwen4-max']!
  expect(qwen4.providers['qwencloud-singapore']?.pricing?.busy).toEqual({
    input: 1.5,
    output: 4.5,
    cacheRead: 0.075,
    cacheWrite: 1.875,
    cacheWriteByTtl: { '5m': 1.875, '1h': 3 },
  })
  expect(qwen4.providers['qwencloud-beijing']?.pricing?.busy).toEqual({
    input: 1.413,
    output: 4.24,
    cacheRead: 0.071,
    cacheWrite: 1.767,
    cacheWriteByTtl: { '5m': 1.767, '1h': 2.827 },
  })
  expect(qwen4.providers['qwencloud-virginia']?.pricing?.busy).toEqual(
    qwen4.providers['qwencloud-beijing']?.pricing?.busy,
  )

  // Verify Tokyo special Global-scope input tariff for qwen3.6-plus.
  const qwen36Plus = knowledge.models['alibaba/qwen3.6-plus']!
  expect(qwen36Plus.providers['qwencloud-tokyo']?.pricing?.busy).toEqual({
    input: 0.5,
    output: 1.651,
    cacheRead: 0.1,
    cacheWrite: null,
    tiers: [{ inputTokensAbove: 256_000, input: 2, output: 6.602, cacheRead: 0.4, cacheWrite: null }],
  })
  expect(qwen36Plus.providers['qwencloud-beijing']?.pricing?.busy?.input).toBe(0.276)

  // Verify DeepSeek V4 peak/off-peak USD schedule compaction.
  const ds41 = knowledge.models['deepseek/deepseek-v4.1-flash']!
  expect(ds41.providers['qwencloud-singapore']?.pricing).toEqual({
    scheduleId: 'qianwen-off-peak-usd',
    busy: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: null },
    idle: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: null },
  })
  expect(ds41.providers['qwencloud-beijing']?.pricing).toEqual({
    scheduleId: 'qianwen-off-peak-usd',
    busy: { input: 0.283, output: 1.131, cacheRead: 0.006, cacheWrite: null },
    idle: { input: 0.1415, output: 0.5655, cacheRead: 0.003, cacheWrite: null },
  })

  // Verify regional availability differences & text-only scope.
  expect(catalog.providers['qwencloud-hongkong']?.models['deepseek-v4-pro']).toBeUndefined()
  expect(catalog.providers['qwencloud-hongkong']?.models['glm-5.1']).toBeUndefined()
  expect(catalog.providers['qwencloud-tokyo']?.models['glm-5.2']).toBeUndefined()
  expect(catalog.providers['qwencloud-beijing']?.models['MiniMax-M2.5']).toBeDefined()
  expect(catalog.providers['qwencloud-singapore']?.models['mindlab/macaron-v1.1-venti-pro']).toBeDefined()
  expect(catalog.providers['qwencloud-singapore']?.models['text-embedding-v4']).toBeUndefined()

  // Verify QwenCloud Token Plan (Singapore) overrides Pi built-in `qwen-token-plan`.
  const tokenPlan = catalog.providers['qwen-token-plan']!
  expect(tokenPlan.name).toBe('QwenCloud Token Plan (Singapore)')
  expect(tokenPlan.marketVisible).toBe(true)
  expect(tokenPlan.billingMode).toBe('subscription')
  expect(tokenPlan.protocolEndpoints).toEqual({
    'openai-completions': 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    'openai-responses': 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    'anthropic-messages': 'https://token-plan.maas.qwencloudapi.com/apps/anthropic',
  })
  expect(tokenPlan.endpointAliases).toContain(
    'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
  )
  expect(tokenPlan.models.auto?.routerFallback?.billingMode).toBe('subscription')
  expect(tokenPlan.models['qwen4-max']?.modelRef).toBe('alibaba/qwen4-max')
  // No inherited Pi model should keep stale aliyuncs baseUrl override.
  for (const binding of Object.values(tokenPlan.models)) {
    expect(binding.baseUrl).toBeUndefined()
  }
})

test('Xiaomi pay-as-you-go & regional Token Plans exclude retired V2.5 from providers while keeping them deprecated in models', async () => {
  const legacy = await buildCatalog()
  const v2 = buildCatalogV2(legacy)
  const catalog = ProvidersV2.parse(v2.providers)
  const knowledge = ModelsV2.parse(v2.models)

  const xiaomi = catalog.providers.xiaomi!
  expect(xiaomi.name).toBe('Xiaomi MiMo')
  expect(xiaomi.marketVisible).toBe(true)
  expect(xiaomi.billingMode).toBeUndefined()
  expect(xiaomi.defaultProtocol).toBe('openai-completions')
  expect(xiaomi.protocolEndpoints).toEqual({
    'openai-completions': 'https://api.xiaomimimo.com/v1',
    'openai-responses': 'https://api.xiaomimimo.com/v1',
    'anthropic-messages': 'https://api.xiaomimimo.com/anthropic',
  })
  expect(Object.keys(xiaomi.models).sort()).toEqual(['mimo-v2.6-flash', 'mimo-v2.6-pro'])
  expect(xiaomi.models['mimo-v2.5']).toBeUndefined()
  expect(xiaomi.models['mimo-v2.5-pro']).toBeUndefined()
  expect(xiaomi.models['mimo-v2.5-pro-ultraspeed']).toBeUndefined()
  expect(xiaomi.models['mimo-v2.6-pro']?.speedTiers?.ultrafast?.requestModelId).toBe(
    'mimo-v2.6-pro-ultraspeed',
  )
  expect(xiaomi.models['mimo-v2.6-pro']?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])

  const v26Pro = knowledge.models['xiaomi/mimo-v2.6-pro']!
  expect(v26Pro.reasoning_options).toEqual([{ type: 'toggle' }])
  expect(v26Pro.providers.xiaomi?.pricing?.busy).toEqual({
    input: 0.435,
    output: 0.87,
    cacheRead: 0.0036,
    cacheWrite: 0,
  })
  expect(v26Pro.providers.xiaomi?.speedTiers?.ultrafast?.pricing.busy).toEqual({
    input: 4.35,
    output: 8.7,
    cacheRead: 0.036,
    cacheWrite: 0,
  })
  expect(knowledge.models['xiaomi/mimo-v2.6-flash']?.providers.xiaomi?.pricing?.busy).toEqual({
    input: 0.14,
    output: 0.28,
    cacheRead: 0.0028,
    cacheWrite: 0,
  })

  const xiaomiCn = catalog.providers['xiaomi-cn']!
  expect(xiaomiCn.name).toBe('Xiaomi MiMo (China)')
  expect(xiaomiCn.marketVisible).toBe(true)
  expect(xiaomiCn.billingMode).toBeUndefined()
  expect(xiaomiCn.protocolEndpoints).toEqual({
    'openai-completions': 'https://api.xiaomimimo.com/v1',
    'openai-responses': 'https://api.xiaomimimo.com/v1',
    'anthropic-messages': 'https://api.xiaomimimo.com/anthropic',
  })
  expect(Object.keys(xiaomiCn.models).sort()).toEqual(['mimo-v2.6-flash', 'mimo-v2.6-pro'])
  expect(xiaomiCn.models['mimo-v2.6-pro']?.speedTiers?.ultrafast?.requestModelId).toBe(
    'mimo-v2.6-pro-ultraspeed',
  )
  expect(v26Pro.providers['xiaomi-cn']?.pricing).toEqual({
    scheduleId: 'flat-cny',
    busy: { input: 3, output: 6, cacheRead: 0.025, cacheWrite: 0 },
  })
  expect(v26Pro.providers['xiaomi-cn']?.speedTiers?.ultrafast?.pricing).toEqual({
    scheduleId: 'flat-cny',
    busy: { input: 30, output: 60, cacheRead: 0.25, cacheWrite: 0 },
  })
  expect(knowledge.models['xiaomi/mimo-v2.6-flash']?.providers['xiaomi-cn']?.pricing).toEqual({
    scheduleId: 'flat-cny',
    busy: { input: 1, output: 2, cacheRead: 0.02, cacheWrite: 0 },
  })

  // Retired V2.5 models remain in canonical models.json as deprecated with historical USD reference pricing.
  for (const [id, input] of [
    ['xiaomi/mimo-v2.5', 0.14],
    ['xiaomi/mimo-v2.5-pro', 0.435],
    ['xiaomi/mimo-v2.5-pro-ultraspeed', 1.305],
  ] as const) {
    const retired = knowledge.models[id]!
    expect(retired).toBeDefined()
    expect(retired.status).toBe('deprecated')
    expect(retired.providers.xiaomi).toBeUndefined()
    expect(retired.providers['xiaomi-token-plan-cn']).toBeUndefined()
    expect(retired.providers['xiaomi-token-plan-sgp']).toBeUndefined()
    expect(retired.providers['xiaomi-token-plan-ams']).toBeUndefined()
    expect(retired.referencePricing?.sourceProviderId).toBe('xiaomi')
    expect(retired.referencePricing?.pricing.busy?.input).toBe(input)
  }

  for (const [providerId, host, scheduleId] of [
    ['xiaomi-token-plan-cn', 'token-plan-cn.xiaomimimo.com', 'flat-cny'],
    ['xiaomi-token-plan-sgp', 'token-plan-sgp.xiaomimimo.com', 'flat-usd'],
    ['xiaomi-token-plan-ams', 'token-plan-ams.xiaomimimo.com', 'flat-usd'],
  ] as const) {
    const plan = catalog.providers[providerId]!
    expect(plan.marketVisible).toBe(true)
    expect(plan.billingMode).toBe('subscription')
    expect(plan.protocolEndpoints).toEqual({
      'openai-completions': `https://${host}/v1`,
      'openai-responses': `https://${host}/v1`,
      'anthropic-messages': `https://${host}/anthropic`,
    })
    expect(Object.keys(plan.models).sort()).toEqual(['mimo-v2.6-flash', 'mimo-v2.6-pro'])
    expect(plan.models['mimo-v2.6-pro']?.speedTiers?.ultrafast?.requestModelId).toBe(
      'mimo-v2.6-pro-ultraspeed',
    )
    expect(v26Pro.providers[providerId]?.pricing).toEqual({
      billingMode: 'subscription',
      scheduleId,
    })
    expect(v26Pro.providers[providerId]?.speedTiers?.ultrafast?.pricing).toEqual({
      billingMode: 'subscription',
      scheduleId,
    })
    for (const binding of Object.values(plan.models)) {
      expect(binding.baseUrl).toBeUndefined()
    }
  }
})

test('Z.AI Global & China Coding Plans include GLM-5.4, keep callable legacy/highspeed models, and enforce subscription isolation', async () => {
  const legacy = await buildCatalog()
  const v2 = buildCatalogV2(legacy)
  const catalog = ProvidersV2.parse(v2.providers)
  const knowledge = ModelsV2.parse(v2.models)

  const zaiGlobal = catalog.providers.zai!
  expect(zaiGlobal.name).toBe('Z.AI Coding Plan (Global)')
  expect(zaiGlobal.marketVisible).toBe(true)
  expect(zaiGlobal.billingMode).toBe('subscription')
  expect(zaiGlobal.protocolEndpoints).toEqual({
    'openai-completions': 'https://api.z.ai/api/coding/paas/v4',
    'openai-responses': 'https://api.z.ai/api/v1',
    'anthropic-messages': 'https://api.z.ai/api/anthropic',
  })
  expect(zaiGlobal.models['glm-5.4']?.modelRef).toBe('zhipuai/glm-5.4')
  expect(zaiGlobal.models['glm-5.4']?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(zaiGlobal.models['glm-5.3']?.speedTiers?.fast?.requestModelId).toBe('glm-5.3-highspeed')
  expect(zaiGlobal.models['glm-5.3-highspeed']).toBeUndefined()
  expect(zaiGlobal.models['glm-5.2']?.speedTiers?.fast?.requestModelId).toBe('glm-5.2-highspeed')
  expect(zaiGlobal.models['glm-5.2-highspeed']).toBeUndefined()

  const zaiCn = catalog.providers['zai-coding-cn']!
  expect(zaiCn.name).toBe('Z.AI Coding Plan (China)')
  expect(zaiCn.marketVisible).toBe(true)
  expect(zaiCn.billingMode).toBe('subscription')
  expect(zaiCn.protocolEndpoints).toEqual({
    'openai-completions': 'https://open.bigmodel.cn/api/coding/paas/v4',
    'openai-responses': 'https://open.bigmodel.cn/api/v1',
    'anthropic-messages': 'https://open.bigmodel.cn/api/anthropic',
  })
  expect(Object.keys(zaiCn.models).sort()).toEqual(['glm-4.6v', 'glm-5.3', 'glm-5.3-flash', 'glm-5.4'])
  expect(zaiCn.models['glm-5.3']?.speedTiers?.fast?.requestModelId).toBe('glm-5.3-highspeed')
  expect(zaiCn.models['glm-4.6v']?.modelRef).toBe('zhipuai/glm-4.6v')

  const glm54 = knowledge.models['zhipuai/glm-5.4']!
  expect(glm54.limit).toEqual({ context: 1_000_000, output: 131_072 })
  expect(glm54.modalities?.input).toEqual(['text', 'image', 'video', 'pdf'])
  expect(glm54.reasoning_options).toEqual([
    { type: 'effort', values: ['low', 'high', 'max'], default: 'max' },
  ])
  expect(glm54.providers.zai?.pricing).toEqual({
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
  })
  expect(glm54.providers['zai-coding-cn']?.pricing).toEqual({
    billingMode: 'subscription',
    scheduleId: 'flat-cny',
  })
  expect(knowledge.models['zhipuai/glm-5.3']?.providers['zai-coding-cn']?.speedTiers?.fast?.pricing).toEqual({
    billingMode: 'subscription',
    scheduleId: 'flat-cny',
  })
  for (const binding of [...Object.values(zaiGlobal.models), ...Object.values(zaiCn.models)]) {
    expect(binding.baseUrl).toBeUndefined()
  }

  const zaiApi = catalog.providers['zai-api']!
  expect(zaiApi.name).toBe('Z.AI (Global)')
  expect(zaiApi.marketVisible).toBe(true)
  expect(zaiApi.billingMode).toBeUndefined()
  expect(zaiApi.protocolEndpoints).toEqual({
    'openai-completions': 'https://api.z.ai/api/paas/v4',
    'openai-responses': 'https://api.z.ai/api/v1',
    'anthropic-messages': 'https://api.z.ai/api/anthropic',
  })
  expect(zaiApi.models['glm-5.4']).toBeUndefined()
  expect(zaiApi.models['glm-5.3']?.supportedProtocols).toEqual([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
  expect(knowledge.models['zhipuai/glm-5.3']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
  })
  expect(knowledge.models['zhipuai/glm-5.3-flash']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 },
  })
  expect(knowledge.models['zhipuai/glm-5.3-flashx']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 0.37, output: 1.25, cacheRead: 0.075, cacheWrite: 0 },
  })
  expect(knowledge.models['zhipuai/glm-4.7-flash']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  })
  expect(knowledge.models['zhipuai/glm-4.6v']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 0.3, output: 0.9, cacheRead: 0.05, cacheWrite: 0 },
  })
  expect(knowledge.models['zhipuai/glm-4-32b-0414-128k']?.providers['zai-api']?.pricing).toEqual({
    scheduleId: 'flat-usd',
    busy: { input: 0.1, output: 0.1, cacheRead: null, cacheWrite: null },
  })
  for (const binding of Object.values(zaiApi.models)) {
    expect(binding.baseUrl).toBeUndefined()
  }
})

test('OpenCode pay-as-you-go and OpenCode Go subscription build with native protocols, list pricing, and reasoning efforts', async () => {
  const legacy = await buildCatalog()
  const v2 = buildCatalogV2(legacy)
  const catalog = ProvidersV2.parse(v2.providers)
  const knowledge = ModelsV2.parse(v2.models)

  const opencode = catalog.providers.opencode!
  const opencodeGo = catalog.providers['opencode-go']!

  expect(opencode.marketVisible).toBe(true)
  expect(opencode.name).toBe('OpenCode')
  expect(opencode.billingMode).toBeUndefined()
  expect(opencode.defaultProtocol).toBe('openai-completions')
  expect(opencode.protocolEndpoints).toEqual({
    'openai-completions': 'https://opencode.ai/inference/openai/v1',
    'openai-responses': 'https://opencode.ai/inference/openai/v1',
    'anthropic-messages': 'https://opencode.ai/inference/anthropic',
    'google-generative-ai': 'https://opencode.ai/inference/google/v1beta',
  })
  expect(opencode.endpointAliases).toEqual([
    'https://opencode.ai/inference/v1',
    'https://opencode.ai/inference',
  ])
  expect(Object.keys(opencode.models)).toHaveLength(73)

  expect(opencodeGo.marketVisible).toBe(true)
  expect(opencodeGo.name).toBe('OpenCode Go')
  expect(opencodeGo.billingMode).toBe('subscription')
  expect(opencodeGo.defaultProtocol).toBe('openai-completions')
  expect(opencodeGo.protocolEndpoints).toEqual({
    'openai-completions': 'https://opencode.ai/inference/go/openai/v1',
    'openai-responses': 'https://opencode.ai/inference/go/openai/v1',
    'anthropic-messages': 'https://opencode.ai/inference/go/anthropic',
    'google-generative-ai': 'https://opencode.ai/inference/go/google/v1beta',
  })
  expect(opencodeGo.endpointAliases).toEqual([
    'https://opencode.ai/inference/go/v1',
    'https://opencode.ai/inference/go',
  ])
  expect(Object.keys(opencodeGo.models)).toHaveLength(27)

  // Free-tier (HTTP 403 outside OpenCode), retired, and non-chat models must be excluded.
  for (const excluded of [
    'big-pickle',
    'beam-free',
    'deepseek-v4.1-flash-free',
    'cat-jam-free',
    'glm-5.2',
    'kimi-k2.5',
    'jev-1.14',
    'text-embedding-3-small',
    'gpt-image-2.5-sunburst',
  ]) {
    expect(opencode.models[excluded]).toBeUndefined()
    expect(opencodeGo.models[excluded]).toBeUndefined()
  }
  expect(opencodeGo.models['hungerg-free']).toBeUndefined()
  expect(opencodeGo.models['iceman-contributor-free']).toBeUndefined()

  // Native recommended protocol is listed first in supportedProtocols, with no stale per-model baseUrl.
  expect(opencode.models['gpt-6.2-sol']?.api).toBe('openai-responses')
  expect(opencode.models['gpt-6.2-sol']?.supportedProtocols?.[0]).toBe('openai-responses')
  expect(opencode.models['claude-sonnet-5-5']?.api).toBe('anthropic-messages')
  expect(opencode.models['claude-sonnet-5-5']?.supportedProtocols?.[0]).toBe('anthropic-messages')
  expect(opencode.models['gemini-4-neon']?.api).toBe('google-generative-ai')
  expect(opencode.models['gemini-4-neon']?.supportedProtocols?.[0]).toBe('google-generative-ai')
  expect(opencode.models['kimi-k3.1-pro']?.api).toBeUndefined()
  expect(opencode.models['kimi-k3.1-pro']?.supportedProtocols?.[0]).toBe('openai-completions')
  expect(opencode.models['minimax-m3']?.supportedProtocols?.[0]).toBe('openai-completions')
  expect(opencode.models['qwen3.8-max']?.supportedProtocols?.[0]).toBe('openai-completions')
  expect(opencode.models['qwen3.8-flash']?.api).toBe('anthropic-messages')

  // Go-specific native protocols differ for minimax-m3 & qwen3.8-max (anthropic-messages on Go).
  expect(opencodeGo.models['minimax-m3']?.api).toBe('anthropic-messages')
  expect(opencodeGo.models['minimax-m3']?.supportedProtocols?.[0]).toBe('anthropic-messages')
  expect(opencodeGo.models['qwen3.8-max']?.api).toBe('anthropic-messages')
  expect(opencodeGo.models['qwen4-max']?.api).toBe('anthropic-messages')
  expect(opencodeGo.models['gemini-4-argon']?.api).toBe('google-generative-ai')
  expect(opencodeGo.models['grok-4.7']?.api).toBe('openai-responses')

  for (const binding of [...Object.values(opencode.models), ...Object.values(opencodeGo.models)]) {
    expect(binding.baseUrl).toBeUndefined()
    expect(binding.supportedProtocols).toHaveLength(4)
  }

  // Original list pricing (not temporary promotional discounts) on PAYG models.
  expect(knowledge.models['google/gemini-4-argon']?.providers.opencode?.pricing?.busy).toEqual({
    input: 4,
    output: 20,
    cacheRead: 0.2,
    cacheWrite: 0,
  })
  expect(knowledge.models['google/gemini-3.8-flash']?.providers.opencode?.pricing?.busy).toEqual({
    input: 1.5,
    output: 7.5,
    cacheRead: 0.15,
    cacheWrite: 0,
  })
  expect(knowledge.models['zhipuai/glm-5.3']?.providers.opencode?.pricing?.busy).toEqual({
    input: 1.4,
    output: 4.4,
    cacheRead: 0.26,
    cacheWrite: 0,
  })
  expect(knowledge.models['deepseek/deepseek-v4.1-flash-1017']?.providers.opencode?.pricing?.busy).toEqual({
    input: 0.3,
    output: 1.2,
    cacheRead: 0.006,
    cacheWrite: 0,
  })
  expect(knowledge.models['mistral/mistral-large-4']?.providers.opencode?.pricing?.busy).toEqual({
    input: 1.36,
    output: 4.18,
    cacheRead: 0.14,
    cacheWrite: 0,
  })

  // Long-context tiers and multi-TTL cacheWriteByTtl pricing.
  expect(knowledge.models['openai/gpt-6.2-sol']?.providers.opencode?.pricing?.busy).toEqual({
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
  })

  // Thinking effort specs and PAYG vs Go subscription isolation.
  expect(legacy.providers.opencode?.models['kimi-k3']?.reasoning_options).toEqual([
    { type: 'toggle' },
    { type: 'effort', values: ['low', 'high', 'max'] },
  ])
  expect(legacy.providers['opencode-go']?.models['kimi-k3']?.reasoning_options).toEqual([
    { type: 'effort', values: ['max'] },
  ])
  expect(legacy.providers['opencode-go']?.models['qwen4-max']?.cost).toEqual({
    input: 0,
    output: 0,
    cache_read: 0,
    cache_write: 0,
  })
  expect(knowledge.models['alibaba/qwen4-max']?.providers['opencode-go']?.pricing).toEqual({
    billingMode: 'subscription',
    scheduleId: 'flat-usd',
  })
})
