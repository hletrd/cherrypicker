# Architectural Review — cherrypicker

**Date:** 2026-04-22
**Reviewer:** architect agent
**Scope:** Coupling, layering, circular deps, missing abstractions, separation of concerns, scalability

---

## Summary

The monorepo has a clean dependency graph at the package level (rules -> core -> viz/cli, parser -> cli, no cycles). However, the web app (`apps/web/`) has cloned the entire parser infrastructure and re-declared types from `@cherrypicker/core` and `@cherrypicker/rules`, creating a second parallel codebase that must be maintained in lockstep. Three categories of data (bank signatures, date utilities, category names) exist as exact duplicates across the server and web sides. Within the shared packages, `CATEGORY_NAMES_KO` in core is a hardcoded copy of data that already lives in the rules YAML, and the categorizer runs two overlapping matching systems without de-duplication. These are the highest-impact findings because they guarantee drift bugs on every future change.

---

## Findings

### F-01: Web app duplicates the entire parser package

**Files:**
- `apps/web/src/lib/parser/csv.ts` (1031 lines)
- `apps/web/src/lib/parser/detect.ts` (192 lines)
- `apps/web/src/lib/parser/date-utils.ts` (151 lines)
- `apps/web/src/lib/parser/types.ts` (42 lines)
- `packages/parser/src/csv/index.ts` (92 lines)
- `packages/parser/src/detect.ts` (211 lines)
- `packages/parser/src/date-utils.ts` (125 lines)
- `packages/parser/src/types.ts` (42 lines)

**Why it is a problem:**
The web app reimplements CSV parsing, bank detection, date utilities, and all 10 bank adapters from scratch instead of importing `@cherrypicker/parser`. The types (`BankId`, `RawTransaction`, `ParseResult`, `BankAdapter`) are character-for-character identical. The bank signature lists in `detect.ts` are identical. The `splitCSVLine`, `parseAmount`/`parseCSVAmount`, and `parseInstallments` functions are near-identical. The web-side `csv.ts` itself acknowledges this at line 29-34:

> "NOTE(C70-04): The helpers below (splitLine, parseAmount, parseInstallments, isValidAmount) duplicate logic from packages/parser/src/csv/shared.ts. Full dedup requires the D-01 architectural refactor."

The root cause is that `@cherrypicker/parser` uses Node.js APIs (`fs/promises.readFile`, `path.extname`) and Bun-specific APIs that don't run in the browser. Rather than splitting the parser into a browser-compatible core and a Node-specific I/O layer, the entire thing was cloned.

**Architectural impact:** Any bank adapter fix (new header keyword, changed column name, new bank) must be applied in two places. The 10 bank adapters in the web CSV parser are already slightly diverged (e.g., web uses 30-line scan limit, server uses 10-line in some adapters). As banks change their export formats, these will silently desynchronize. Adding a new bank requires editing 6+ files across two packages.

**Suggested fix:** Extract a `@cherrypicker/parser-core` package that contains the bank-agnostic parsing logic (types, `splitCSVLine`, `parseCSVAmount`, `parseDateStringToISO`, `detectCSVDelimiter`, bank signatures, adapter definitions). Both `@cherrypicker/parser` (Node I/O) and `apps/web/src/lib/parser/` (browser File API) would import from this core. The I/O boundary (reading file content from disk vs. File object) stays in the respective entry points.

**Confidence:** High

---

### F-02: Web app re-declares types from @cherrypicker/core and @cherrypicker/rules

**Files:**
- `apps/web/src/lib/store.svelte.ts:10-65` — re-declares `CategoryReward`, `CapInfo`, `CardRewardResult`, `CardAssignment`, `OptimizationResult`
- `apps/web/src/lib/cards.ts:6-145` — re-declares `CardRuleSet`, `PerformanceTier`, `RewardTier`, `RewardEntry`, `CategoryNode`
- `packages/core/src/models/result.ts` — canonical definitions
- `packages/rules/src/types.ts` — canonical definitions

**Why it is a problem:**
The web app cannot import types from `@cherrypicker/core` or `@cherrypicker/rules` at runtime because those packages use Node.js APIs (`fs/promises` in rules/loader.ts). Instead of using `import type` (which is erased at compile time and has no runtime cost), the web app re-declares every interface. This forces `apps/web/src/lib/analyzer.ts:16-71` to maintain type adapter functions (`toRulesCategoryNodes`, `toCoreCardRuleSets`) that bridge the duplicate types with runtime validation.

