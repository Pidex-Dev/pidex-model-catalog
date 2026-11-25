import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  EXTRA_RECOMMENDATION_PROVIDERS,
  MARKET_VISIBLE_PROVIDERS,
  PI_VERSION,
} from '../src/allowlist'
import { MODEL_OVERLAYS, PROVIDER_OVERLAYS } from '../src/overlays'
import { writeCatalogV2 } from './build-v2'
import { scaleUnitPrices, withOffPeakSchedule } from '../src/schedules/helpers'
import {
  PROTOCOL_ENDPOINT_APIS,
  type CatalogDocument,
  type CatalogModelFacts,
  type CatalogProvider,
  type ModelFactsPatch,
  type ProtocolEndpointApi,
  type ProtocolEndpoints,
} from '../src/schema/catalog'

const ROOT = join(import.meta.dir, '..')
const PI_PATH = join(ROOT, 'src', 'upstream', 'pi-models.json')
const MODELS_DEV_PATH = join(ROOT, 'src', 'upstream', 'models-dev.json')
const DIST_DIR = join(ROOT, 'dist')
const CATALOG_OUT = join(DIST_DIR, 'v1', 'catalog.json')
const MANIFEST_OUT = join(DIST_DIR, 'v1', 'manifest.json')
const HEADERS_OUT = join(DIST_DIR, '_headers')

type PiRawModel = {
  id: string
  name?: string
  api?: string
  baseUrl?: string
  contextWindow?: number
  maxTokens?: number
  reasoning?: boolean
  input?: string[]
  cost?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
  }
  thinkingLevelMap?: Record<string, string | null>
  compat?: Record<string, unknown>
  type?: 'chat' | 'embedding' | 'rerank'
}

type ModelsDevProvider = {
  name?: string
  api?: string
  env?: string[]
  npm?: string
  models?: Record<string, Record<string, unknown>>
}

type ModelsDevRaw = {
  models: Record<string, Record<string, unknown>>
  providers: Record<string, ModelsDevProvider>
}

const ALLOWED_FACT_KEYS = new Set<string>([
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
  'option_specs',
  'cost',
  'pricing',
  'pi_api',
  'base_url',
  'compat',
  'thinking_level_map',
])

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function sanitizeFacts(raw: Record<string, unknown>): CatalogModelFacts {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_FACT_KEYS.has(key) || value === undefined) continue
    if (key === 'limit' && isObject(value)) {
      const limit: Record<string, unknown> = {}
      if (typeof value.context === 'number') limit.context = value.context
      if (typeof value.input === 'number' && value.input > 0) limit.input = value.input
      if (typeof value.output === 'number') limit.output = value.output
      if (Object.keys(limit).length) out.limit = limit
      continue
    }
    if (key === 'modalities' && isObject(value)) {
      const modalities: Record<string, unknown> = {}
      if (Array.isArray(value.input)) modalities.input = value.input
      if (Array.isArray(value.output)) modalities.output = value.output
      if (Object.keys(modalities).length) out.modalities = modalities
      continue
    }
    if (key === 'cost' && isObject(value)) {
      out.cost = sanitizeCost(value)
      continue
    }
    if (key === 'provider' && isObject(value)) {
      const provider: Record<string, unknown> = {}
      if (typeof value.npm === 'string') provider.npm = value.npm
      if (typeof value.api === 'string') provider.api = value.api
      if (typeof value.shape === 'string') provider.shape = value.shape
      if (Object.keys(provider).length) out.provider = provider
      continue
    }
    if (key === 'reasoning_options' && Array.isArray(value)) {
      const options = value.filter(
        (item) =>
          isObject(item) &&
          ['effort', 'toggle', 'budget_tokens'].includes(String(item.type)),
      )
      if (options.length) out.reasoning_options = options
      continue
    }
    out[key] = structuredClone(value)
  }
  return out as CatalogModelFacts
}

