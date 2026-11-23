import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ManifestV2,
  ModelsV2,
  ProvidersV2,
  SPEED_TIER_KEYS,
  type CompactPricing,
} from "../src/schema/catalog-v2";
import { validateOptionSpecs } from "../src/schema/cel-check";
import { validatePricing } from "../src/schema/pricing";

const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export async function validateCatalogV2(directory: string) {
  const manifest = ManifestV2.parse(
    JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")),
  );
  const read = async (entry: {
    path: string;
    bytes: number;
    sha256: string;
  }) => {
    const bytes = await readFile(join(directory, entry.path));
    if (
      bytes.length !== entry.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    )
      throw new Error("Manifest checksum mismatch: " + entry.path);
    return JSON.parse(bytes.toString("utf8"));
  };
  const [providersDoc, modelsDoc] = await Promise.all([
    read(manifest.files.providers).then((raw) => ProvidersV2.parse(raw)),
    read(manifest.files.models).then((raw) => ModelsV2.parse(raw)),
  ]);
  const { providers } = providersDoc;
  const { models, pricingSchedules } = modelsDoc;
  for (const rule of modelsDoc.optionRules ?? []) {
    validateOptionSpecs(rule.optionSpecs, "option rule " + rule.modelMatch);
  }
  if (
    providersDoc.piVersion !== manifest.piVersion ||
    modelsDoc.piVersion !== manifest.piVersion ||
    Object.keys(providers).length !== manifest.files.providers.providerCount ||
    Object.values(providers).filter((p) => p.marketVisible).length !==
      manifest.files.providers.marketProviderCount ||
    Object.keys(models).length !== manifest.files.models.modelCount ||
    Object.keys(pricingSchedules).length !== manifest.files.models.scheduleCount
  ) {
    throw new Error("Manifest metadata mismatch");
  }
  const checkPrice = (raw: CompactPricing | undefined, label: string) => {
    if (!raw) return;
    const { scheduleId, billingMode, promotions: _, ...pricing } = raw;
    const schedule = scheduleId ? pricingSchedules[scheduleId] : {};
    if (!schedule) throw new Error(label + ": unknown schedule");
    const busy =
      pricing.busy ??
      (billingMode === "subscription" || billingMode === "free"
        ? zero
        : undefined);
    const expanded = {
      currency: "USD",
      timeZone: "UTC",
      defaultPeriod: "busy",
      rules: [],
      dateOverrides: [],
      ...schedule,
      ...pricing,
      busy,
      idle: pricing.idle ?? busy,
    };
    validatePricing(expanded, label);
    for (const promotion of raw.promotions ?? [])
      if (promotion.prices)
        validatePricing(
          { ...expanded, busy: promotion.prices, idle: promotion.prices },
          label,
        );
  };
  for (const [providerId, provider] of Object.entries(providers)) {
    for (const [modelId, binding] of Object.entries(provider.models)) {
      const label = providerId + "/" + modelId;
      if (!binding.modelRef) {
        if (!binding.routerFallback)
          throw new Error(label + ": missing router fallback");
        continue;
      }
      const model = models[binding.modelRef];
      const offering = model?.providers[providerId];
      if (
        !offering?.available ||
        (offering.providerModelId !== modelId &&
          !offering.modelOverrides?.[modelId])
      )
        throw new Error(label + ": missing available model offering");
      const details = offering.modelOverrides?.[modelId] ?? offering;
      for (const tier of SPEED_TIER_KEYS) {
        if (
          Boolean(binding.speedTiers?.[tier]) !==
          Boolean(details.speedTiers?.[tier])
        )
          throw new Error(
            label + ": speed tier must define invocation and pricing",
          );
      }
    }
  }
  for (const [id, model] of Object.entries(models)) {
    if (id !== model.id) throw new Error("Incorrect model identity: " + id);
    checkPrice(model.referencePricing?.pricing, id);
    if (model.option_specs) validateOptionSpecs(model.option_specs, id);
    for (const [providerId, offering] of Object.entries(model.providers)) {
      const label = providerId + "/" + id;
      if (
        offering.available &&
        (!offering.providerModelId ||
          providers[providerId]?.models[offering.providerModelId]?.modelRef !==
            id)
      )
        throw new Error(label + ": missing provider binding");
      for (const details of [
        offering,
        ...Object.values(offering.modelOverrides ?? {}),
      ]) {
        checkPrice(details.pricing, label);
        for (const profile of Object.values(details.speedTiers ?? {}))
          checkPrice(profile?.pricing, label);
        if (details.overrides?.option_specs)
          validateOptionSpecs(details.overrides.option_specs, label);
      }
    }
  }
}
