import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogDocument, CatalogModelFacts } from "../src/schema/catalog";
import {
  isV2Api,
  ModelsV2,
  type CatalogV2Model,
  type CatalogV2Provider,
  type CompactPricing,
  type ModelsDocumentV2,
  type ProvidersDocumentV2,
  type ProviderModelBinding,
  type V2Api,
} from "../src/schema/catalog-v2";
import { historicalReference, providerRules } from "../src/overlays/v2";
import { ZCODE_MODEL_OPTION_RULES } from "../src/overlays/zcode-model-options";
import {
  DEEPSEEK_OFF_PEAK_CN,
  FLAT_CNY,
  FLAT_USD,
  QIANWEN_OFF_PEAK_CN,
} from "../src/schedules/templates";

const schedules = {
  "flat-cny": FLAT_CNY,
  "flat-usd": FLAT_USD,
  "deepseek-off-peak-cn": DEEPSEEK_OFF_PEAK_CN,
  "qianwen-off-peak-cn": QIANWEN_OFF_PEAK_CN,
};

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left, (_, value) => sortedObject(value)) ===
  JSON.stringify(right, (_, value) => sortedObject(value));

function sortedObject<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const entries = Object.entries(value).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return Object.fromEntries(entries) as T;
}

function compactPricing(model: CatalogModelFacts): CompactPricing | undefined {
  if (model.pricing) {
    const { idle, busy, ...schedule } = model.pricing;
    const scheduleId = Object.entries(schedules).find(([, known]) =>
      same(schedule, known),
    )?.[0];
    return {
      ...(scheduleId ? { scheduleId } : schedule),
      busy,
      ...(!same(idle, busy) ? { idle } : {}),
    };
  }
  const cost = model.cost;
  const tiers =
    cost?.tiers ??
    (cost?.context_over_200k
      ? [{ ...cost.context_over_200k, tier: { size: 200_000 } }]
      : undefined);
  if (!cost || (cost.input === undefined && cost.output === undefined))
    return undefined;
  return {
    scheduleId: "flat-usd",
    busy: {
      input: cost.input ?? null,
      output: cost.output ?? null,
      cacheRead: cost.cache_read ?? null,
      cacheWrite: cost.cache_write ?? null,
      ...(tiers?.length
        ? {
            tiers: tiers.map((tier) => ({
              inputTokensAbove: tier.tier.size,
              input: tier.input ?? null,
              output: tier.output ?? null,
              cacheRead: tier.cache_read ?? null,
              cacheWrite: tier.cache_write ?? null,
            })),
          }
        : {}),
    },
  };
}

const modelType = (value?: string) =>
  value === "embedding" || value === "rerank" ? value : "chat";
const sdkProtocol = (npm?: string, shape?: string): V2Api | undefined => {
  if (npm === "@ai-sdk/openai")
    return shape === "completions" ? "openai-completions" : "openai-responses";
  if (npm === "@ai-sdk/anthropic") return "anthropic-messages";
  if (npm === "@ai-sdk/google") return "google-generative-ai";
  if (npm === "@ai-sdk/google-vertex") return "google-vertex";
  if (npm === "@ai-sdk/amazon-bedrock") return "bedrock-converse-stream";
  return npm ? "openai-completions" : undefined;
};

function additionalPrices(cost: CatalogModelFacts["cost"]) {
  return {
    ...(cost?.reasoning !== undefined ? { reasoningCost: cost.reasoning } : {}),
    ...(cost?.input_audio !== undefined
      ? { inputAudioCost: cost.input_audio }
      : {}),
    ...(cost?.output_audio !== undefined
      ? { outputAudioCost: cost.output_audio }
      : {}),
  };
}

function makeModel(id: string, raw: CatalogModelFacts): CatalogV2Model {
  const {
    id: _id,
    canonical_model_id: _canonical,
    provider: _provider,
    pi_api: _api,
    base_url: _url,
    compat: _compat,
    thinking_level_map: _thinking,
    pricing,
    cost,
    ...facts
  } = raw;
  return {
    ...facts,
    ...additionalPrices(cost),
    id,
    name: raw.name ?? id,
    vendor: id.split("/")[0]!,
    type: modelType(raw.type),
    providers: {},
  };
}