function sanitizeCost(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of [
    'input',
    'output',
    'cache_read',
    'cache_write',
    'reasoning',
    'input_audio',
    'output_audio',
    'context_over_200k',
  ]) {
    if (raw[key] !== undefined) out[key] = structuredClone(raw[key])
  }
  if (Array.isArray(raw.tiers)) {
    const tiers = raw.tiers
      .filter((tier) => isObject(tier) && isObject(tier.tier) && typeof tier.tier.size === 'number')
      .map((tier) => {
        const t = tier as Record<string, unknown>
        const meta = t.tier as Record<string, unknown>
        return {
          tier: {
            ...(typeof meta.type === 'string' ? { type: meta.type } : {}),
            size: meta.size,
          },
          input: t.input,
          output: t.output,
          ...(t.cache_read !== undefined ? { cache_read: t.cache_read } : {}),
          ...(t.cache_write !== undefined ? { cache_write: t.cache_write } : {}),
        }
      })
    if (tiers.length) out.tiers = tiers
  }
  return out
}

function deepMergeFacts(base: CatalogModelFacts, patch: ModelFactsPatch): CatalogModelFacts {
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if ((key === 'limit' || key === 'modalities' || key === 'cost' || key === 'option_specs') && isObject(value) && isObject(next[key])) {
      next[key] = { ...(next[key] as Record<string, unknown>), ...structuredClone(value) }
    } else {
      next[key] = structuredClone(value)
    }
  }
  return sanitizeFacts(next)
}

function piModelToFacts(model: PiRawModel): CatalogModelFacts {
  const cost = model.cost
    ? {
        ...(model.cost.input !== undefined ? { input: model.cost.input } : {}),
        ...(model.cost.output !== undefined ? { output: model.cost.output } : {}),
        ...(model.cost.cacheRead !== undefined ? { cache_read: model.cost.cacheRead } : {}),
        ...(model.cost.cacheWrite !== undefined ? { cache_write: model.cost.cacheWrite } : {}),
      }
    : undefined

  return sanitizeFacts({
    name: model.name ?? model.id,
    ...(model.type ? { type: model.type } : {}),
    limit: {
      ...(model.contextWindow !== undefined ? { context: model.contextWindow } : {}),
      ...(model.maxTokens !== undefined ? { output: model.maxTokens } : {}),
    },
    ...(model.input?.length ? { modalities: { input: model.input, output: ['text'] } } : {}),
    ...(model.reasoning !== undefined ? { reasoning: model.reasoning } : {}),
    ...(cost && Object.keys(cost).length ? { cost } : {}),
    ...(model.api ? { pi_api: model.api } : {}),
    ...(model.baseUrl ? { base_url: model.baseUrl } : {}),
    ...(model.compat ? { compat: model.compat } : {}),
    ...(model.thinkingLevelMap ? { thinking_level_map: model.thinkingLevelMap } : {}),
  })
}

function enrichPiWithModelsDev(
  piFacts: CatalogModelFacts,
  devRaw: Record<string, unknown> | undefined,
): CatalogModelFacts {
  if (!devRaw) return piFacts
  const devFacts = sanitizeFacts(devRaw)
  // models.dev fills metadata & missing limits/capabilities while Pi keeps runtime & base limits/cost.
  const mergedLimit = {
    ...(devFacts.limit ?? {}),
    ...(piFacts.limit ?? {}),
  }
  const mergedModalities = {
    ...(devFacts.modalities ?? {}),
    ...(piFacts.modalities ?? {}),
  }
  const mergedCost = devFacts.cost || piFacts.cost
    ? {
        ...(devFacts.cost ?? {}),
        ...(piFacts.cost ?? {}),
      }
    : undefined

  return sanitizeFacts({
    ...devFacts,
    ...piFacts,
    ...(Object.keys(mergedLimit).length ? { limit: mergedLimit } : {}),
    ...(Object.keys(mergedModalities).length ? { modalities: mergedModalities } : {}),
    ...(mergedCost ? { cost: mergedCost } : {}),
  })
}

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

