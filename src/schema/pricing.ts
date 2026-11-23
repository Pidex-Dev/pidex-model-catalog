import { z } from 'zod'

export const PricingPriceSchema = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER).nullable()

export const CacheWriteByTtlSchema = z.record(z.string().min(1), PricingPriceSchema)

export const PricingPriceTierSchema = z.object({
  inputTokensAbove: z.number().int().min(0),
  input: PricingPriceSchema,
  output: PricingPriceSchema,
  cacheRead: PricingPriceSchema,
  cacheWrite: PricingPriceSchema,
  cacheWriteByTtl: CacheWriteByTtlSchema.optional(),
})

export const UnitPricesSchema = z.object({
  input: PricingPriceSchema,
  output: PricingPriceSchema,
  cacheRead: PricingPriceSchema,
  cacheWrite: PricingPriceSchema,
  cacheWriteByTtl: CacheWriteByTtlSchema.optional(),
  tiers: z.array(PricingPriceTierSchema).optional(),
})

const ClockTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

export const BillingPeriodSchema = z.enum(['idle', 'busy'])

export const PricingSchema = z.object({
  currency: z.enum(['USD', 'CNY']),
  timeZone: z.string().min(1),
  defaultPeriod: BillingPeriodSchema,
  idle: UnitPricesSchema,
  busy: UnitPricesSchema,
  rules: z
    .array(
      z.object({
        period: BillingPeriodSchema,
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
        holiday: z.enum(['any', 'exclude-cn', 'only-cn']),
        intervals: z
          .array(z.object({ start: ClockTimeSchema, end: ClockTimeSchema }))
          .max(48),
      }),
    )
    .max(100),
  dateOverrides: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        period: BillingPeriodSchema,
      }),
    )
    .max(1000),
})

export type PricingPrice = z.infer<typeof PricingPriceSchema>
export type CacheWriteByTtl = z.infer<typeof CacheWriteByTtlSchema>
export type PricingPriceTier = z.infer<typeof PricingPriceTierSchema>
export type UnitPrices = z.infer<typeof UnitPricesSchema>
export type Pricing = z.infer<typeof PricingSchema>

export class PricingValidationError extends Error {}

const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))

function normalizeCacheWriteByTtl(
  map: CacheWriteByTtl | undefined,
): CacheWriteByTtl | undefined {
  if (!map) return undefined
  const entries = Object.entries(map)
  if (!entries.length) return undefined
  return Object.fromEntries(entries)
}

function normalizeTiers(
  tiers: readonly PricingPriceTier[] | undefined,
  periodLabel: string,
): PricingPriceTier[] | undefined {
  if (!tiers?.length) return undefined
  const seen = new Set<number>()
  for (const tier of tiers) {
    if (seen.has(tier.inputTokensAbove)) {
      throw new PricingValidationError(`${periodLabel} 计费阶梯阈值 ${tier.inputTokensAbove} 不能重复`)
    }
    seen.add(tier.inputTokensAbove)
  }
  return [...tiers]
    .sort((a, b) => a.inputTokensAbove - b.inputTokensAbove)
    .map((tier) => {
      const cacheWriteByTtl = normalizeCacheWriteByTtl(tier.cacheWriteByTtl)
      return {
        inputTokensAbove: tier.inputTokensAbove,
        input: tier.input,
        output: tier.output,
        cacheRead: tier.cacheRead,
        cacheWrite: tier.cacheWrite,
        ...(cacheWriteByTtl ? { cacheWriteByTtl } : {}),
      }
    })
}