**Architectural impact:** Every schema change in `@cherrypicker/rules` or `@cherrypicker/core` must be manually mirrored in the web app's type declarations. If a field is added or renamed in one place but not the other, the adapter functions silently coerce or drop data. The `toCoreCardRuleSets` adapter at `analyzer.ts:50-71` already contains fallback logic for narrowing `string` to `RewardType` — if the web type drifts from the rules type, the narrowing becomes incorrect.

**Suggested fix:** Use `import type` from `@cherrypicker/core` and `@cherrypicker/rules` in the web app. Type-only imports are erased at compile time and have zero runtime cost. The web app already lists `@cherrypicker/core` as a dependency in its `package.json`. The only blocker is `@cherrypicker/rules` — its `loader.ts` uses `fs/promises`, but the web app only needs the types, not the loader. Either (a) add `@cherrypicker/rules` as a web dependency and use `import type`, or (b) move the type definitions to a separate `@cherrypicker/rules-types` package that has no Node.js dependencies.

**Confidence:** High

---

### F-03: CATEGORY_NAMES_KO is a hardcoded duplicate of YAML taxonomy data

**Files:**
- `packages/core/src/optimizer/greedy.ts:11-86` — hardcoded `CATEGORY_NAMES_KO` map
- `packages/rules/data/categories.yaml` — canonical source of truth
- `packages/viz/src/terminal/summary.ts:39` — reads from `CATEGORY_NAMES_KO` as fallback
- `packages/viz/src/report/generator.ts:77` — reads from `CATEGORY_NAMES_KO` as fallback

**Why it is a problem:**
The code itself documents the risk at `greedy.ts:7-10`:

> "TODO(C64-03): CATEGORY_NAMES_KO can silently drift from the YAML taxonomy in packages/rules/data/categories.yaml. When the taxonomy is updated, this map must be updated in lockstep."

This is not a theoretical risk. The `CATEGORY_NAMES_KO` map at line 11-86 contains entries like `online_shopping`, `offline_shopping`, `restaurant`, `fast_food`, `delivery`, `convenience_store` at the top level, but the actual YAML taxonomy nests these as subcategories under parent categories (e.g., `cafe` is under `dining`). If someone adds a new category to `categories.yaml` without updating the map, the optimizer and all viz consumers will display raw English keys instead of Korean labels. The map is also exported from `packages/core/src/index.ts:27`, making it part of the public API.

**Architectural impact:** Every category addition, rename, or removal in the YAML requires a corresponding code change in `greedy.ts`. Since `@cherrypicker/core` depends on `@cherrypicker/rules`, the category data is already available at runtime — the hardcoded map is entirely unnecessary. The `categoryLabels` Map parameter already exists on `OptimizationConstraints` and flows through to `buildAssignments` and `buildCardResults`, but `CATEGORY_NAMES_KO` is used as a fallback whenever the Map is missing.

**Suggested fix:** Remove `CATEGORY_NAMES_KO` from core. Require the `categoryLabels` Map on `OptimizationConstraints` (make it non-optional). The CLI entry point already builds this Map from `loadCategories()` at `tools/cli/src/commands/analyze.ts:78-87`. The web entry point already builds it via `buildCategoryLabelMap()`. The only code path that relied on the fallback was the `buildConstraints()` call in `tools/cli/src/commands/optimize.ts:117` which omits the third argument — fix that call site.

**Confidence:** High

---

### F-04: formatWon/formatRate duplicated 4 times across viz and web

**Files:**
- `packages/viz/src/terminal/comparison.ts:4-14` — local `formatWon`, `formatRate`
- `packages/viz/src/terminal/summary.ts:6-16` — local `formatWon`, `formatRate`
- `packages/viz/src/report/generator.ts:10-20` — local `formatWon`, `formatRate`
- `apps/web/src/lib/formatters.ts:5-19` — `formatWon`, `formatRate` (slightly different: 1 decimal vs 2)