export async function buildCatalog(): Promise<CatalogDocument> {
  const [piRaw, modelsDevRaw] = await Promise.all([
    readFile(PI_PATH, 'utf8').then((text) => JSON.parse(text) as Record<string, Record<string, PiRawModel>>),
    readFile(MODELS_DEV_PATH, 'utf8').then((text) => JSON.parse(text) as ModelsDevRaw),
  ])

  const models: Record<string, CatalogModelFacts> = {}
  for (const [id, raw] of Object.entries(modelsDevRaw.models ?? {})) {
    const base = sanitizeFacts(raw)
    const overlay = MODEL_OVERLAYS[id]
    models[id] = overlay ? deepMergeFacts(base, overlay) : base
  }
  for (const [id, overlay] of Object.entries(MODEL_OVERLAYS)) {
    if (!models[id]) models[id] = sanitizeFacts(overlay)
  }

  // Unambiguous bare-name -> canonical ID index to backfill provider models missing canonical_model_id.
  const bareCanonicalCandidates = new Map<string, string[]>()
  for (const canonicalId of Object.keys(models)) {
    const bareName = canonicalId.toLowerCase().split('/').at(-1)!
    const list = bareCanonicalCandidates.get(bareName) ?? []
    list.push(canonicalId)
    bareCanonicalCandidates.set(bareName, list)
  }
  const backfillCanonical = (modelId: string, facts: CatalogModelFacts): CatalogModelFacts => {
    if (facts.canonical_model_id) return facts
    const candidates = bareCanonicalCandidates.get(modelId.toLowerCase())
    if (candidates?.length === 1) {
      return { ...facts, canonical_model_id: candidates[0] }
    }
    return facts
  }

  const providers: Record<string, CatalogProvider> = {}
  const marketVisibleSet = new Set<string>(MARKET_VISIBLE_PROVIDERS)

  const protocolEndpointApiSet = new Set<string>(PROTOCOL_ENDPOINT_APIS)
  const isProtocolEndpointApi = (value: string | undefined): value is ProtocolEndpointApi =>
    typeof value === 'string' && protocolEndpointApiSet.has(value)

  // Layer 1 + 2a: Pi base providers (only MARKET_VISIBLE_PROVIDERS are marketVisible: true), enriched by models.dev.
  for (const [providerId, piModels] of Object.entries(piRaw)) {
    const devProvider = modelsDevRaw.providers?.[providerId]
    const devModels = devProvider?.models ?? {}
    const modelsOut: Record<string, CatalogModelFacts> = {}
    const protocolEndpoints: ProtocolEndpoints = {}
    for (const [modelId, piModel] of Object.entries(piModels)) {
      const piFacts = piModelToFacts(piModel)
      const devMatch = devModels[modelId] ?? devModels[modelId.toLowerCase()]
      modelsOut[modelId] = enrichPiWithModelsDev(piFacts, devMatch)
      if (isProtocolEndpointApi(piModel.api) && piModel.baseUrl && !protocolEndpoints[piModel.api]) {
        protocolEndpoints[piModel.api] = piModel.baseUrl
      }
    }
    providers[providerId] = {
      name: devProvider?.name ?? providerId,
      ...(devProvider?.api ? { api: devProvider.api } : {}),
      ...(Object.keys(protocolEndpoints).length ? { protocolEndpoints } : {}),
      ...(devProvider?.env ? { env: devProvider.env } : {}),
      ...(devProvider?.npm ? { npm: devProvider.npm } : {}),
      marketVisible: marketVisibleSet.has(providerId),
      models: modelsOut,
    }
  }

  // Layer 2b: Extra allowlisted non-Pi providers (marketVisible: false, smartConfig only).
  for (const providerId of EXTRA_RECOMMENDATION_PROVIDERS) {
    if (providers[providerId]) continue
    const devProvider = modelsDevRaw.providers?.[providerId]
    if (!devProvider) continue
    const modelsOut: Record<string, CatalogModelFacts> = {}
    for (const [modelId, rawModel] of Object.entries(devProvider.models ?? {})) {
      modelsOut[modelId] = sanitizeFacts(rawModel)
    }
    providers[providerId] = {
      name: devProvider.name ?? providerId,
      ...(devProvider.api ? { api: devProvider.api } : {}),
      ...(devProvider.env ? { env: devProvider.env } : {}),
      ...(devProvider.npm ? { npm: devProvider.npm } : {}),
      marketVisible: false,
      models: modelsOut,
    }
  }

  // Layer 3: Authoritative TypeScript provider overlays.
  for (const overlay of PROVIDER_OVERLAYS) {
    const existing = providers[overlay.providerId]
    const existingModels = existing?.models ?? {}
    const devModels = modelsDevRaw.providers?.[overlay.providerId]?.models ?? {}
    const excluded = new Set(overlay.excludeModels ?? [])
    const modelsOut: Record<string, CatalogModelFacts> = overlay.replaceModels
      ? {}
      : existing
        ? Object.fromEntries(
            Object.entries(existingModels).filter(([modelId]) => !excluded.has(modelId)),
          )
        : {}
    for (const [modelId, definition] of Object.entries(overlay.models ?? {})) {
      const { busyPricing, ...patch } = definition
      const rule = overlay.providerPricingRule
      if (busyPricing && rule) {
        patch.pricing = withOffPeakSchedule(rule.schedule, {
          busy: busyPricing,
          idle: scaleUnitPrices(busyPricing, rule.idleFactor),
        })
      }
      const devSeed = devModels[modelId] ?? devModels[modelId.toLowerCase()]
      const current =
        (excluded.has(modelId) ? undefined : existingModels[modelId]) ??
        (devSeed ? sanitizeFacts(devSeed) : undefined)
      modelsOut[modelId] = current ? deepMergeFacts(current, patch) : sanitizeFacts(patch)
    }
    const mergedProtocolEndpoints: ProtocolEndpoints = {
      ...(existing?.protocolEndpoints ?? {}),
      ...(overlay.protocolEndpoints ?? {}),
    }
    const primaryApi = overlay.api ?? existing?.api
    const protocolEndpointUrls = Object.values(mergedProtocolEndpoints).filter(
      (url): url is string => typeof url === 'string' && url.length > 0 && url !== primaryApi,
    )
    const mergedEndpoints = [
      ...new Set([
        ...protocolEndpointUrls,
        ...(overlay.endpoints ?? []),
        ...(existing?.endpoints ?? []),
      ]),
    ]
    providers[overlay.providerId] = {
      name: overlay.name ?? existing?.name ?? overlay.providerId,
      ...(primaryApi ? { api: primaryApi } : {}),
      ...(mergedEndpoints.length ? { endpoints: mergedEndpoints } : {}),
      ...(Object.keys(mergedProtocolEndpoints).length
        ? { protocolEndpoints: mergedProtocolEndpoints }
        : {}),
      ...(overlay.env ?? existing?.env ? { env: [...(overlay.env ?? existing?.env ?? [])] } : {}),
      ...(overlay.npm ?? existing?.npm ? { npm: overlay.npm ?? existing?.npm } : {}),
      marketVisible: existing?.marketVisible ?? marketVisibleSet.has(overlay.providerId),
      models: modelsOut,
    }
  }

  for (const provider of Object.values(providers)) {
    for (const [modelId, facts] of Object.entries(provider.models)) {
      provider.models[modelId] = backfillCanonical(modelId, facts)
    }
  }

  return sortKeys({
    owner: 'pidex-model-catalog' as const,
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    piVersion: PI_VERSION,
    models,
    providers,
  })
}

