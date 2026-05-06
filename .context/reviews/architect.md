# Architecture Review — cherrypicker (Cycle 32)

**Reviewer:** architect (worker-7)
**Date:** 2026-05-06
**Scope:** System boundaries, data flow, package layering, long-term maintainability

---

## Executive Summary

The monorepo retains its **conceptually sound layered architecture** (`rules` → `core` → `viz`/`cli`/`web`) with a runtime-agnostic core. However, the three most critical architectural debts from prior cycles remain **completely unaddressed**:

1. **Server/web parser duplication** — now covering 6 formats with near-identical implementations
2. **Type duplication and adapter bloat** in the web app's analyzer layer
3. **No workspace boundary enforcement** — the web app bypasses `packages/parser/` entirely

New findings in this cycle include a **fragile greedy optimizer extension point**, **double-loading of card data** (YAML for CLI, JSON for web with no shared validation guarantee), and **over-complex sessionStorage persistence** mixed into the Svelte store.

**Verdict:** Structural debt continues to accumulate. The codebase needs a dedicated refactoring cycle to extract isomorphic parser logic before adding new bank adapters or formats.

---

## New Findings (Cycle 32)

### [C32-ARCH01-HIGH] Greedy optimizer extension point is a façade

**File:** `packages/core/src/optimizer/index.ts:10-31`
**Confidence:** High

```typescript
export type OptimizeMethod = 'greedy';

export function optimize(
  constraints: OptimizationConstraints,
  cardRules: CardRuleSet[],
  options: OptimizeOptions = {},
): OptimizationResult {
  const method = options.method ?? 'greedy';
  switch (method) {
    case 'greedy':
    default:
      return greedyOptimize(constraints, cardRules);
  }
}
```

The `OptimizeMethod` union and `options.method` parameter suggest a pluggable optimizer architecture, but:
- `'greedy'` is the only literal in the union
- The `default` case silently falls through to greedy — invalid method names produce no error
- There is no registry, factory, or injection point for alternative algorithms

This is **interface debt pretending to be architecture**. A future developer might reasonably expect to add `'ilp'` or `'dynamic'` as a method, but there is no hook to do so.

**Concrete failure scenario:** A contributor adds `method: 'ilp'` to an `optimize()` call, expecting an integer-linear-programming solver. The call compiles (TypeScript allows it because `'ilp' extends string` and `OptimizeMethod` is just `'greedy'`), runs silently, and produces greedy results. The user believes they are getting ILP-optimal assignments but are not.

**Fix:** Either (a) remove `OptimizeMethod` and `options.method` entirely until a second optimizer exists, or (b) add an explicit `assertNever` in the `default` case that throws at runtime for unknown methods.

---

### [C32-ARCH02-HIGH] Web app duplicates OptimizationResult and related types in store.svelte.ts

**File:** `apps/web/src/lib/store.svelte.ts:11-66` vs `packages/core/src/models/result.ts:1-51`
**Confidence:** High

The web store re-declares `CategoryReward`, `CapInfo`, `CardRewardResult`, `CardAssignment`, and `OptimizationResult` — all structurally identical to types exported by `@cherrypicker/core`. The web app already depends on `@cherrypicker/core` (`apps/web/package.json:17`), so these could be imported directly.

**Why this matters:**
- Any schema change in `core` (e.g., adding a field to `CapInfo`) requires manual sync in two files
- The duplicated `CapInfo` in the store (`apps/web/src/lib/store.svelte.ts:23-29`) lacks the `category` field that exists in the core version — a drift that has already occurred

**Fix:** Remove the local type declarations and import from `@cherrypicker/core`.

---

### [C32-ARCH03-HIGH] `toCoreCardRuleSets()` runtime adapter indicates upstream type narrowing failure

**File:** `apps/web/src/lib/analyzer.ts:47-81`
**Confidence:** High

The web app loads card rules as static JSON via `fetch()`, then runs them through a runtime adapter that narrows `string` fields to enum literals:

```typescript
const VALID_SOURCES = new Set(['manual', 'llm-scrape', 'web']);
const VALID_REWARD_TYPES = new Set(['discount', 'points', 'cashback', 'mileage']);
```

This exists because the JSON loader (`cards.ts`) returns `string` where the core expects `'manual' | 'llm-scrape' | 'web'`.

