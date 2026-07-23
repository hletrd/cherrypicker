# Architecture Review — Cycle 1

**Reviewer:** architect
**Date:** 2026-07-23
**Scope:** Entire current repository at `e6fe49b`; boundaries, domain modeling, data flow, validation, and evolvability
**Outcome:** 1 Critical, 4 High, 1 Medium findings

## Architecture assessment

The monorepo boundaries are understandable, but the product's central domain contract is duplicated across data, runtime, build, scraper, and UI layers. The compiler validates local TypeScript shapes while the important semantic relationships—category reachability, reward units, condition support, and spending provenance—remain implicit. Current catalog-scale failures are the direct result.

## Findings

### ARCH-01 — There is no authoritative category/reward language

**Severity:** Critical
**Confidence:** High
**Status:** Confirmed by cross-layer and full-catalog audit

**Evidence**

- Taxonomy emission: `packages/core/src/categorizer/taxonomy.ts:30-55`.
- Four independently authored keyword maps merged with silent last-writer-wins behavior: `packages/core/src/categorizer/matcher.ts:8-19`.
- Open string fields in the rule schema: `packages/rules/src/schema.ts:26-39,65-70`.
- A second, relaxed schema in the generator: `scripts/build-json.ts:18-81`.
- A third contract in the scraper prompt/tool schema: `tools/scraper/src/prompts/system.ts:25-84` and `tools/scraper/src/prompts/schemas.ts:55-107`.
- A fourth interpretation in the UI: `apps/web/src/components/cards/CardDetail.svelte:48-57`.

The resulting semantic audit found 183 conflicting keyword definitions, 357/639 merchant-conditioned benefits unreachable for every merchant they name, 121 reward entries outside the taxonomy-emitted shape, and 1,818 unmatchable performance-exclusion tokens.

**Failure scenario**

Changing or adding a category in one location compiles successfully but can silently change matcher precedence, make catalog benefits unreachable, render a wrong label/rate, and allow the generator to publish it.

**Recommendation**

Create a versioned domain package that owns canonical category keys, reward discriminated unions, executable conditions, and normalization of legacy data. Generate keyword-map types, JSON schema/LLM schema, UI formatting metadata, and catalog lint rules from it. No consumer should accept arbitrary category/unit strings.

---

### ARCH-02 — The transaction/rule model cannot represent benefits the catalog claims to calculate

**Severity:** High
**Confidence:** High
**Status:** Confirmed by code and catalog audit

**Evidence**

- `packages/core/src/calculator/reward.ts:42-54` executes only minimum amount and merchant conditions.
- `packages/core/src/calculator/reward.ts:168-182` approximates per-liter rewards as one fixed amount per transaction and returns zero for unknown units.
- `packages/core/src/models/transaction.ts:1-16` has no online/offline flag, fuel volume, payment method, weekday/service metadata, or occurrence basis.
- The catalog has 540 restrictions stored only as free-text notes, 34 `won_per_liter` tiers, and 90 cards with duplicate category keys.
- `packages/rules/data/cards/cu/eobuba-check.yaml:22-86` needs day-of-week and occurrence limits; `packages/rules/data/cards/samsung/id-simple.yaml:22-38` needs a maximum transaction threshold. Neither can be represented.
- Tests deliberately lock the per-liter placeholder to a 60원 per-transaction result at `packages/core/__tests__/calculator.test.ts:690-700`.

**Failure scenario**

The engine returns a precise-looking number even when required facts are absent. That is worse than an explicit unsupported result because the optimizer compares the fabricated number with accurately modeled cards.

**Recommendation**

Model reward eligibility as typed predicates over explicit transaction/context capabilities. A calculation should return `exact`, `estimated`, or `unsupported` with reasons. The optimizer should exclude or visibly penalize unsupported comparisons rather than silently substituting a placeholder. Add new facts only through parser/user enrichment with provenance.

---

### ARCH-03 — Previous-month spending loses provenance at the analyzer boundary

**Severity:** High
**Confidence:** High
**Status:** Confirmed by data-flow inspection

**Evidence**

- `apps/web/src/lib/analyzer.ts:381-419` derives a scalar from uploaded transactions.
- `apps/web/src/lib/analyzer.ts:424-428` passes that scalar through the same `previousMonthSpending` option used for a user-entered total.
- `apps/web/src/lib/analyzer.ts:228-261` interprets any scalar as authoritative for every card; only an absent scalar triggers per-card exclusions.
- `apps/web/src/lib/store.svelte.ts:585-619` independently reconstructs the same precedence during reoptimization.

**Failure scenario**

Once prior-month transactions become a number, the system cannot apply per-card exclusions or distinguish a partial/nonconsecutive statement from an explicit user assertion. Initial analysis and reoptimization already disagree on precedence.