async function main() {
  const document = await buildCatalog()
  const upstream = JSON.parse(await readFile(MODELS_DEV_PATH, 'utf8'))
  await writeCatalogV2(join(DIST_DIR, 'v2'), document, upstream)
  const serialized = JSON.stringify(document)
  const sha256 = createHash('sha256').update(serialized).digest('hex')
  const marketProviderCount = Object.values(document.providers).filter((p) => p.marketVisible).length

  await mkdir(join(DIST_DIR, 'v1'), { recursive: true })
  await writeFile(CATALOG_OUT, serialized, 'utf8')
  await writeFile(
    MANIFEST_OUT,
    JSON.stringify(
      {
        owner: document.owner,
        schemaVersion: document.schemaVersion,
        generatedAt: document.generatedAt,
        piVersion: document.piVersion,
        sha256,
        providerCount: Object.keys(document.providers).length,
        marketProviderCount,
        modelCount: Object.keys(document.models).length,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  await writeFile(
    HEADERS_OUT,
    ['v1', 'v2'].map((version) => `/${version}/*\n  Cache-Control: public, max-age=300\n  Access-Control-Allow-Origin: *\n`).join(''),
    'utf8',
  )

  console.log(
    `Built dist/v1/catalog.json (${(serialized.length / 1024).toFixed(1)} KiB, ${marketProviderCount} market providers, ${Object.keys(document.providers).length} total providers, ${Object.keys(document.models).length} canonical models).`,
  )
}

if (import.meta.main) {
  await main()
}