**Why it is a problem:**
Three files in `packages/viz` each define their own `formatWon` and `formatRate` as private functions. The web app defines them again in `formatters.ts`. The viz terminal implementations use 2 decimal places for rates; the web uses 1 decimal place. This is not just duplication — it is inconsistent behavior for the same conceptual operation across presentation layers.

**Architectural impact:** Low severity in isolation, but it violates the DRY principle for formatting logic that should be uniform across the application. If a formatting rule changes (e.g., how negative amounts are displayed, how zero values render), it must be changed in 4 places.

**Suggested fix:** Extract `formatWon` and `formatRate` into a shared utility within `packages/viz/src/format.ts`, then import from all three viz consumers. The web app can either import from a shared formatting package or keep its own display-specific variants with explicit naming (`formatRateShort` vs `formatRatePrecise`).

**Confidence:** High

---

### F-05: Dual categorization systems (static keywords vs. taxonomy keywords) with no de-duplication

**Files:**
- `packages/core/src/categorizer/keywords.ts` — 394KB static keyword map (too large to read fully)
- `packages/core/src/categorizer/matcher.ts:8-13` — merges 4 keyword sources into `ALL_KEYWORDS`
- `packages/core/src/categorizer/taxonomy.ts:25-56` — builds keyword map from `CategoryNode[]` loaded from YAML
- `packages/rules/data/categories.yaml` — taxonomy with `keywords` fields

**Why it is a problem:**
The categorizer has two independent keyword sources: (1) the static `MERCHANT_KEYWORDS` Record (394KB, 10K+ entries) hardcoded in `keywords.ts`, and (2) the YAML-based taxonomy keywords loaded at runtime from `categories.yaml`. The `MerchantMatcher.match()` method at `matcher.ts:37-103` tries the static keywords first (exact match at confidence 1.0, substring at 0.8), then falls back to taxonomy keywords (exact 1.0, substring 0.8, fuzzy 0.6). If the same keyword exists in both sources with different category mappings, the static keyword always wins because it is checked first. There is no validation that the two sources agree, and no mechanism to detect conflicts.

**Architectural impact:** The static keyword file is 394KB of untyped data that cannot be validated against the taxonomy at build time. If a merchant keyword maps to a category that no longer exists in the YAML taxonomy, the matcher will produce a category ID that matches no reward rules, silently yielding zero rewards. The taxonomy keywords are loaded at runtime and could be updated independently of the static keywords, making conflicts inevitable over time.

**Suggested fix:** This is a longer-term refactor. The static keyword file should be migrated into the YAML taxonomy (each keyword becomes a `keywords` entry on the appropriate `CategoryNode`). Once complete, the `MerchantMatcher` would only need the taxonomy-based `CategoryTaxonomy.findCategory()`. The static keywords could be retained as a fallback during migration but should be validated against the taxonomy at build time. A build-time script that checks for keyword conflicts (same keyword in static map and taxonomy with different categories) would prevent silent drift.

**Confidence:** Medium — the 394KB keyword file may contain entries not derivable from the taxonomy alone, making full migration non-trivial.

---

### F-06: ILP optimizer is a stub that silently degrades to greedy

**Files:**
- `packages/core/src/optimizer/ilp.ts:43-50` — `ilpOptimize` calls `greedyOptimize`
- `packages/core/src/optimizer/index.ts:23-36` — `optimize()` dispatches to `ilpOptimize` when `method: 'ilp'`
- `packages/core/src/index.ts:25` — exports `ilpOptimize` as a public API

**Why it is a problem:**
`ilpOptimize` is exported as a first-class public API and `optimize()` accepts `method: 'ilp'` as an option, but the implementation is entirely a stub that delegates to `greedyOptimize` with a `console.debug` message. Any caller who specifies `method: 'ilp'` believing they get optimal results is silently getting greedy results instead. The function signature and return type make no distinction between optimal and heuristic results.

**Architectural impact:** The stub creates a false contract. The `OptimizeMethod` type at `optimizer/index.ts:12` suggests two real strategies exist. The `OptimizeOptions` interface at line 14 allows `method: 'ilp'`. If this is never intended to be implemented, the dead code adds confusion. If it is intended, the silent fallback masks a significant accuracy gap.

