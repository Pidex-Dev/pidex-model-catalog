import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MARKET_VISIBLE_PROVIDERS } from '../src/allowlist'
import { PROVIDER_OVERLAYS } from '../src/overlays'
import { CatalogDocumentSchema, type CatalogDocument } from '../src/schema/catalog'
import { validateOptionSpecs } from '../src/schema/cel-check'
import { validatePricing } from '../src/schema/pricing'
import { validateCatalogV2 } from './validate-v2'

const ROOT = join(import.meta.dir, '..')
const CATALOG_PATH = join(ROOT, 'dist', 'v1', 'catalog.json')
const PI_PATH = join(ROOT, 'src', 'upstream', 'pi-models.json')

export function validateCatalogDocument(document: CatalogDocument, piProviderIds: ReadonlySet<string>): void {
  const parsed = CatalogDocumentSchema.safeParse(document)
  if (!parsed.success) {
    throw new Error(`Catalog schema validation failed:\n${parsed.error.message}`)
  }

  for (const [id, model] of Object.entries(parsed.data.models)) {
    if (model.pricing) validatePricing(model.pricing, `models.${id}`)
    if (model.option_specs) validateOptionSpecs(model.option_specs, `models.${id}`)
  }

  const allowedMarket = new Set<string>(MARKET_VISIBLE_PROVIDERS)
  const overlayProviderIds = new Set<string>(PROVIDER_OVERLAYS.map((overlay) => overlay.providerId))
  for (const providerId of allowedMarket) {
    if (!parsed.data.providers[providerId]?.marketVisible) {
      throw new Error(`Expected market-visible provider "${providerId}" is missing or hidden`)
    }
  }

  for (const [providerId, provider] of Object.entries(parsed.data.providers)) {
    if (
      provider.marketVisible &&
      (!allowedMarket.has(providerId) ||
        (!piProviderIds.has(providerId) && !overlayProviderIds.has(providerId)))
    ) {
      throw new Error(`Market-visible provider "${providerId}" is not in curated market allowlist`)
    }
    for (const [modelId, model] of Object.entries(provider.models)) {
      if (model.pricing) validatePricing(model.pricing, `providers.${providerId}.models.${modelId}`)
      if (model.option_specs) validateOptionSpecs(model.option_specs, `providers.${providerId}.models.${modelId}`)
    }
  }
}

async function main() {
  const [catalogRaw, piRaw] = await Promise.all([
    readFile(CATALOG_PATH, 'utf8').then((text) => JSON.parse(text) as CatalogDocument),
    readFile(PI_PATH, 'utf8').then((text) => JSON.parse(text) as Record<string, unknown>),
  ])
  validateCatalogDocument(catalogRaw, new Set(Object.keys(piRaw)))
  await validateCatalogV2(join(ROOT, 'dist', 'v2'))
  console.log('Catalog v1 and v2 validation passed.')
}

if (import.meta.main) {
  await main()
}
