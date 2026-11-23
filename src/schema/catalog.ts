import { z } from 'zod'
import { PricingSchema, type Pricing } from './pricing'

export const ReasoningOptionSchema = z.object({
  type: z.enum(['toggle', 'effort', 'budget_tokens']),
  values: z.array(z.string().nullable()).optional(),
  default: z.string().optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
})

export const OptionSpecsSchema = z.object({
  reasoningLevel: z
    .object({
      values: z.array(z.string().min(1)).min(1).optional(),
      map: z.string().min(1).optional(),
    })
    .optional(),
  maxOutputTokens: z
    .object({
      max: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
      map: z.string().min(1).optional(),
    })
    .optional(),
})

export const CostTierSchema = z.object({
  tier: z.object({
    type: z.string().optional(),
    size: z.number().int().nonnegative(),
  }),
  input: z.number().finite().nonnegative(),
  output: z.number().finite().nonnegative(),
  cache_read: z.number().finite().nonnegative().optional(),
  cache_write: z.number().finite().nonnegative().optional(),
})

export const CostSchema = z.object({
  input: z.number().finite().nonnegative().optional(),
  output: z.number().finite().nonnegative().optional(),
  cache_read: z.number().finite().nonnegative().optional(),
  cache_write: z.number().finite().nonnegative().optional(),
  reasoning: z.number().finite().nonnegative().optional(),
  input_audio: z.number().finite().nonnegative().optional(),
  output_audio: z.number().finite().nonnegative().optional(),
  tiers: z.array(CostTierSchema).optional(),
  context_over_200k: z
    .object({
      input: z.number().finite().nonnegative(),
      output: z.number().finite().nonnegative(),
      cache_read: z.number().finite().nonnegative().optional(),
      cache_write: z.number().finite().nonnegative().optional(),
    })
    .optional(),
})

export const CatalogModelFactsSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    canonical_model_id: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    description: z.string().optional(),
    family: z.string().optional(),
    knowledge: z.string().optional(),
    release_date: z.string().optional(),
    last_updated: z.string().optional(),
    status: z.enum(['alpha', 'beta', 'deprecated']).optional(),
    open_weights: z.boolean().optional(),
    license: z.string().optional(),
    links: z
      .array(
        z.object({
          label: z.string().optional(),
          url: z.string(),
          type: z.string().optional(),
        }),
      )
      .optional(),
    weights: z
      .array(
        z.object({
          label: z.string().optional(),
          url: z.string(),
          format: z.string().optional(),
          quantization: z.string().optional(),
        }),
      )
      .optional(),
    benchmarks: z
      .array(
        z.object({
          name: z.string(),
          score: z.union([z.number().finite(), z.string()]),
          metric: z.string().optional(),
          harness: z.string().optional(),
          variant: z.string().optional(),
          dataset: z.string().optional(),
          version: z.string().optional(),
          source: z.string().optional(),
          date: z.string().optional(),
        }),
      )
      .optional(),
    attachment: z.boolean().optional(),
    temperature: z.boolean().optional(),
    structured_output: z.boolean().optional(),
    interleaved: z.union([z.boolean(), z.object({ field: z.string() })]).optional(),
    provider: z
      .object({
        npm: z.string().optional(),
        api: z.string().optional(),
        shape: z.string().optional(),
      })
      .optional(),
    limit: z
      .object({
        context: z.number().int().nonnegative().optional(),
        input: z.number().int().positive().optional(),
        output: z.number().int().nonnegative().optional(),
      })
      .optional(),
    modalities: z
      .object({
        input: z.array(z.string()).optional(),
        output: z.array(z.string()).optional(),
      })
      .optional(),
    reasoning: z.boolean().optional(),
    tool_call: z.boolean().optional(),
    reasoning_options: z.array(ReasoningOptionSchema).optional(),
    option_specs: OptionSpecsSchema.optional(),
    cost: CostSchema.optional(),
    pricing: PricingSchema.optional(),
    // Pi base runtime metadata preserved for Pi market providers
    pi_api: z.string().optional(),
    base_url: z.string().optional(),
    compat: z.record(z.string(), z.unknown()).optional(),
    thinking_level_map: z.record(z.string(), z.string().nullable()).optional(),
  })
  .strict()

export const CatalogProviderSchema = z.object({
  name: z.string().optional(),
  api: z.string().optional(),
  endpoints: z.array(z.string().min(1)).optional(),
  env: z.array(z.string()).optional(),
  npm: z.string().optional(),
  marketVisible: z.boolean(),
  models: z.record(z.string(), CatalogModelFactsSchema),
})

export const CatalogDocumentSchema = z.object({
  owner: z.literal('pidex-model-catalog'),
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  piVersion: z.string().min(1),
  models: z.record(z.string(), CatalogModelFactsSchema),
  providers: z.record(z.string(), CatalogProviderSchema),
})

export type ReasoningOption = z.infer<typeof ReasoningOptionSchema>
export type OptionSpecs = z.infer<typeof OptionSpecsSchema>
export type CatalogModelFacts = z.infer<typeof CatalogModelFactsSchema>
export type CatalogProvider = z.infer<typeof CatalogProviderSchema>
export type CatalogDocument = z.infer<typeof CatalogDocumentSchema>

export type ModelFactsPatch = Omit<CatalogModelFacts, 'pricing'> & {
  readonly pricing?: Pricing
}

export interface ProviderOverlay {
  readonly providerId: string
  readonly name?: string
  readonly api?: string
  readonly endpoints?: readonly string[]
  readonly env?: readonly string[]
  readonly npm?: string
  readonly models: Readonly<Record<string, ModelFactsPatch>>
}

export type ModelOverlayMap = Readonly<Record<string, ModelFactsPatch>>