**The root cause:** The YAML → JSON build pipeline does not appear to validate output with the Zod schemas from `@cherrypicker/rules`. The CLI path validates every YAML file with `cardRuleSetSchema.safeParse()` (`packages/rules/src/loader.ts:8-14`), but the web path trusts the pre-built JSON.

**Concrete failure scenario:** A malformed card rule YAML (e.g., `source: automated` instead of `llm-scrape`) passes through the build pipeline into `cards.json`. The web app loads it, the `VALID_SOURCES` fallback assigns `'web'`, and the card silently changes its provenance. If the build pipeline had validated, the error would be caught at build time.

**Fix:** Ensure the build pipeline validates JSON output with the same Zod schemas. Then remove `toCoreCardRuleSets()` and use `@cherrypicker/rules` types directly.

---

### [C32-ARCH04-MEDIUM] Card data is loaded via two independent mechanisms with no shared validation

**Files:** `packages/rules/src/loader.ts:7-66` vs `apps/web/src/lib/cards.ts:136-184`
**Confidence:** High

| Path | Loader | Format | Validation |
|------|--------|--------|------------|
| CLI/tools | `loadCardRule()` | YAML | Zod (`cardRuleSetSchema.safeParse()`) |
| Web app | `loadCardsData()` | JSON | None (trusts pre-built output) |

The web app's `loadCardsData()` fetches `/data/cards.json` and casts via `as Promise<CardsJson>` without any schema validation. The `CardsJson` interface (`apps/web/src/lib/cards.ts:62-80`) is a hand-written type that mirrors but does not derive from the Zod schemas.

This means the web app has **no runtime guarantee** that the JSON matches the expected shape. A build pipeline bug (e.g., missing `annualFee` field) would produce a runtime crash in the optimizer, not a build-time error.

**Fix:** Add Zod validation to `loadCardsData()` or use `zod` to parse the fetched JSON. The `yaml` dependency is already in `packages/rules`; the web app could depend on `@cherrypicker/rules` and use its schemas.

---

### [C32-ARCH05-MEDIUM] sessionStorage persistence logic is over-complex and mixed into the store

**File:** `apps/web/src/lib/store.svelte.ts:99-366`
**Confidence:** Medium

The `store.svelte.ts` file (654 lines) contains:
- State management (~80 lines)
- sessionStorage persistence with size truncation (~120 lines)
- Schema versioning and migration hooks (~40 lines)
- Defensive validation of persisted data (~126 lines)
- Cache management for category labels (~20 lines)

This violates the single-responsibility principle. The persistence layer is tightly coupled to the Svelte store implementation, making it impossible to test independently or swap to `localStorage`/`indexedDB` without modifying the store.

**Specific issue:** The `loadFromStorage()` function (`:226-352`) contains 126 lines of hand-rolled validation that suggests the data format is unstable. The comment at `:107-114` explicitly states migrations are planned but none exist yet — the infrastructure is there but unused.

**Fix:** Extract persistence into a separate `storage.ts` module with a narrow interface:
```typescript
interface StorageAdapter {
  load(): AnalysisResult | null;
  save(result: AnalysisResult): PersistResult;
  clear(): void;
}
```

---

### [C32-ARCH06-MEDIUM] MerchantMatcher LRU cache has hardcoded limit with no configurability

**File:** `packages/core/src/categorizer/matcher.ts:27-139`
**Confidence:** Medium

```typescript
private static readonly MAX_CACHE_SIZE = 500;
```

The `MerchantMatcher` uses an LRU cache keyed by normalized merchant name + raw category. For users with large statements (>500 unique merchants), the cache evicts entries. This is safe (cache is only a performance optimization), but:
1. The limit is arbitrary — not derived from memory constraints or benchmark data
2. The cache is not configurable — callers cannot tune it
3. For multi-file uploads with thousands of transactions, the cache hit rate degrades

**Fix:** Accept `maxCacheSize` as a constructor option with a sensible default.

---

### [C32-ARCH07-LOW] `@cherrypicker/viz` may be unused in the web app

**File:** `apps/web/package.json:18`
**Confidence:** Low

The web app declares `@cherrypicker/viz` as a dependency, but all UI rendering appears to use custom Svelte components (`apps/web/src/components/`). The `viz` package contains terminal tables and HTML report generation — neither of which appears to be used in the Astro/Svelte frontend.

