/**
 * Curated provider allowlist for the Pidex model catalog.
 *
 * - `MARKET_VISIBLE_PROVIDERS` controls which curated providers (Pi base providers or
 *   authoritative TypeScript overlay providers) are visible in the Pidex Provider Market
 *   (`marketVisible: true`). Other Pi providers remain in the catalog with
 *   `marketVisible: false` so `smartConfig` and future one-line market activation both
 *   work without losing model metadata.
 * - `EXTRA_RECOMMENDATION_PROVIDERS` are non-Pi major providers kept ONLY for
 *   custom-provider / relay `smartConfig` matching (`marketVisible: false`).
 */
export const PI_VERSION = '0.99.2'

export const MARKET_VISIBLE_PROVIDERS = [
  'deepseek',
  'minimax-cn',
  'minimax',
  'moonshotai-cn',
  'moonshotai',
  'qianwen-cn',
  'qwen-token-plan-cn',
] as const

export const EXTRA_RECOMMENDATION_PROVIDERS = [
  'volcengine',
  'alibaba',
  'alibaba-cn',
  'siliconflow',
  'siliconflow-cn',
  'zhipuai',
  'tencent-tokenhub',
] as const

export const MAINSTREAM_CANONICAL_OWNERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'xai',
  'mistral',
  'meta',
  'qwen',
  'moonshotai',
  'minimax',
  'zai',
  'xiaomi',
  'bytedance',
  'zhipuai',
] as const