**Recommendation**

Introduce a first-class spending-basis type, for example:

```ts
type PreviousSpendingBasis =
  | { kind: 'user-total'; amount: number }
  | { kind: 'statement'; month: YearMonth; transactions: CategorizedTransaction[] };
```

Resolve it once in a domain service that returns per-card qualifying totals. Both initial analysis and reoptimization must call that service.

---

### ARCH-04 — Browser and server maintain separate parser products

**Severity:** High
**Confidence:** High
**Status:** Confirmed by repository inventory

**Evidence**

- The browser parser tree contains 3,670 lines under `apps/web/src/lib/parser`.
- The server parser tree contains 4,295 lines under `packages/parser/src`.
- Date, amount, detection, CSV, XLSX, HTML, JSON, OFX, and PDF logic are copied rather than sharing pure parsing kernels.
- The same stale-value PDF defect exists at `packages/parser/src/pdf/index.ts:106-127,193` and `apps/web/src/lib/parser/pdf.ts:307-323,386`.
- The same fabricated-row HTML/XLSX behavior exists in four implementations.
- Even sanitization has drifted: browser HTML normalization loops nested script removal at `apps/web/src/lib/parser/html.ts:26-53`, while the server imports a different implementation from `packages/parser/src/csv/shared.ts:206-228`.

**Failure scenario**

Every parser correction requires parallel edits and parity tests. A missed copy creates environment-specific transaction totals, while a faithfully copied bug doubles the remediation surface.

**Recommendation**

Move format-neutral detection, row extraction, normalization, date/amount coercion, and transaction validation into browser-safe modules in `@cherrypicker/parser`. Keep only I/O adapters (Node file/PDF extraction versus browser File/pdf.js) at the edges. Run one conformance suite against both adapters.

---

### ARCH-05 — The optimizer is a synchronous batch recomputation service embedded in UI flow

**Severity:** High
**Confidence:** High
**Status:** Confirmed by implementation and benchmark

**Evidence**

- `packages/core/src/optimizer/greedy.ts:39-70,187-265` repeatedly calculates before/after results for all cards and replays assigned history.
- `apps/web/src/lib/analyzer.ts:276-280` invokes it synchronously after parsing.
- `apps/web/src/lib/store.svelte.ts:613-619` repeats the whole batch after edits.
- Real-catalog benchmark: 500 transactions took 1.66 seconds and 1,000 took 3.89 seconds on the development host, optimizer only.

**Failure scenario**

The data flow has no cancellation, progress, scheduler boundary, or incremental update contract. Scaling the catalog or transaction count directly increases UI freezes.

**Recommendation**

Separate optimization into a worker-hosted service with a compiled immutable catalog and incremental card state. Define request IDs/cancellation and progress events. Category edits should update only affected transaction/card state when possible.

---

### ARCH-06 — Catalog publication is structurally permissive and semantically fail-open

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed; all 683 current YAML files pass the permissive structural loader

**Evidence**

- Runtime schema and generator schema are duplicated (`packages/rules/src/schema.ts:1-71`; `scripts/build-json.ts:18-81`) and enforce different constraints.
- Generator category problems are warnings (`scripts/build-json.ts:241-265`) while only parse/schema errors fail (`scripts/build-json.ts:274-293`).
- `packages/rules/src/loader.ts:32-45` logs and skips invalid rules, allowing callers to optimize against a partial catalog.
- Structural success currently coexists with impossible rates, stripped fields, unreachable merchants, conflicting keyword overrides, and inert conditions.

**Failure scenario**

A build can publish semantically unusable benefits, or a CLI run can silently omit invalid cards and still present its result as a complete comparison.

**Recommendation**

Use one strict schema plus catalog-wide semantic validation as a required build/CI gate. Treat conflicts, unreachable rules, unsupported units/conditions, and partial loads as errors. If a degraded catalog is ever allowed, return a typed completeness report that every UI/CLI result must surface.

## Coverage and final sweep

- Inventoried all 920 tracked non-`.context` files: 152 code files, 43 test/E2E files, 686 YAML files including 683 card rules, 32 JSON/generated-data files, and all remaining configs/docs/fixtures/assets.
- Read all architectural boundaries and data flows from file ingestion through parsing, categorization, rule loading, calculation, optimization, persistence, rendering, CLI, scraper, and generation.
- Mechanically audited the entire card and keyword corpora; no sampling was used for the reported counts.
- Final missed-issues sweep covered ownership of contracts, environment duplication, provenance loss, unsupported-domain behavior, publication gates, error/degraded-state semantics, and synchronous execution boundaries.
- No source implementation, browser/E2E process, deployment, or pre-existing dirty user file was modified.