const capabilityKeys = [
  "limit",
  "modalities",
  "reasoning",
  "tool_call",
  "reasoning_options",
  "option_specs",
  "interleaved",
  "temperature",
  "structured_output",
] as const;

export function buildCatalogV2(
  catalog: CatalogDocument,
  upstream?: {
    providers: Record<string, { models?: Record<string, CatalogModelFacts> }>;
  },
) {
  const models: ModelsDocumentV2["models"] = {};
  for (const [rawId, raw] of Object.entries(catalog.models)) {
    const id = rawId.toLowerCase();
    const rule = providerRules[id.split("/")[0]!];
    if (
      rule?.routers?.includes(id) ||
      /\/(?:auto|decision-model-preview)$/.test(id)
    )
      continue;
    const model = (models[id] = makeModel(id, raw));
    const upstreamOfficial = upstream?.providers[model.vendor]?.models;
    const historic = Object.entries(upstreamOfficial ?? {}).find(
      ([name]) => name.toLowerCase() === id.slice(id.indexOf("/") + 1),
    )?.[1];
    const explicit =
      historicalReference[id as keyof typeof historicalReference];
    const price = explicit
      ? compactPricing({ pricing: explicit })
      : (compactPricing(raw) ?? (historic && compactPricing(historic)));
    if (price)
      model.referencePricing = {
        sourceProviderId: model.vendor,
        pricing: price,
      };
    if (explicit || id.startsWith("minimax/minimax-m2.7"))
      model.status = "deprecated";
  }

  for (const [id, pricing] of Object.entries(historicalReference)) {
    if (models[id]) continue;
    models[id] = {
      ...makeModel(id, {
        name: id.endsWith("-highspeed")
          ? "MiniMax M2.7 Highspeed"
          : "MiniMax M2.7",
        limit: { context: 204_800, output: 131_072 },
        modalities: { input: ["text"], output: ["text"] },
        reasoning: true,
        tool_call: true,
        status: "deprecated",
      }),
      referencePricing: {
        sourceProviderId: "minimax",
        pricing: compactPricing({ pricing })!,
      },
    };
  }

  const providers: ProvidersDocumentV2["providers"] = {};
  const references = new Map<
    string,
    { rank: number; providerId: string; pricing: CompactPricing }
  >();
  for (const [id, raw] of Object.entries(catalog.providers)) {
    const rule = providerRules[id];
    const protocols: CatalogV2Provider["protocolEndpoints"] = {
      ...raw.protocolEndpoints,
    };
    const calls = Object.values(raw.models);
    const sdk = sdkProtocol(raw.npm);
    for (const call of calls) {
      const api = isV2Api(call.pi_api)
        ? call.pi_api
        : sdkProtocol(call.provider?.npm, call.provider?.shape);
      const url = call.base_url ?? call.provider?.api;
      if (api && url) protocols[api] ??= url;
    }
    if (sdk && raw.api) protocols[sdk] ??= raw.api;
    const defaultProtocol =
      (Object.entries(protocols).find(([, url]) => raw.api === url)?.[0] as
        V2Api | undefined) ??
      (isV2Api(calls[0]?.pi_api)
        ? calls[0].pi_api
        : (sdk ?? (Object.keys(protocols)[0] as V2Api | undefined)));
    const aliases = [
      ...new Set([...(raw.endpoints ?? []), ...(rule?.endpointAliases ?? [])]),
    ].filter((url) => !Object.values(protocols).includes(url));
    const provider: CatalogV2Provider = {
      name: raw.name ?? id,
      marketVisible: raw.marketVisible,
      defaultProtocol,
      protocolEndpoints: protocols,
      ...(aliases.length ? { endpointAliases: aliases } : {}),
      ...(raw.env ? { env: raw.env } : {}),
      ...(rule?.billingMode ? { billingMode: rule.billingMode } : {}),
      models: {},
    };
    providers[id] = provider;
    const speedTierIds = new Set([
      ...Object.values(rule?.fastModels ?? {}),
      ...Object.values(rule?.ultrafastModels ?? {}),
    ]);
    for (const [providerModelId, call] of Object.entries(raw.models)) {
      if (speedTierIds.has(providerModelId)) continue;
      const type = modelType(call.type);
      const api = isV2Api(call.pi_api)
        ? call.pi_api
        : type === "embedding" && protocols["openai-embeddings"]
          ? "openai-embeddings"
          : type === "rerank" && protocols["jina-rerank"]
            ? "jina-rerank"
            : (sdkProtocol(call.provider?.npm, call.provider?.shape) ??
              defaultProtocol);
      const baseUrl = call.base_url ?? call.provider?.api;
      const fastId = rule?.fastModels?.[providerModelId];
      const ultrafastId = rule?.ultrafastModels?.[providerModelId];
      const bindingSpeedTiers =
        fastId || ultrafastId
          ? {
              ...(fastId ? { fast: { requestModelId: fastId } } : {}),
              ...(ultrafastId
                ? { ultrafast: { requestModelId: ultrafastId } }
                : {}),
            }
          : undefined;
      const tierAliasIds = [fastId, ultrafastId].filter(
        (value): value is string => Boolean(value),
      );
      const binding: ProviderModelBinding = {
        ...(api && api !== defaultProtocol ? { api } : {}),
        ...(baseUrl && baseUrl !== (api && protocols[api]) ? { baseUrl } : {}),
        ...(call.compat ? { compat: call.compat } : {}),
        ...(call.thinking_level_map
          ? { thinkingLevelMap: call.thinking_level_map }
          : {}),
        ...(bindingSpeedTiers ? { speedTiers: bindingSpeedTiers } : {}),
        ...(call.aliases?.length || tierAliasIds.length
          ? {
              aliases: [...new Set([...(call.aliases ?? []), ...tierAliasIds])],
            }
          : {}),
      };
      provider.models[providerModelId] = binding;
      if (
        rule?.routers?.includes(providerModelId) ||
        rule?.routerPrefixes?.some((prefix) =>
          providerModelId.startsWith(prefix),
        ) ||
        /^(?:auto|decision-model-preview)$/i.test(providerModelId)
      ) {
        binding.name = call.name ?? providerModelId;
        binding.type = type;
        binding.routerFallback = {
          reasoning: call.reasoning,
          tool_call: call.tool_call,
          limit: call.limit,
          modalities: call.modalities,
          billingMode: rule?.billingMode,
        };
        continue;
      }
      const normalizedId = providerModelId.toLowerCase();
      const knownId = normalizedId.split(":")[0]!;
      const ref = (
        rule?.canonicalIds?.[providerModelId] ??
        call.canonical_model_id ??
        (models[knownId] || knownId.includes("/")
          ? knownId
          : id + "/" + knownId)
      ).toLowerCase();
      const model = (models[ref] ??= makeModel(ref, call));
      const overrides = Object.fromEntries(
        capabilityKeys
          .filter(
            (key) => call[key] !== undefined && !same(call[key], model[key]),
          )
          .map((key) => [key, call[key]]),
      );
      binding.modelRef = ref;
      if (call.name && call.name !== model.name) binding.name = call.name;
      if (call.type && type !== model.type) binding.type = type;
      let pricing: CompactPricing | undefined = rule?.billingMode
        ? {
            billingMode: rule.billingMode,
            scheduleId: rule.scheduleId ?? "flat-usd",
          }
        : compactPricing(call);
      if (pricing && rule?.promotions?.[providerModelId]) {
        pricing = {
          ...pricing,
          promotions: [...rule.promotions[providerModelId]],
        };
      }
      const fastPricing = fastId
        ? compactPricing(raw.models[fastId] ?? {})
        : undefined;
      if (fastId && !fastPricing)
        throw new Error("Missing speed tier price: " + id + "/" + fastId);
      const ultrafastPricing = ultrafastId
        ? compactPricing(raw.models[ultrafastId] ?? {})
        : undefined;
      if (ultrafastId && !ultrafastPricing)
        throw new Error("Missing speed tier price: " + id + "/" + ultrafastId);
      const offeringSpeedTiers =
        fastPricing || ultrafastPricing
          ? {
              ...(fastPricing
                ? { fast: { label: "Fast", pricing: fastPricing } }
                : {}),
              ...(ultrafastPricing
                ? {
                    ultrafast: {
                      label: "Ultrafast",
                      pricing: ultrafastPricing,
                    },
                  }
                : {}),
            }
          : undefined;
      const offering = {
        ...additionalPrices(call.cost),
        ...(pricing ? { pricing } : {}),
        ...(offeringSpeedTiers ? { speedTiers: offeringSpeedTiers } : {}),
        ...(Object.keys(overrides).length ? { overrides } : {}),
      };
      const existing = model.providers[id];
      if (existing) {
        const variants = (existing.modelOverrides ??= {});
        variants[providerModelId] = offering;
      } else {
        model.providers[id] = { available: true, providerModelId, ...offering };
      }
      const native =
        id === model.vendor ||
        id.startsWith(model.vendor + "-") ||
        (ref.startsWith("alibaba/") && id === "qianwen-cn");
      if (
        pricing &&
        native &&
        !pricing.billingMode &&
        !providerModelId.includes(":")
      ) {
        const rank = id === model.vendor ? 0 : 1;
        if ((references.get(ref)?.rank ?? Infinity) > rank) {
          const { promotions: _promotions, ...base } = pricing;
          references.set(ref, { rank, providerId: id, pricing: base });
        }
      }
    }
  }
  for (const [id, candidate] of references) {
    const model = models[id]!;
    if (
      !model.referencePricing ||
      candidate.providerId === model.vendor ||
      (candidate.pricing.busy?.input !== undefined &&
        candidate.pricing.scheduleId !== "flat-usd")
    ) {
      model.referencePricing = {
        sourceProviderId: candidate.providerId,
        pricing: candidate.pricing,
      };
    }
  }

  const header = {
    owner: catalog.owner,
    schemaVersion: 2 as const,
    generatedAt: catalog.generatedAt,
    piVersion: catalog.piVersion,
  };
  return {
    providers: { ...header, providers },
    models: {
      ...header,
      models,
      pricingSchedules: JSON.parse(JSON.stringify(schedules)),
      optionRules: JSON.parse(JSON.stringify(ZCODE_MODEL_OPTION_RULES)),
    },
  } satisfies { providers: ProvidersDocumentV2; models: ModelsDocumentV2 };
}

