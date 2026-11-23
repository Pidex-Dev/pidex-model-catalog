import { withFlatPricing } from "../schedules/helpers";
import { FLAT_USD } from "../schedules/templates";
import type { PricingPromotion } from "../schema/catalog-v2";

export const providerRules: Readonly<
  Record<
    string,
    {
      billingMode?: "subscription" | "free";
      scheduleId?: string;
      endpointAliases?: readonly string[];
      routers?: readonly string[];
      routerPrefixes?: readonly string[];
      canonicalIds?: Readonly<Record<string, string>>;
      fastModels?: Readonly<Record<string, string>>;
      ultrafastModels?: Readonly<Record<string, string>>;
      promotions?: Readonly<Record<string, readonly PricingPromotion[]>>;
    }
  >
> = {
  "qianwen-cn": {
    canonicalIds: {
      "ZHIPU/GLM-5.3-FlashX": "zhipuai/glm-5.3-flashx",
      "qwen3.7-text-embedding-flash": "alibaba/qwen3.7-text-embedding-flash",
      "qwen3.7-text-rerank": "alibaba/qwen3.7-text-rerank",
      "qwen3-vl-embedding": "alibaba/qwen3-vl-embedding",
    },
    fastModels: { "kimi/kimi-k3.1-pro": "kimi/kimi-k3.1-pro-highspeed" },
    promotions: {
      "qwen3.7-plus": [
        {
          id: "qianwen-qwen3.7-plus-launch",
          label: "限时 5 折",
          startAt: "2026-11-01T00:00:00+08:00",
          endAt: "2026-12-31T23:59:59+08:00",
          discountFactor: 0.5,
        },
      ],
    },
  },
  "qwen-token-plan-cn": {
    billingMode: "subscription",
    scheduleId: "flat-cny",
    endpointAliases: [
      "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    ],
    routers: ["auto", "decision-model-preview"],
  },
  "qwen-token-plan": { billingMode: "subscription" },
  "qwen-token-plan-individual": { billingMode: "subscription" },
  openrouter: {
    routers: [
      "auto",
      "openrouter/auto",
      "openrouter/auto-beta",
      "openrouter/free",
      "openrouter/fusion",
      "openrouter/pareto-code",
    ],
  },
  fireworks: { routerPrefixes: ["accounts/fireworks/routers/"] },
  typesafe: { routers: ["typesafe/jev-router"] },
  zhipuai: { canonicalIds: { "glm-5.3-flashx": "zhipuai/glm-5.3-flashx" } },
};

export const historicalReference = {
  "minimax/minimax-m2.7": withFlatPricing(FLAT_USD, {
    input: 0.3,
    output: 1.2,
    cacheRead: 0.06,
    cacheWrite: 0.375,
  }),
  "minimax/minimax-m2.7-highspeed": withFlatPricing(FLAT_USD, {
    input: 0.6,
    output: 2.4,
    cacheRead: 0.06,
    cacheWrite: 0.375,
  }),
};