/** Validates time zone, date overrides, week-grid busy/idle conflicts and tier uniqueness. */
export function validatePricing(value: unknown, label = 'pricing'): Pricing {
  const parsed = PricingSchema.safeParse(value)
  if (!parsed.success) {
    throw new PricingValidationError(`${label}: 计费配置包含无效价格、日期或时间段`)
  }
  const pricing = parsed.data
  try {
    new Intl.DateTimeFormat('en', { timeZone: pricing.timeZone }).format()
  } catch {
    throw new PricingValidationError(`${label}: 计费时区无效，请填写 IANA 时区`)
  }
  const dates = new Set<string>()
  for (const override of pricing.dateOverrides) {
    if (
      Number.isNaN(Date.parse(override.date)) ||
      new Date(override.date).toISOString().slice(0, 10) !== override.date
    ) {
      throw new PricingValidationError(`${label}: 日期覆盖包含无效日期`)
    }
    if (dates.has(override.date)) {
      throw new PricingValidationError(`${label}: 日期覆盖不能重复`)
    }
    dates.add(override.date)
  }
  const idleTiers = normalizeTiers(pricing.idle.tiers, `${label}.idle`)
  const busyTiers = normalizeTiers(pricing.busy.tiers, `${label}.busy`)

  type Slot = { rule: number; holiday: Pricing['rules'][number]['holiday']; day: number }
  const week = new Map<number, { idle: Map<string, Slot>; busy: Map<string, Slot> }>()
  pricing.rules.forEach((rule, index) => {
    if (!rule.weekdays.length || !rule.intervals.length) {
      throw new PricingValidationError(`${label}: 规则 ${index + 1} 缺少星期或时间段`)
    }
    const intervals = rule.intervals
      .map((interval) => {
        const start = minutes(interval.start)
        const end = minutes(interval.end)
        if (start === end) {
          throw new PricingValidationError(`${label}: 规则 ${index + 1} 开始和结束时间不能相同`)
        }
        return { start, end: end < start ? end + 1440 : end }
      })
      .sort((a, b) => a.start - b.start)
    const merged: { start: number; end: number }[] = []
    for (const interval of intervals) {
      const last = merged.at(-1)
      if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
      else merged.push({ ...interval })
    }
    for (const day of new Set(rule.weekdays)) {
      for (const interval of merged) {
        for (let minute = day * 1440 + interval.start; minute < day * 1440 + interval.end; minute++) {
          const position = minute % 10080
          const cell = week.get(position) ?? {
            idle: new Map<string, Slot>(),
            busy: new Map<string, Slot>(),
          }
          const opposite = rule.period === 'idle' ? cell.busy : cell.idle
          for (const other of opposite.values()) {
            if (
              other.day === day &&
              other.holiday !== 'any' &&
              rule.holiday !== 'any' &&
              other.holiday !== rule.holiday
            ) {
              continue
            }
            throw new PricingValidationError(
              `${label}: 计费规则 ${other.rule + 1} 与 ${index + 1} 的忙闲时间冲突`,
            )
          }
          cell[rule.period].set(`${day}:${rule.holiday}`, {
            rule: index,
            holiday: rule.holiday,
            day,
          })
          week.set(position, cell)
        }
      }
    }
  })

  const idleCacheWriteByTtl = normalizeCacheWriteByTtl(pricing.idle.cacheWriteByTtl)
  const busyCacheWriteByTtl = normalizeCacheWriteByTtl(pricing.busy.cacheWriteByTtl)

  return {
    ...pricing,
    idle: {
      input: pricing.idle.input,
      output: pricing.idle.output,
      cacheRead: pricing.idle.cacheRead,
      cacheWrite: pricing.idle.cacheWrite,
      ...(idleCacheWriteByTtl ? { cacheWriteByTtl: idleCacheWriteByTtl } : {}),
      ...(idleTiers ? { tiers: idleTiers } : {}),
    },
    busy: {
      input: pricing.busy.input,
      output: pricing.busy.output,
      cacheRead: pricing.busy.cacheRead,
      cacheWrite: pricing.busy.cacheWrite,
      ...(busyCacheWriteByTtl ? { cacheWriteByTtl: busyCacheWriteByTtl } : {}),
      ...(busyTiers ? { tiers: busyTiers } : {}),
    },
  }
}