async function readPrevious(path: string) {
  return readFile(path, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => undefined);
}

async function writeDocument(
  path: string,
  document: ProvidersDocumentV2 | ModelsDocumentV2,
  previous: unknown,
) {
  const prior = previous as { generatedAt?: string } | undefined;
  document.generatedAt =
    prior &&
    typeof prior.generatedAt === "string" &&
    same(
      { ...prior, generatedAt: undefined },
      { ...document, generatedAt: undefined },
    )
      ? prior.generatedAt
      : document.generatedAt;
  const text = JSON.stringify(document, (_, value) => sortedObject(value));
  await writeFile(path, text, "utf8");
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    bytes: Buffer.byteLength(text),
  };
}

export async function writeCatalogV2(
  dir: string,
  catalog: CatalogDocument,
  upstream: Parameters<typeof buildCatalogV2>[1],
) {
  const v2 = buildCatalogV2(catalog, upstream);
  const providerPath = join(dir, "providers.json");
  const modelPath = join(dir, "models.json");
  const [previousProviders, previousModels] = await Promise.all([
    readPrevious(providerPath),
    readPrevious(modelPath),
  ]);
  const history = ModelsV2.safeParse(previousModels);
  if (history.success) {
    for (const [id, model] of Object.entries(history.data.models)) {
      if (v2.models.models[id]) continue;
      v2.models.models[id] = { ...model, status: "deprecated", providers: {} };
      const scheduleId = model.referencePricing?.pricing.scheduleId;
      const schedule = scheduleId
        ? history.data.pricingSchedules[scheduleId]
        : undefined;
      if (scheduleId && schedule)
        v2.models.pricingSchedules[scheduleId] ??= schedule;
    }
  }
  await mkdir(dir, { recursive: true });
  const [providers, models] = await Promise.all([
    writeDocument(providerPath, v2.providers, previousProviders),
    writeDocument(modelPath, v2.models, previousModels),
  ]);
  const { owner, piVersion, generatedAt } = catalog;
  const manifest = {
    owner,
    schemaVersion: 2,
    piVersion,
    generatedAt,
    files: {
      providers: {
        path: "providers.json",
        ...providers,
        providerCount: Object.keys(v2.providers.providers).length,
        marketProviderCount: Object.values(v2.providers.providers).filter(
          (provider) => provider.marketVisible,
        ).length,
      },
      models: {
        path: "models.json",
        ...models,
        modelCount: Object.keys(v2.models.models).length,
        scheduleCount: Object.keys(v2.models.pricingSchedules).length,
      },
    },
  };
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
}