**Suggested fix:** Either (a) implement the ILP solver (the formulation is documented at `ilp.ts:8-30`) by integrating `glpk.js`, or (b) remove the `ilp` option from the public API and keep the formulation as a design document in comments only. If keeping it as a future goal, change the type to `OptimizeMethod = 'greedy'` and add `// Future: 'ilp'` so the type system does not advertise unimplemented behavior.

**Confidence:** High

---

### F-07: console.warn/console.debug in library code

**Files:**
- `packages/core/src/calculator/reward.ts:196-199` — `console.warn` for no performance tier matched
- `packages/core/src/calculator/reward.ts:265-269` — `console.warn` for rate+fixedAmount conflict
- `packages/core/src/calculator/reward.ts:286-288` — `console.warn` for rule with no rate or fixedAmount
- `packages/core/src/optimizer/ilp.ts:48` — `console.debug` for ILP fallback
- `apps/web/src/lib/parser/date-utils.ts:140` — `console.warn` for unparseable date

**Why it is a problem:**
`@cherrypicker/core` is a pure logic library. It should not produce side effects like writing to stdout/stderr. In the web app, these `console.warn` calls produce browser console noise on every optimization run. In test environments, they clutter test output. The reward calculator's warn at line 196 fires every time a card has performance tiers but the user's spending is below the minimum — which is expected for cards with high minimum thresholds, not a warning condition.

**Architectural impact:** Libraries that produce console output cannot be used in environments where stdout is monitored or parsed (e.g., log aggregation, CI). The warnings also cannot be suppressed or redirected by the caller.

**Suggested fix:** Return diagnostics in the output structure. Add a `warnings: string[]` field to `CalculationOutput`. Let the presentation layer (CLI, web) decide whether and how to display them. Alternatively, accept an optional `logger` callback in the input options.

**Confidence:** Medium — this is a design philosophy choice; some teams accept console output in libraries.

---

### F-08: BankId is a closed union type duplicated in two packages

**Files:**
- `packages/parser/src/types.ts:2` — `BankId = 'hyundai' | 'kb' | ... | 'epost'` (24 members)
- `apps/web/src/lib/parser/types.ts:2` — identical `BankId` union

**Why it is a problem:**
`BankId` is a closed string union that must be updated whenever a new bank is added. It exists in two files that must stay in sync. The bank detection signatures in `detect.ts` (both server and web) enumerate the same banks. Adding a new bank requires editing: (1) the `BankId` type in both files, (2) the `BANK_SIGNATURES` array in both files, (3) optionally a new adapter in both CSV parser modules. There are 6+ touch points for a single bank addition.

**Architectural impact:** The closed union makes the system resistant to extension. Banks not in the list cannot be detected even if their statement format is identical to an existing bank. The duplication across server and web guarantees that one side will be updated while the other is forgotten.

**Suggested fix:** With the parser-core extraction from F-01, `BankId` would live in one place. Beyond that, consider making `BankId` an open `string` type with the bank signatures as the authoritative registry. The type safety from the union is minimal — `detectBank` already returns `BankId | null`, so callers must handle the unknown case regardless.

**Confidence:** Medium — the closed union provides some compile-time safety, which would be lost.

---

### F-09: Category label lookup fallback chain repeated 4 times

**Files:**
- `packages/core/src/optimizer/greedy.ts:176` — `categoryLabels?.get(categoryKey) ?? categoryLabels?.get(assignment.tx.category) ?? CATEGORY_NAMES_KO[categoryKey] ?? CATEGORY_NAMES_KO[assignment.tx.category] ?? categoryKey`
- `packages/core/src/optimizer/greedy.ts:245` — same pattern
- `packages/viz/src/terminal/summary.ts:39` — same pattern
- `packages/viz/src/report/generator.ts:77` — same pattern

**Why it is a problem:**
The 4-deep fallback chain for resolving Korean category labels (specific key -> parent key -> static map -> raw key) is copy-pasted across 4 locations. If the resolution order changes (e.g., removing `CATEGORY_NAMES_KO` as per F-03), all 4 locations must be updated. The pattern is also non-trivial enough that a typo in one copy would be hard to spot.

**Architectural impact:** Low severity on its own, but it is a symptom of the missing `CATEGORY_NAMES_KO` abstraction (F-03). If the label resolution logic were centralized, this duplication would not exist.

