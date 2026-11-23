/**
 * DeepSeek API official peak/off-peak billing schedule (Asia/Shanghai).
 * Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * Peak (busy): Mon-Fri excluding CN public holidays, 09:00-12:00 and 14:00-18:00.
 * Off-peak (idle): all other times (weekends, CN public holidays, nights, lunch).
 */
export const DEEPSEEK_OFF_PEAK_CN = {
  currency: 'CNY',
  timeZone: 'Asia/Shanghai',
  defaultPeriod: 'idle',
  rules: [
    {
      period: 'busy',
      weekdays: [1, 2, 3, 4, 5],
      holiday: 'exclude-cn',
      intervals: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
    },
  ],
  dateOverrides: [],
} as const

/** Flat CNY pricing schedule without peak/off-peak time windows. */
export const FLAT_CNY = {
  currency: 'CNY',
  timeZone: 'Asia/Shanghai',
  defaultPeriod: 'idle',
  rules: [],
  dateOverrides: [],
} as const

/** Flat USD pricing schedule without peak/off-peak time windows. */
export const FLAT_USD = {
  currency: 'USD',
  timeZone: 'UTC',
  defaultPeriod: 'idle',
  rules: [],
  dateOverrides: [],
} as const
