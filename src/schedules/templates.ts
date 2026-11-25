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

/**
 * Qwen AI Platform (千问AI平台) daily peak/off-peak billing schedule (Asia/Shanghai).
 * Source: https://platform.qianwenai.com/pricing/api
 *
 * Peak (busy): every day 08:00-22:00 (no weekend or public holiday exception).
 * Off-peak (idle): every day 22:00-08:00 (next day).
 */
export const QIANWEN_OFF_PEAK_CN = {
  currency: 'CNY',
  timeZone: 'Asia/Shanghai',
  defaultPeriod: 'idle',
  rules: [
    {
      period: 'busy',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      holiday: 'any',
      intervals: [{ start: '08:00', end: '22:00' }],
    },
  ],
  dateOverrides: [],
} as const

/**
 * QwenCloud international daily peak/off-peak billing schedule (USD, UTC+8).
 * Source: https://docs.qwencloud.com/developer-guides/getting-started/pricing.md
 *
 * Peak (busy): every day 08:00-22:00 UTC+8.
 * Off-peak (idle): every day 22:00-08:00 UTC+8 (next day).
 */
export const QIANWEN_OFF_PEAK_USD = {
  currency: 'USD',
  timeZone: 'Asia/Shanghai',
  defaultPeriod: 'idle',
  rules: [
    {
      period: 'busy',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      holiday: 'any',
      intervals: [{ start: '08:00', end: '22:00' }],
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