**Suggested fix:** Extract a `resolveCategoryLabel(categoryKey: string, categoryLabels?: Map<string, string>): string` function in core that encapsulates the fallback chain. All consumers call this function instead of inlining the fallback. This also makes it trivial to change the resolution strategy in one place.

**Confidence:** High

---

### F-10: Issuer name map is hardcoded in web formatters, duplicating YAML data

**Files:**
- `apps/web/src/lib/formatters.ts:51-78` — `formatIssuerNameKo()` with hardcoded `names` Record
- `packages/rules/data/issuers.yaml` — canonical issuer data with `nameKo` fields
- `packages/rules/src/loader.ts:58-66` — `loadIssuers()` reads from YAML

**Why it is a problem:**
The web app has a hardcoded map of 24 issuer names in `formatIssuerNameKo()`. The same data exists in `packages/rules/data/issuers.yaml` and is loadable via `loadIssuers()`. If a new issuer is added to the YAML, the web formatter will show the raw issuer ID instead of the Korean name until someone remembers to update `formatters.ts`.

**Architectural impact:** This is the same class of problem as F-03 (CATEGORY_NAMES_KO). The web app has access to the issuer data via `loadCardsData()` (which returns issuer metadata), but the formatter function doesn't use it because the formatter is synchronous and the data is async.

**Suggested fix:** Build an issuer-name lookup Map at the same point where `buildCategoryLabelMap()` is built (in the web store/analyzer initialization), then pass it to components that need it. Alternatively, make `formatIssuerNameKo` accept a pre-built lookup Map.

**Confidence:** Medium — the async/sync mismatch makes this slightly harder than F-03.

---

### F-11: Greedy optimizer has O(T * C * T) time complexity

**Files:**
- `packages/core/src/optimizer/greedy.ts:120-152` — `scoreCardsForTransaction()`
- `packages/core/src/optimizer/greedy.ts:268-353` — `greedyOptimize()` main loop

**Why it is a problem:**
For each transaction, `scoreCardsForTransaction()` evaluates every card by computing `calculateCardOutput()` twice (before and after adding the transaction). `calculateCardOutput` calls `calculateRewards()`, which iterates all transactions assigned to that card. So for T transactions and C cards, the total work is O(T * C * T) in the worst case. With 500 transactions and 80 cards, that's 500 * 80 * 500 = 20 million reward calculations, each involving rule lookup, cap tracking, and tier resolution.

The code already has an optimization at line 136-139 (push/pop instead of array spread) and the `SUBSTRING_SAFE_ENTRIES` pre-computation in the matcher, but these are constant-factor improvements on a quadratic algorithm.