If confirmed, this dependency should be removed to reduce bundle size and eliminate a false coupling.

**Verification needed:** Search for imports from `@cherrypicker/viz` in `apps/web/src/`.

---

## Previously Reported Findings — Status Update

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 / C20-ARCH02 | Server/web parser duplication (6 formats) | **CRITICAL** | **OPEN — UNCHANGED** Duplication remains complete with parity comments growing |
| A-ARCH-03 / C20-ARCH01 | Analyzer cache not keyed by cardIds | HIGH | **OPEN — UNCHANGED** Same single-global-cache pattern |
| A-ARCH-05 | No workspace boundary enforcement | MEDIUM | **OPEN — UNCHANGED** Web app still bypasses `packages/parser/` entirely |

---

## Structural Analysis

### Package Boundaries (Good)

```
rules (Zod schemas + YAML data) ──→ pure TS, no runtime APIs
  ↑
core (optimizer, calculator, categorizer) ──→ pure TS, no runtime APIs
  ↑
  ├─→ viz (terminal + HTML reports) ──→ Node/Bun APIs
  ├─→ cli (command entrypoint) ──→ Bun, depends on core + parser + viz
  └─→ web (Astro + Svelte) ──→ Node (build) / Browser (runtime)
```

The `packages/core/` and `packages/rules/` packages correctly avoid runtime-specific APIs. This enables future portability.

### The Parser Gap (Bad)

The architectural diagram above is incomplete because `packages/parser/` exists but is **not consumed by the web app**. Instead, the web app has a parallel implementation:

```
packages/parser/ ──→ Bun (fs, Buffer) ──→ used by CLI only
apps/web/src/lib/parser/ ──→ Browser (File, ArrayBuffer) ──→ used by web only
```

This means the parser business logic (bank signatures, column patterns, date formats, amount regexes) exists in two places. The parity comments ("C89-01", "C73-02", "C15-03") are evidence of manual backporting.

**The fix is well-understood:** Extract isomorphic parsing logic into a shared pure-TS module. Runtime-specific I/O (file reading, Buffer/ArrayBuffer) becomes a thin wrapper. The codebase itself acknowledges this in `apps/web/src/lib/parser/csv.ts:103-107`:

> "Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments)."

---

## Data Flow Review

### Parser → Categorizer → Optimizer Pipeline

```
[File Upload]
  → parseFile() ──→ RawTransaction[]
  → MerchantMatcher.match() ──→ CategorizedTx[]
  → optimizeFromTransactions() ──→ OptimizationResult
  → Svelte store ──→ Dashboard components
```

This pipeline is clean and unidirectional. The `MerchantMatcher` is constructed once and shared across multiple files (`analyzer.ts:296`), avoiding redundant `loadCategories()` calls.

### Card Rules Loading (Dual Path)

```
CLI:   YAML files → Zod validation → CardRuleSet[] → optimizer
Web:   fetch('/data/cards.json') → as CardsJson → toCoreCardRuleSets() → optimizer
```

The CLI path validates at runtime. The web path trusts the build pipeline. No shared validation step exists.

---

## Files Examined

All source files in the following directories were reviewed:
- `packages/core/src/` — calculator, categorizer, models, optimizer (20 files)
- `packages/parser/src/` — csv, pdf, xlsx, html, json, ofx, detect, types (19 files)
- `packages/rules/src/` — schema, loader, types, category-names (5 files)
- `packages/viz/src/` — report generator, terminal tables (4 files)
- `apps/web/src/lib/` — parser, analyzer, store, cards, api, formatters (18 files)
- `apps/web/src/components/` — cards, dashboard, report, ui, upload (14 files)
- `tools/cli/src/` — commands, index (7 files)
- `tools/scraper/src/` — extractor, fetcher, prompts, validators, writer (7 files)
- Root configs: `package.json`, `tsconfig.base.json`, `turbo.json`, `playwright.config.ts`
- Web configs: `astro.config.ts`, `apps/web/package.json`

No relevant file was skipped.

---

## Verdict

**FIX AND SHIP** — C32-ARCH01, C32-ARCH02, C32-ARCH03 are bounded fixes (remove façade types, add validation, error on unknown optimizer methods). C32-ARCH04 and C32-ARCH05 are medium-effort refactors. The structural debt of parser duplication (A-ARCH-01) remains the highest-priority architectural concern and requires a dedicated refactoring cycle.
