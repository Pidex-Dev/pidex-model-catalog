import { z } from "zod";
import {
  CatalogModelFactsSchema,
  OptionSpecsSchema,
  PROTOCOL_ENDPOINT_APIS,
} from "./catalog";
import { PricingSchema, UnitPricesSchema } from "./pricing";

export const BillingMode = z.enum(["pay-as-you-go", "subscription", "free"]);
const Type = z.enum(["chat", "embedding", "rerank"]);
const Patch = z.record(z.string(), z.unknown());
const Api = z.enum([
  ...PROTOCOL_ENDPOINT_APIS,
  "azure-openai-responses",
  "bedrock-converse-stream",
  "google-vertex",
  "mistral-conversations",
  "openai-codex-responses",
  "pi-messages",
]);
const Header = z.object({
  owner: z.literal("pidex-model-catalog"),
  schemaVersion: z.literal(2),
  generatedAt: z.iso.datetime(),
  piVersion: z.string().min(1),
});
const File = z.object({ sha256: z.hash("sha256"), bytes: z.int().positive() });
export const ManifestV2 = Header.extend({
  files: z.object({
    providers: File.extend({
      path: z.literal("providers.json"),
      providerCount: z.int().nonnegative(),
      marketProviderCount: z.int().nonnegative(),
    }),
    models: File.extend({
      path: z.literal("models.json"),
      modelCount: z.int().nonnegative(),
      scheduleCount: z.int().nonnegative(),
    }),
  }),
});
export const Schedule = PricingSchema.omit({ idle: true, busy: true });
export const Promotion = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
    appliesTo: z.enum(["all", "idle", "busy"]).optional(),
    discountFactor: z.number().min(0).max(1).optional(),
    prices: UnitPricesSchema.optional(),
  })
  .refine(
    (p) =>
      Date.parse(p.startAt) < Date.parse(p.endAt) &&
      (p.discountFactor === undefined) !== (p.prices === undefined),
  );
export const CompactPricing = Schedule.partial().extend({
  scheduleId: z.string().optional(),
  billingMode: BillingMode.optional(),
  idle: UnitPricesSchema.optional(),
  busy: UnitPricesSchema.optional(),
  promotions: z.array(Promotion).optional(),
});
export const SPEED_TIER_KEYS = ["standard", "fast", "ultrafast"] as const;
export type SpeedTierKey = (typeof SPEED_TIER_KEYS)[number];
const tiers = <T extends z.ZodType>(tier: T) =>
  z.object({
    standard: tier.optional(),
    fast: tier.optional(),
    ultrafast: tier.optional(),
  });
const Invocation = z.object({
  requestModelId: z.string().optional(),
  payloadPatch: Patch.optional(),
});
const Overrides = CatalogModelFactsSchema.pick({
  limit: true,
  modalities: true,
  reasoning: true,
  tool_call: true,
  reasoning_options: true,
  option_specs: true,
  interleaved: true,
  temperature: true,
  structured_output: true,
});
const Binding = z.object({
  modelRef: z.string().optional(),
  name: z.string().optional(),
  type: Type.optional(),
  aliases: z.array(z.string()).optional(),
  api: Api.optional(),
  supportedProtocols: z.array(Api).optional(),
  baseUrl: z.url().optional(),
  compat: Patch.optional(),
  thinkingLevelMap: z.record(z.string(), z.string().nullable()).optional(),
  speedTiers: tiers(Invocation).optional(),
  routerFallback: Overrides.pick({
    limit: true,
    modalities: true,
    reasoning: true,
    tool_call: true,
  })
    .extend({
      billingMode: BillingMode.optional(),
    })
    .optional(),
});
const Provider = z.object({
  name: z.string(),
  marketVisible: z.boolean(),
  defaultProtocol: Api.optional(),
  protocolEndpoints: z.partialRecord(Api, z.url()),
  endpointAliases: z.array(z.url()).optional(),
  env: z.array(z.string()).optional(),
  billingMode: BillingMode.optional(),
  models: z.record(z.string(), Binding),
});
const AdditionalPrices = z.object({
  reasoningCost: z.number().nonnegative().optional(),
  inputAudioCost: z.number().nonnegative().optional(),
  outputAudioCost: z.number().nonnegative().optional(),
});
const OfferingDetails = AdditionalPrices.extend({
  pricing: CompactPricing.optional(),
  speedTiers: tiers(
    z.object({
      label: z.string().optional(),
      speedMultiplier: z.number().positive().optional(),
      pricing: CompactPricing,
    }),
  ).optional(),
  overrides: Overrides.optional(),
});
const Offering = OfferingDetails.extend({
  available: z.boolean(),
  providerModelId: z.string().optional(),
  modelOverrides: z.record(z.string(), OfferingDetails).optional(),
});
const Model = CatalogModelFactsSchema.omit({
  canonical_model_id: true,
  provider: true,
  pi_api: true,
  base_url: true,
  compat: true,
  thinking_level_map: true,
  pricing: true,
  cost: true,
}).extend({
  ...AdditionalPrices.shape,
  id: z.string(),
  name: z.string(),
  vendor: z.string(),
  type: Type,
  referencePricing: z
    .object({ sourceProviderId: z.string(), pricing: CompactPricing })
    .optional(),
  providers: z.record(z.string(), Offering),
});
export const ProvidersV2 = Header.extend({
  providers: z.record(z.string(), Provider),
});
export const ModelsV2 = Header.extend({
  optionRules: z
    .array(
      z.object({
        modelMatch: z.string(),
        apiTypeMatch: z.string().optional(),
        baseUrlMatch: z.string().optional(),
        optionSpecs: OptionSpecsSchema,
      }),
    )
    .optional(),
  pricingSchedules: z.record(z.string(), Schedule),
  models: z.record(z.string(), Model),
});

export type CompactPricing = z.infer<typeof CompactPricing>;
export type PricingPromotion = z.infer<typeof Promotion>;
export type CatalogV2Model = z.infer<typeof Model>;
export type CatalogV2Provider = z.infer<typeof Provider>;
export type ProviderModelBinding = z.infer<typeof Binding>;
export type V2Api = z.infer<typeof Api>;
export type ModelsDocumentV2 = z.infer<typeof ModelsV2>;
export type ProvidersDocumentV2 = z.infer<typeof ProvidersV2>;

export const isV2Api = (value: unknown): value is V2Api =>
  Api.safeParse(value).success;
