# Pidex Model Catalog

Current clients read `v2/manifest.json` and fetch only changed, SHA-256-addressed payloads. `v2/providers.json` describes callable models and transport, including router entries and speed tier invocation. `v2/models.json` contains model capabilities, provider-specific pricing and historical reference prices. Existing clients still receive the original v1 artifacts.

Self-maintained model catalog for Pidex, synthesized from three layers:

1. **Base (`https://pi.dev/api/models`)**: Pi stable providers, runtime `api`, `baseUrl`, `compat`, and `thinkingLevelMap`. Only providers listed in `MARKET_VISIBLE_PROVIDERS` (`src/allowlist.ts`, currently `deepseek`, `minimax-cn`, `minimax`) have `marketVisible: true` and appear in the Pidex Provider Market; all other Pi providers stay in the catalog with `marketVisible: false` so `smartConfig` and future one-line market activation remain intact.
2. **Enrichment (`https://models.dev/catalog.json?type=all`)**: model descriptions, modalities, benchmarks, canonical model facts, and curated extra recommendation providers (`marketVisible: false` for custom-provider `smartConfig`).
3. **Authoritative TypeScript Overlays (`src/overlays/`)**: thinking effort specifications, optional CEL request mappings (`option_specs`), and busy/idle × long-context tiered `pricing`.

## Commands

```bash
bun install
bun run sync       # Fetch & filter pi.dev + models.dev into src/upstream/
bun run build      # Build both v1 and v2 under dist/
bun run validate   # Validate Schema, CEL option maps, pricing schedules & allowlist
bun run typecheck
bun test
```

## Deployment

Merging to `main` builds and deploys `dist/` via Cloudflare Pages Direct Upload (`pidex-model-catalog` -> `https://models.codepilotx.top/v1/catalog.json`).
