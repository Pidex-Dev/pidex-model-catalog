import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  EXTRA_RECOMMENDATION_PROVIDERS,
  MAINSTREAM_CANONICAL_OWNERS,
  PI_VERSION,
} from '../src/allowlist'

const ROOT = join(import.meta.dir, '..')
const PI_OUT = join(ROOT, 'src', 'upstream', 'pi-models.json')
const MODELS_DEV_OUT = join(ROOT, 'src', 'upstream', 'models-dev.json')

const PI_MODEL_FIELDS = [
  'id',
  'api',
  'baseUrl',
  'name',
  'contextWindow',
  'maxTokens',
  'reasoning',
  'input',
  'cost',
  'thinkingLevelMap',
  'compat',
  'type',
] as const

/**
 * Models no longer offered by MiniMax official API.
 * Official LLM pricing (platform.minimax.io / platform.minimax.cn docs/pricing/overview)
 * only lists MiniMax-M3.1-Flash and MiniMax-M3.
 */
const MINIMAX_RETIRED_MODELS = new Set(['MiniMax-M2.7', 'MiniMax-M2.7-highspeed'])

const MODELS_DEV_FIELDS = [
  'id',
  'name',
  'type',
  'canonical_model_id',
  'aliases',
  'description',
  'family',
  'knowledge',
  'release_date',
  'last_updated',
  'status',
  'open_weights',
  'license',
  'links',
  'weights',
  'benchmarks',
  'attachment',
  'temperature',
  'structured_output',
  'interleaved',
  'provider',
  'limit',
  'modalities',
  'reasoning',
  'tool_call',
  'reasoning_options',
  'cost',
] as const

function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const next = (value as Record<string, unknown>)[key]
      if (next !== undefined) out[key] = sortKeys(next)
    }
    return out as T
  }
  return value
}

function pickFields(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    if (source[field] !== undefined) out[field] = source[field]
  }
  return out
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }
  return (await response.json()) as Record<string, unknown>
}

async function main() {
  const piUrl = `https://pi.dev/api/models?pi-version=${encodeURIComponent(PI_VERSION)}`
  const modelsDevUrl = 'https://models.dev/catalog.json?type=all'

  const [piRaw, modelsDevRaw] = await Promise.all([fetchJson(piUrl), fetchJson(modelsDevUrl)])

  // Trim and deterministically sort Pi base providers.
  const piTrimmed: Record<string, Record<string, unknown>> = {}
  for (const [providerId, modelsObj] of Object.entries(piRaw)) {
    if (!modelsObj || typeof modelsObj !== 'object' || Array.isArray(modelsObj)) continue
    const modelsOut: Record<string, unknown> = {}
    for (const [modelId, modelObj] of Object.entries(modelsObj as Record<string, unknown>)) {
      if (!modelObj || typeof modelObj !== 'object' || Array.isArray(modelObj)) continue
      // MiniMax official API no longer serves retired M2.7 series models.
      if (
        (providerId === 'minimax' || providerId === 'minimax-cn') &&
        MINIMAX_RETIRED_MODELS.has(modelId)
      ) {
        continue
      }
      modelsOut[modelId] = pickFields(modelObj as Record<string, unknown>, PI_MODEL_FIELDS)
    }
    piTrimmed[providerId] = modelsOut
  }

  const keptProviderIds = new Set<string>([
    ...Object.keys(piTrimmed),
    ...EXTRA_RECOMMENDATION_PROVIDERS,
  ])

  const rawProviders = (modelsDevRaw.providers ?? {}) as Record<string, Record<string, unknown>>
  const rawModels = (modelsDevRaw.models ?? {}) as Record<string, Record<string, unknown>>

  const providersOut: Record<string, Record<string, unknown>> = {}
  const referencedCanonicalIds = new Set<string>()

  for (const [providerId, provider] of Object.entries(rawProviders)) {
    if (!keptProviderIds.has(providerId)) continue
    if (!provider || typeof provider !== 'object') continue
    const rawProviderModels = (provider.models ?? {}) as Record<string, Record<string, unknown>>
    const modelsOut: Record<string, unknown> = {}
    for (const [modelId, model] of Object.entries(rawProviderModels)) {
      if (!model || typeof model !== 'object') continue
      if (typeof model.canonical_model_id === 'string') {
        referencedCanonicalIds.add(model.canonical_model_id)
      }
      modelsOut[modelId] = pickFields(model, MODELS_DEV_FIELDS)
    }
    providersOut[providerId] = {
      ...(typeof provider.name === 'string' ? { name: provider.name } : {}),
      ...(typeof provider.api === 'string' ? { api: provider.api } : {}),
      ...(Array.isArray(provider.env) ? { env: provider.env } : {}),
      ...(typeof provider.npm === 'string' ? { npm: provider.npm } : {}),
      models: modelsOut,
    }
  }

  const mainstreamOwners = new Set<string>(MAINSTREAM_CANONICAL_OWNERS)
  const modelsOut: Record<string, unknown> = {}
  for (const [canonicalId, model] of Object.entries(rawModels)) {
    if (!model || typeof model !== 'object') continue
    const owner = canonicalId.split('/')[0]?.toLowerCase() ?? ''
    if (!referencedCanonicalIds.has(canonicalId) && !mainstreamOwners.has(owner)) continue
    modelsOut[canonicalId] = pickFields(model, MODELS_DEV_FIELDS)
  }

  await mkdir(dirname(PI_OUT), { recursive: true })
  await writeFile(PI_OUT, JSON.stringify(sortKeys(piTrimmed), null, 2) + '\n', 'utf8')
  await writeFile(
    MODELS_DEV_OUT,
    JSON.stringify(sortKeys({ models: modelsOut, providers: providersOut }), null, 2) + '\n',
    'utf8',
  )

  console.log(
    `Synced pi.dev (${Object.keys(piTrimmed).length} providers) and models.dev (${Object.keys(providersOut).length} allowlisted providers, ${Object.keys(modelsOut).length} canonical models).`,
  )
}

await main()