**Architectural impact:** Currently the greedy optimizer is fast enough for typical usage (a single user's monthly transactions). However, if the web app scales to batch processing (multiple users, annual statements with 10K+ transactions), or if the card count grows significantly, the quadratic behavior will become a bottleneck. The ILP solver (F-06), if implemented, would have a different complexity profile but would not help here since greedy is the default.

**Suggested fix:** This is inherent to the greedy approach (marginal reward per transaction depends on all previously assigned transactions). Short-term: document the complexity and add a transaction count guard that warns or switches to a faster heuristic above a threshold. Long-term: pre-compute per-card per-category reward rates (which are independent of assignment order for the initial scoring) and use those as an approximation, falling back to the exact marginal calculation only for the top-k candidates per transaction.

**Confidence:** Medium — the current scale (monthly statements) may not hit this, but it's worth documenting.

---

### F-12: viz package depends on core for data that should come from rules

**Files:**
- `packages/viz/src/terminal/summary.ts:4` — `import { CATEGORY_NAMES_KO } from '@cherrypicker/core'`
- `packages/viz/src/report/generator.ts:5` — `import { CATEGORY_NAMES_KO } from '@cherrypicker/core'`

**Why it is a problem:**
The `@cherrypicker/viz` package imports `CATEGORY_NAMES_KO` from `@cherrypicker/core`. But category labels are taxonomy data that belongs to the rules layer, not the optimization engine. The viz package already depends on `@cherrypicker/rules` (visible in its `package.json`). The import from core creates an unnecessary transitive dependency on the optimizer's internal data.

**Architectural impact:** This is a layering violation — the presentation layer (viz) reaches into the business logic layer (core) for data that should come from the data layer (rules). If `CATEGORY_NAMES_KO` is removed from core (per F-03), the viz package's imports will break.

**Suggested fix:** Resolve together with F-03. Once `CATEGORY_NAMES_KO` is removed from core, the viz package should receive category labels through its function parameters (it already accepts `categoryLabels?: Map<string, string>` on both `printSpendingSummary` and `generateHTMLReport`). The callers in the CLI already build this Map from the YAML taxonomy.

**Confidence:** High

---

## Dependency Graph (current)

```
@cherrypicker/rules  (Zod schemas, YAML loader, types)
  ^
  |
@cherrypicker/core  (categorizer, calculator, optimizer)
  ^            ^
  |            |
@cherrypicker/viz   @cherrypicker/parser
  ^                    ^
  |                    |
@cherrypicker/cli  (merges all)

apps/web  (depends on @cherrypicker/core, @cherrypicker/viz)
          (clones @cherrypicker/parser entirely)
          (re-declares types from @cherrypicker/core and @cherrypicker/rules)
```

No circular dependencies exist. The coupling issues are all in the horizontal plane (duplicated data across packages at the same layer) rather than the vertical plane (incorrect dependency direction).

---

## Prioritized Recommendations

| # | Finding | Effort | Impact | Action |
|---|---------|--------|--------|--------|
| 1 | F-01: Parser duplication | High | Critical | Extract `@cherrypicker/parser-core` with browser-compatible code |
| 2 | F-02: Type re-declarations | Low | High | Use `import type` from core/rules packages |
| 3 | F-03: CATEGORY_NAMES_KO drift | Medium | High | Remove hardcoded map; require categoryLabels on constraints |
| 4 | F-05: Dual categorization | High | Medium | Long-term: migrate static keywords to YAML taxonomy |
| 5 | F-06: ILP stub | Low | Medium | Either implement or remove from public API |
| 6 | F-04: formatWon/formatRate | Low | Low | Extract shared formatting utilities |
| 7 | F-07: console.warn in libs | Medium | Medium | Return diagnostics in output structures |
| 8 | F-08: BankId closed union | Low | Medium | Open the type; dedup with parser-core extraction |
| 9 | F-09: Label lookup fallback | Low | Medium | Extract `resolveCategoryLabel()` utility |
| 10 | F-10: Issuer name map | Medium | Low | Build lookup from async data at init time |
| 11 | F-11: Greedy O(T*C*T) | Medium | Low | Document complexity; add count guard |
| 12 | F-12: viz depends on core for labels | Low | Low | Resolve with F-03 |

---

## References

- `apps/web/src/lib/parser/csv.ts:29-34` — acknowledges parser duplication (C70-01/D-01)
- `apps/web/src/lib/analyzer.ts:16-71` — type adapter functions bridging web and core types
- `packages/core/src/optimizer/greedy.ts:7-10` — TODO about CATEGORY_NAMES_KO drift risk
- `packages/core/src/optimizer/greedy.ts:11-86` — hardcoded CATEGORY_NAMES_KO map
- `packages/core/src/optimizer/ilp.ts:43-50` — ILP stub that delegates to greedy
- `packages/core/src/calculator/reward.ts:196-199,265-269,286-288` — console.warn in library
- `packages/core/src/categorizer/keywords.ts` — 394KB static keyword map
- `packages/core/src/categorizer/matcher.ts:8-13` — dual keyword source merge
- `packages/parser/src/types.ts:2` — BankId closed union
- `apps/web/src/lib/parser/types.ts:2` — identical BankId union
- `packages/parser/src/detect.ts:10-107` — BANK_SIGNATURES (server)
- `apps/web/src/lib/parser/detect.ts:8-105` — identical BANK_SIGNATURES (web)
- `packages/viz/src/terminal/summary.ts:4` — viz imports CATEGORY_NAMES_KO from core
- `apps/web/src/lib/formatters.ts:51-78` — hardcoded issuer name map
- `apps/web/src/lib/store.svelte.ts:10-65` — re-declared core types
- `apps/web/src/lib/cards.ts:6-145` — re-declared rules types
