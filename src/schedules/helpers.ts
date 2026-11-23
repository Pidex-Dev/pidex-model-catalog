import type { Pricing, PricingPrice, PricingPriceTier, UnitPrices } from '../schema/pricing'

export type ScheduleTemplate = Pick<
  Pricing,
  'currency' | 'timeZone' | 'defaultPeriod' | 'rules' | 'dateOverrides'
>

const roundPrice = (value: PricingPrice, factor: number): PricingPrice => {
  if (value === null) return null
  return Number((value * factor).toPrecision(10))
}

const scaleCacheWriteByTtl = (
  map: UnitPrices['cacheWriteByTtl'],
  factor: number,
): UnitPrices['cacheWriteByTtl'] => {
  if (!map) return undefined
  const entries = Object.entries(map)
  if (!entries.length) return undefined
  return Object.fromEntries(entries.map(([ttl, price]) => [ttl, roundPrice(price, factor)]))
}

const scaleTier = (tier: PricingPriceTier, factor: number): PricingPriceTier => {
  const cacheWriteByTtl = scaleCacheWriteByTtl(tier.cacheWriteByTtl, factor)
  return {
    inputTokensAbove: tier.inputTokensAbove,
    input: roundPrice(tier.input, factor),
    output: roundPrice(tier.output, factor),
    cacheRead: roundPrice(tier.cacheRead, factor),
    cacheWrite: roundPrice(tier.cacheWrite, factor),
    ...(cacheWriteByTtl ? { cacheWriteByTtl } : {}),
  }
}

export function scaleUnitPrices(prices: UnitPrices, factor: number): UnitPrices {
  const cacheWriteByTtl = scaleCacheWriteByTtl(prices.cacheWriteByTtl, factor)
  return {
    input: roundPrice(prices.input, factor),
    output: roundPrice(prices.output, factor),
    cacheRead: roundPrice(prices.cacheRead, factor),
    cacheWrite: roundPrice(prices.cacheWrite, factor),
    ...(cacheWriteByTtl ? { cacheWriteByTtl } : {}),
    ...(prices.tiers?.length
      ? { tiers: prices.tiers.map((tier) => scaleTier(tier, factor)) }
      : {}),
  }
}

export function withOffPeakSchedule(
  template: {
    readonly currency: Pricing['currency']
    readonly timeZone: string
    readonly defaultPeriod: Pricing['defaultPeriod']
    readonly rules: ReadonlyArray<{
      readonly period: Pricing['rules'][number]['period']
      readonly weekdays: readonly number[]
      readonly holiday: Pricing['rules'][number]['holiday']
      readonly intervals: ReadonlyArray<{ readonly start: string; readonly end: string }>
    }>
    readonly dateOverrides: ReadonlyArray<{
      readonly date: string
      readonly period: Pricing['dateOverrides'][number]['period']
    }>
  },
  prices: { readonly busy: UnitPrices; readonly idle: UnitPrices },
): Pricing {
  return {
    currency: template.currency,
    timeZone: template.timeZone,
    defaultPeriod: template.defaultPeriod,
    rules: template.rules.map((rule) => ({
      ...rule,
      weekdays: [...rule.weekdays],
      intervals: rule.intervals.map((interval) => ({ ...interval })),
    })),
    dateOverrides: template.dateOverrides.map((override) => ({ ...override })),
    busy: prices.busy,
    idle: prices.idle,
  }
}

/** Builds a Pricing schedule where off-peak (idle) prices are 50% of peak (busy) prices. */
export function withHalfPriceIdle(
  template: Parameters<typeof withOffPeakSchedule>[0],
  busy: UnitPrices,
): Pricing {
  return withOffPeakSchedule(template, {
    busy,
    idle: scaleUnitPrices(busy, 0.5),
  })
}

/** Builds a Pricing schedule with identical prices across all periods (optionally tiered by context). */
export function withFlatPricing(
  template: Parameters<typeof withOffPeakSchedule>[0],
  prices: UnitPrices,
): Pricing {
  return withOffPeakSchedule(template, {
    busy: structuredClone(prices),
    idle: structuredClone(prices),
  })
}
