# Cycle 1 Domain and State Contract Plan — C1-001 through C1-016

**Date:** 2026-07-23
**Scope:** Category/reward contracts and analysis state/provenance
**Findings:** C1-001 through C1-016
**Deployment:** Prohibited for this work

## Outcome

Implement one enforceable contract from taxonomy input through merchant matching, catalog publication, scraping, reward calculation, optimization, web analysis, and persisted state. A result may be exact or explicitly unsupported; it must never look exact when required transaction facts or rule semantics are missing.

All 16 assigned findings are correctness or contract work and are scheduled below. Runtime correctness is complete. Recovery of authoritative merchant scopes for the 129 rules now failed closed as `unverified_merchant_scope` is a source-data audit, explicitly tracked as D-112 rather than silently deferred.

## Implementation record — 2026-07-23

**Status:** Implemented and verified locally. No deployment, browser, commit, or push was performed by this workstream.

### Contract results

- The strict catalog contains 683 cards and 2,286 reward rules: 1,507 supported and 779 explicitly unsupported.
- The migration made 459 category changes across 389 files. It removed 363 `uncategorized` scopes: 234 source-described general-spend rules moved to wildcard scope, while 129 ambiguous positive rules moved to wildcard scope and failed closed as `unverified_merchant_scope`. It also canonicalized 67 legacy bare-leaf categories. No supported positive, merchant-unconstrained `uncategorized` rule remains.
- The exact 129-rule source-audit inventory is locked in `68-unverified-merchant-scope-inventory.json` and D-112. These rules remain in optimizer/detail disclosure artifacts but are absent from exact reward indexes and ranking.
- All 1,719 authored merchant entries were audited through the strict matcher. There are 544 mismatched entries across 270 rules, all explicitly unsupported; supported mismatches are zero.
- The restriction scanner finds 238 rules with material unmodeled prose and zero supported cases. The compact `N~N시` syntax is covered; the three newly detected time-window rules are unsupported.
- Supported all-zero reward models are zero. All 65 all-zero rules in the catalog are unsupported; the original 36 supported cases were failed closed, including all 24 benefit-text cases from the final audit.
- Forty-two cards carry annual/mileage/global-note semantics the monthly calculator cannot execute. None retains a supported reward. The migration assigned `unmodeled_global_constraints` to 101 formerly supported rules across 34 cards; the other affected cards were already entirely unsupported for narrower reasons.
- Performance exclusions have 2,082 authored occurrences: 611 category, 1 payment-type, 1,470 statement-tag, and zero unknown. Missing facts fail closed and produce `missing_performance_exclusion_fact`.
- Static merchant maps have 211 explicit conflict decisions. The taxonomy has a separate 11-conflict/11-override contract; any live conflict without an explicit valid winner is fatal. Issuer metadata now rejects duplicate IDs.
- Canonical parsed reward tiers carry a strict discriminated `value`. Serialized output is accepted only when it exactly agrees with rate/fixed/unit source fields, is re-derived on parse, and satisfies `parse(parse(x)) === parse(x)`.
- Unsupported issues from losing optimizer candidates are retained only for the transaction that produced them, then deduplicated with selected-card issues. This prevents both dropped disclosures and over-attribution.
- Calendar month selection, previous-spending provenance, per-card exclusion math, latest/full metadata, reoptimization, and version-2 persisted state share production helpers. Persistence migrations are bounded, parser warnings are identity-bearing and size-bounded, and raw statement warning content is not persisted.

### Finding evidence

| Findings | Implemented evidence |
|---|---|
| C1-001–C1-004 | Canonical registry, strict taxonomy/static conflict overrides, real matcher reachability, parent/child/wildcard precedence, canonical data migration, unsupported broad-scope inventory |
| C1-005–C1-009 | Stable rule IDs, typed predicates, explicit combination/groups/priority, strict normalized reward values, missing-fact unsupported output, fuel provenance, cap reporting, losing-candidate disclosure |
| C1-010–C1-011 | Scraper derives/validates the production percentage/category/rule contract; invalid extraction is rejected before writing |
| C1-012–C1-015 | Strict dates and year-months, exact predecessor selection, explicit basis provenance, per-card exclusions, latest/full analysis metadata preserved through reoptimization |
| C1-016 | Version-2 bounded migrations, future/invalid version rejection, validated persisted provenance/issues, bounded warning serialization |

### Verification result

- Green: domain migration check; 211-decision keyword generator check; generated catalog and README drift checks; strict production-reader parity for optimizer plus all 24 detail shards; `git diff --check`.
- Green: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, and the corrected `bun run web:build:check`. The full test gate completed all 11 Turbo tasks plus 44 script tests; the web suite alone passed 271 tests.
- Green real-data audit: zero supported all-zero values, benefit-text zero models, compact time windows, scanner-detected restrictions, ambiguous `uncategorized` scopes, noncanonical categories, merchant mismatches, or ignored global constraints.
- Environment-only failure: `bun run toolchain:check` correctly rejected host Bun 1.3.12 because the repository is pinned to Bun 1.2.6. The pin was not rewritten to hide the mismatch.
- E2E was not started by this workstream. Therefore it created no Playwright/Chromium/preview process and required no browser cleanup. The outer cycle owns any repository-wrapper E2E run and its process/port verification.

## Non-negotiable safeguards

1. Preserve the pre-existing dirty changes in:
   - `apps/web/src/lib/parser/amount.ts`
   - `apps/web/__tests__/amount.test.ts`
   - `apps/web/src/lib/store.svelte.ts`
2. Before implementation, inspect and retain the exact existing hunks with:

   ```sh
   git status --short
   git diff -- apps/web/src/lib/parser/amount.ts apps/web/__tests__/amount.test.ts apps/web/src/lib/store.svelte.ts
   ```

   Do not reset, replace wholesale, or reformat these files. In particular, retain the existing finite-number validation changes in `store.svelte.ts` and the amount-parser regressions.
3. Perform the work on a non-deploy branch. Do not push to `main`, invoke a deployment workflow, or run any deployment command.
4. Treat a failed test/gate as a recorded failure, not as a reason to stop the outer review/plan/fix cycle. Continue with independent gates and the next cycle, then report every failed command and its first actionable error.
5. Do not run raw Playwright commands while the stale-process issue is unresolved. Use the repository-owned E2E wrapper delivered by the C1-064 workstream (`bun run test:e2e:owned`). That wrapper must record only the preview/browser process group it starts, clean that group on `EXIT`, `INT`, and `TERM`, and verify TCP 4173 is free before and after. Never use broad `pkill chrome`, `killall`, or commands that can touch interactive Chrome or the unrelated Travelback session.

## Target domain contracts

### Canonical category reference

Introduce a taxonomy-derived category registry, likely in `packages/rules/src/category-contract.ts`, and export it through `packages/rules/src/index.ts`. The registry must distinguish:

- wildcard scope (`*`);
- the top-level `uncategorized` fallback;
- a canonical parent category;
- a canonical parent/subcategory pair.

It must expose parse/format/resolve operations for rule data, keyword maps, raw bank categories, exclusions, labels, and tests. Accepted external tokens are:

- a parent ID;
- a qualified `parent.child` ID;
- a bare child ID only when it resolves to exactly one parent.

An ambiguous leaf, a nonexistent ID, or an impossible parent/child pair is an error. Runtime output is always `{ category: parent, subcategory?: child }`, never a leaf masquerading as a parent.

### Executable reward rule

Replace the open-ended reward value and condition shapes in `packages/rules/src/schema.ts` and `packages/rules/src/types.ts` with strict, discriminated data:

- reward value kinds: percentage, fixed per transaction, fixed per day, mileage per spend unit, and fuel discount per liter;
- percentage values use authored percentage points (`5` means 5%) and are finite in the inclusive range 0–100;
- stable rule ID, explicit selection/stacking mode, priority, stacking group, and cap group;
- typed amount range, merchant, weekday/time, occurrence count/period, channel, geography/payment type, and user-choice predicates;
- explicit support state (`supported` or `unsupported`) with a machine-readable reason and source note when the required fact or semantic behavior is unavailable.

Unknown fields must be rejected rather than passed through. A prose note may describe context, but it cannot be the only representation of a material eligibility restriction. Catalog validation must fail when restriction-bearing prose lacks either the matching typed predicate or an explicit unsupported marker.

### Calculation certainty

Extend calculation/result types in:

- `packages/core/src/calculator/types.ts`
- `packages/core/src/models/result.ts`
- `packages/core/src/models/transaction.ts`
- `packages/core/src/optimizer/constraints.ts`
- `packages/core/src/optimizer/greedy.ts`

Each applied or skipped rule must be classifiable as `exact` or `unsupported`, with reason codes for missing facts such as fuel volume, payment geography, or channel. Unsupported rules contribute no fabricated reward to ranking and are surfaced in calculator, optimizer, web, CLI, and report output. If a later product decision introduces estimates, that must be a separate explicit `estimated` contract with assumptions and provenance; this plan does not silently estimate.

### Previous-spending provenance

Introduce a first-class basis, likely in `apps/web/src/lib/analysis-context.ts`:

```ts
type PreviousSpendingBasis =
  | { kind: 'user-total'; amount: number }
  | { kind: 'statement-month'; month: YearMonth }
  | { kind: 'missing-calendar-month'; month: YearMonth; assumedAmount: 0 };
```

`user-total` has first precedence. `statement-month` keeps the underlying transactions available so per-card performance exclusions are applied before producing the card-specific map. A missing exact calendar predecessor uses the disclosed zero assumption unless the user supplied an override; it must never substitute an older uploaded month.

Persist the provenance descriptor, not a derived aggregate that loses its source. Initial analysis and reoptimization must call the same pure context builder.

## Ordered implementation

### 0. Establish a protected baseline

**Files inspected, not rewritten:** the three dirty files listed above, all current review documents, and generated catalog JSON.

1. Save the current status/diff in the implementation log.
2. Run focused baseline tests without modifying generated files:

   ```sh
   bun test apps/web/__tests__/amount.test.ts
   bun test packages/core/__tests__/calculator.test.ts packages/core/__tests__/categorizer.test.ts
   bun test apps/web/__tests__/analyzer-adapter.test.ts apps/web/__tests__/store-persistence.test.ts
   ```

3. Record existing failures and continue. These results are a comparison baseline, not an authorization to overwrite user work.

**Acceptance:** the implementation log identifies every pre-existing dirty hunk, and the final diff still contains those changes.

### 1. Make taxonomy resolution authoritative

**Findings:** C1-001 (Critical), C1-003 (High)

**Likely files:**

- `packages/rules/data/categories.yaml`
- `packages/rules/src/category-contract.ts` (new)
- `packages/rules/src/schema.ts`
- `packages/rules/src/types.ts`
- `packages/rules/src/index.ts`
- `packages/core/src/categorizer/taxonomy.ts`
- `packages/core/src/categorizer/matcher.ts`
- `packages/core/src/categorizer/keywords.ts`
- `packages/core/src/categorizer/keywords-locations.ts`
- `packages/core/src/categorizer/keywords-english.ts`
- `packages/core/src/categorizer/keywords-niche.ts`
- `packages/core/__tests__/categorizer.test.ts`
- `packages/rules/__tests__/category-contract.test.ts` (new)

**Implementation:**

1. Build the canonical registry from `CategoryNode[]`, retaining parent/child relationships rather than returning one flattened set.
2. Replace `CategoryTaxonomy.getAllCategories()` as a raw-category validator with registry resolution. Accept qualified and unambiguous leaf input, return the canonical pair, and reject ambiguous leaves.
3. Replace the four-object spread in `matcher.ts` with a conflict-aware merge. Duplicate keywords mapping to the same canonical reference may be deduplicated; different mappings are fatal until an explicit, reviewed winner is recorded.
4. Canonicalize every static exact and substring match through the registry before returning a result. Cache only canonical results.
5. Make category fields strict at the structural boundary and perform taxonomy-aware validation when categories are available.

**Data migration:**

- Audit the 183 conflicting keyword definitions reported by the review. Resolve each to one documented canonical reference; do not preserve last-write-wins behavior.
- Convert static keyword values such as a bare `cafe` or `fuel` to qualified canonical references such as `dining.cafe` and `transportation.fuel`.
- Add an idempotent migration/check script, likely `scripts/migrations/domain-contract-v2.ts`, with reviewed decisions in `scripts/migrations/domain-contract-v2-overrides.yaml`. `--check` must report legacy/conflicting tokens without rewriting files; `--write` performs only declared transformations.

**Regression tests:**

- parent token resolves to parent only;
- `dining.cafe` and an unambiguous `cafe` resolve to `{ category: 'dining', subcategory: 'cafe' }`;
- ambiguous bare leaf and invalid pair are rejected;
- every static keyword emits a valid canonical reference;
- conflicting keyword sources fail with the keyword and both source modules in the error;
- raw bank fallback can no longer emit an impossible top-level leaf.

**Acceptance:**

- Every non-fallback `MerchantMatcher` result is reachable by the reward category contract.
- There are zero unresolved conflicting static keyword mappings.
- No raw category can produce a leaf as a top-level category.

### 2. Enforce catalog reachability and correct match precedence

**Findings:** C1-002 (High), C1-003 (High), C1-004 (High)

**Likely files:**

- `packages/rules/src/catalog-validation.ts` (new)
- `packages/rules/src/loader.ts`
- `scripts/build-json.ts`
- `scripts/check-generated-catalog.ts` (new)
- `package.json`
- `packages/rules/data/cards/**/*.yaml`
- `packages/core/src/calculator/reward.ts`
- `packages/core/__tests__/calculator.test.ts`
- `packages/core/__tests__/optimizer.test.ts`
- `packages/rules/__tests__/catalog-validation.test.ts` (new)
- `e2e/core-regressions.spec.js`

**Implementation:**

1. Remove the relaxed duplicate Zod model from `scripts/build-json.ts`; import the production rule schema and semantic validator.
2. Make unknown category IDs, impossible parent/subcategory pairs, unmatchable performance exclusions, duplicate card IDs, missing tier references, and partial catalog loads fatal. `loadAllCardRules()` must return a typed completeness error rather than warning and silently dropping invalid cards.
3. Validate each `specificMerchants` entry by passing it through the real matcher. A merchant-constrained rule must be reachable by the merchant's canonical result or explicitly unsupported.
4. Change rule candidate order in `packages/core/src/calculator/reward.ts` to:
   1. matching child rule;
   2. matching parent rule;
   3. wildcard rule.

   A transaction having a subcategory must not disqualify its parent rule. Conditions and explicit rule priority still participate within the same category specificity.
5. Keep `uncategorized` semantically distinct from `*`. It matches only transactions that actually remain uncategorized.
6. Add deterministic catalog scripts to `package.json`, for example `catalog:build` and `catalog:check`. Check mode validates YAML and verifies generated artifacts without changing the worktree.

**Data migration:**

- Migrate every reward and performance-exclusion token outside the canonical emitted shape, including top-level leaf IDs and invalid pairs.
- Audit every `uncategorized` rule. Convert the at least 208 rules whose label/source terms genuinely mean all merchants to `*`; encode domestic/overseas or channel qualifiers structurally. Do not bulk-convert rules genuinely intended only for unmatched transactions.
- Add a lint that fails when an `uncategorized` label/note claims “all merchants,” “all domestic merchants,” or equivalent general-spend coverage.
- Regenerate and check:
  - `packages/rules/data/cards.json`
  - `packages/rules/data/cards-compact.json`
  - `apps/web/public/data/cards.json`
  - `apps/web/public/data/categories.json`
  - `apps/web/src/lib/category-labels-fallback.ts`

**Regression tests:**

- a `dining.cafe` transaction falls back to a broad `dining` rule;
- a matching `dining.cafe` rule overrides the broad parent;
- when child and parent conditions miss, `*` is the final fallback;
- a real all-merchant catalog card rewards categorized dining, transit, and grocery transactions;
- `uncategorized` does not act as wildcard;
- a full-catalog reachability test covers every reward, exclusion, and merchant constraint;
- generated output contains all validated cards and check mode leaves `git diff` empty.

**Acceptance:**

- The semantic build has zero warnings/errors for category reachability.
- All 1,181 reviewed broad rules are eligible for canonically subcategorized transactions when their other predicates match.
- No general-spend rule relies on `uncategorized`.
- Invalid or partial catalogs cannot be published or optimized.

### 3. Replace ambiguous reward values with a strict value model

**Findings:** C1-006 (High), C1-007 (High)

**Likely files:**

- `packages/rules/src/schema.ts`
- `packages/rules/src/types.ts`
- `packages/core/src/calculator/reward.ts`
- `packages/core/src/calculator/types.ts`
- `packages/core/src/models/transaction.ts`
- `packages/core/src/models/result.ts`
- `packages/core/src/optimizer/greedy.ts`
- `packages/core/__tests__/calculator.test.ts`
- `packages/core/__tests__/optimizer.test.ts`
- `packages/rules/__tests__/schema.test.ts`
- `packages/rules/data/cards/**/*.yaml`
- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/analyzer.ts`

**Implementation:**

1. Replace `rate`, `fixedAmount`, and open-ended `unit` combinations with the discriminated reward value kinds described above.
2. Validate all numeric fields as finite. Percentage points must be 0–100; money/count fields must be safe, non-negative integers where appropriate; each reward kind must contain exactly its required fields.
3. Remove fallback precedence between simultaneous rate/fixed values. An ambiguous value object is a schema error.
4. For a fuel-per-liter value, calculate only when a transaction carries a finite positive `fuelVolumeLiters` fact with provenance. Without that fact, emit an unsupported result and exclude the rule from optimizer scoring.
5. Propagate unsupported reason/certainty through calculator output, optimizer alternatives/card results, the web adapter/store, CLI terminal summary, and report generator. Do not display the authored per-liter number as a calculated transaction reward.

**Data migration:**

- Correct all seven percentage rates above 100 by consulting the source meaning; do not clamp.
- Convert fixed amounts currently stored in `rate` to fixed-value variants.
- Recover the three `fixedAmountPerLiter` values that are currently stripped.
- Convert all 34 `won_per_liter` tiers across the 17 reviewed card files to the fuel-per-liter variant.
- Mark per-liter benefits unsupported for ordinary statement transactions until verified volume exists. Preserve the advertised benefit text for disclosure, not ranking.
- Reject every legacy unit string after migration; the migration check must report zero.

**Regression tests:**

- 5 percentage points on 10,000 won yields 500 won;
- percentages above 100, NaN/Infinity, mixed rate/fixed values, unknown units, and unsafe integers fail validation;
- fixed per transaction, fixed per day, and mileage per spend use their distinct formulas;
- 20 L and 50 L fuel facts produce different exact rewards and honor caps;
- absent fuel volume produces an unsupported reason and zero ranking contribution;
- the old test that asserts a flat 60 won per fuel transaction is removed.

**Acceptance:**

- No catalog tier can be interpreted under more than one value contract.
- No impossible percentage or silently stripped unit reaches generated JSON.
- Per-liter rules never produce a precise reward without volume provenance.

### 4. Execute conditions, stacking, and cap reporting

**Findings:** C1-005 (High), C1-008 (High), C1-009 (Medium)

**Likely files:**

- `packages/rules/src/schema.ts`
- `packages/rules/src/types.ts`
- `packages/rules/src/catalog-validation.ts`
- `packages/core/src/models/transaction.ts`
- `packages/core/src/models/result.ts`
- `packages/core/src/calculator/types.ts`
- `packages/core/src/calculator/reward.ts`
- `packages/core/src/optimizer/greedy.ts`
- `packages/core/__tests__/calculator.test.ts`
- `packages/core/__tests__/optimizer.test.ts`
- `packages/core/__tests__/reward-cap-rollback.test.ts`
- `packages/rules/__tests__/catalog-validation.test.ts`
- `packages/rules/data/cards/**/*.yaml`
- `apps/web/src/lib/parser/types.ts`
- parser adapters that actually expose payment/channel facts
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`
- `apps/web/src/components/report/ReportContent.svelte`
- `packages/viz/src/terminal/summary.ts`
- `packages/viz/src/report/generator.ts`

**Implementation:**

1. Give each reward a stable ID and evaluate typed predicates over transaction facts plus explicit calculation context.
2. Implement inclusive/exclusive amount boundaries, weekday/time ranges from valid transaction dates, per-day/per-month occurrence counters, payment channel/type, and user-choice eligibility.
3. Implement explicit rule combination:
   - `exclusive`: select the highest-specificity/priority matching rule in its group;
   - `additive`: apply every eligible rule in the group;
   - shared caps use `capGroup`; independent caps use distinct groups.

   Source order must never determine business behavior.
4. Add optional typed transaction facts such as `paymentType`, `channel`, and `fuelVolumeLiters`, each with provenance. Parser adapters may populate only facts present in a statement; absent facts remain absent.
5. Treat a rule requiring a missing fact as unsupported for that transaction. Surface the reason rather than treating the predicate as true.
6. Emit `capsHit: { capType: 'per_transaction', ... }` whenever the uncapped rate-based or fixed reward exceeds `perTransactionCap`. Record the uncapped amount as `actualReward`, the per-transaction-clipped amount as `appliedReward`, and set the category bucket's cap flag before later monthly/global cap stages.

**Data migration:**

- Migrate all 91 duplicate category groups to stable IDs and explicit exclusive/additive/group/priority semantics.
- Encode known amount bands, weekday/time, occurrence, merchant, channel, payment type, tier, and stacking restrictions from source terms.
- Convert all 10 current `conditions.paymentType: overseas` rules to the typed payment/geography predicate.
- Audit the 540 restriction-bearing notes. Every material restriction must become executable or the rule must be explicitly unsupported with a reason. No affected rule may remain silently unconditional.
- Fail the catalog when two supported rules have indistinguishable executable predicates and no explicit combination semantics.

**Regression tests:**

- Samsung iD SIMPLE amount bands select 0.7% below the boundary and 1.0% at/above the correct boundary;
- CU weekday and N/N+1 use-count limits select the correct rule;
- base plus bonus rules add only when explicitly additive;
- equal-priority overlapping exclusive rules fail validation;
- overseas-only reward applies when typed payment metadata is overseas, does not apply to domestic metadata, and is unsupported when metadata is absent;
- per-transaction caps report `capsHit` for both rate and fixed rewards, while monthly/global cap rollback behavior remains correct;
- catalog table tests cover every migrated duplicate/condition family.

**Acceptance:**

- No material eligibility rule is enforced only by prose.
- Duplicate rules have deterministic, authored combination semantics.
- Missing payment/channel/count facts cannot create a false reward.
- Every per-transaction clip is visible in `capsHit`.

### 5. Bind the scraper to the same contract

**Findings:** C1-010 (High), C1-011 (High)

**Likely files:**

- `tools/scraper/src/prompts/system.ts`
- `tools/scraper/src/prompts/schemas.ts`
- `tools/scraper/src/extractor.ts`
- `tools/scraper/src/validators.ts`
- `tools/scraper/src/writer.ts`
- `tools/scraper/__tests__/validators.test.ts` (new)
- `tools/scraper/__tests__/schema-contract.test.ts` (new)
- `tools/scraper/__tests__/extractor-calculator.test.ts` (new)
- `packages/rules/src/category-contract.ts`
- `packages/rules/src/schema.ts`
- `packages/rules/data/categories.yaml`

**Implementation:**

1. Generate the scraper's category descriptions/enums and parent/subcategory fields from the canonical category registry. Remove the hard-coded stale list.
2. Generate or compose the extraction schema from the production reward schema. Do not maintain a permissive third contract.
3. Use percentage points end to end: the prompt and tool schema must say `5% -> 5`, with an allowed range of 0–100. Remove the fraction instruction and `maximum: 1`.
4. Reject unknown condition fields. Remove `excludeOnline`; if source text requires online/offline behavior, encode the typed channel predicate or explicit unsupported status.
5. Validate extracted output structurally and semantically before `writer.ts` receives it. Reject invalid categories, pairs, value kinds, tier references, overlapping rules, and unsupported passthrough keys.
6. Keep tests offline by injecting a captured tool response or testing the extraction-validation boundary directly; do not call the live model.

**Data migration:**

- Existing scraper-authored YAML goes through the same domain-contract migration and catalog check as manual data.
- No generated file is written when validation reports an unsupported unknown field or taxonomy token.

**Regression tests:**

- captured 5% extraction produces a stored percentage value of 5 and a real calculator result of 500 won on 10,000 won;
- top-level `fuel` is rejected or canonicalized only with its valid parent;
- stale `transport`, `shopping`, `department`, `overseas`, `leisure`, and `auto` tokens cannot pass unless present as canonical taxonomy entries;
- `excludeOnline` and arbitrary condition keys fail;
- a typed unsupported condition remains disclosed and cannot affect ranking;
- scraper output can pass the same catalog build without special casing.

**Acceptance:**

- Scraper, hand-authored YAML, generated JSON, and calculator all use one percentage/category/condition contract.
- No 100× rate conversion error is possible at the scraper-calculator boundary.
- Invalid scraper output cannot enter the publication path.

### 6. Centralize calendar validation and previous-spending provenance

**Findings:** C1-012 (High), C1-013 (High), C1-015 (High)

**Likely files:**

- `apps/web/src/lib/analysis-context.ts` (new)
- `apps/web/src/lib/tx-validation.ts`
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/parser/types.ts`
- `apps/web/__tests__/analysis-context.test.ts` (new)
- `apps/web/__tests__/analyzer-adapter.test.ts`
- `apps/web/__tests__/tx-validation.test.ts`
- `apps/web/src/components/dashboard/SpendingSummary.svelte`
- `apps/web/src/components/report/ReportContent.svelte`

**Implementation:**

1. Add a strict calendar-valid `YYYY-MM-DD` predicate: regex shape plus a component round trip that rejects impossible days/months and rollover normalization.
2. Add strict `YearMonth` helpers and `previousCalendarMonth()` with January/December rollover.
3. Partition parsed transactions at the analysis boundary:
   - valid-date rows may participate in month selection, optimization, spending, counts, and periods;
   - invalid-date rows remain available for review and their parser errors remain visible, but they do not participate in those calculations.
4. Make `getLatestMonth()`, initial analysis, reoptimization, monthly breakdown, and period derivation call the same production helpers. Remove all length-only date slicing.
5. Convert `AnalyzeOptions.previousMonthSpending` to `PreviousSpendingBasis` immediately. User input has first precedence for both single- and multi-month uploads.
6. In automatic mode, compute only the exact previous calendar month. Keep those transactions as the basis and calculate a separate performance amount for each card after canonical performance exclusions.
7. When the exact month is missing, use `{ kind: 'missing-calendar-month', assumedAmount: 0 }` and show that assumption in dashboard/report output. Never use the preceding uploaded month.
8. Store the basis/provenance on `AnalysisResult` and reuse it in `reoptimize()`. Remove the ambiguous derived scalar path and the independently reconstructed precedence logic.

**Regression tests:**

- explicit 300,000 won override wins with one or several uploaded months and remains identical after category edits;
- automatic previous-month transactions produce different per-card totals when exclusions differ;
- January + March upload does not use January for March eligibility and exposes a missing-February zero assumption;
- December is the exact predecessor of January across a year boundary;
- `2026-99-99`, `2026-02-30`, long garbage, and valid-looking rollover dates cannot become the latest month or a period endpoint;
- invalid rows retain their parse error for user review;
- initial analysis and reoptimization use the same basis kind and card-specific values.

**Acceptance:**

- The source of previous spending is inspectable in result/persisted state.
- Automatic transaction-derived performance always applies per-card exclusions.
- Upload gaps never substitute an older month.
- Calendar-invalid rows cannot influence an optimization or persisted period.

### 7. Preserve latest/full metadata and bound storage migrations

**Findings:** C1-014 (Medium), C1-016 (High)

**Likely files:**

- `apps/web/src/lib/analysis-context.ts`
- `apps/web/src/lib/analysis-persistence.ts` (new)
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/__tests__/analysis-context.test.ts`
- `apps/web/__tests__/store-persistence.test.ts`
- `e2e/fixtures/regression-multimonth.csv` (new)
- `e2e/web-regressions.spec.js`

**Implementation:**

1. Return a shared analysis context containing:
   - `latestTransactions`, `statementPeriod`, and `transactionCount`;
   - `allTransactions`, `fullStatementPeriod`, and `totalTransactionCount`;
   - monthly breakdown and previous-spending basis.
2. Use that object in both `analyzeMultipleFiles()` and `reoptimize()`. Reoptimization derives primary metadata from `latestTransactions` and full metadata from all valid edited transactions.
3. Move version parsing/migration into a small pure production helper so tests import real logic instead of another mirror. Integrate it into `loadFromStorage()` with minimal hunks to preserve the existing dirty store changes.
4. Before any loop, require `_v` to be undefined or a finite safe integer in the inclusive range `0..STORAGE_VERSION`. Reject negative, fractional, string, and future versions; remove the invalid payload and surface the existing corruption warning.
5. Apply at most `STORAGE_VERSION` migrations, require every step to exist, set `_v` after each step, and require the final version to equal `STORAGE_VERSION` before payload validation.
6. Increment the storage version for the new provenance/result shape and add an explicit v1-to-v2 migration. Legacy v0 must take a bounded, tested path.
7. Validate and persist the new provenance and unsupported-reason fields. Preserve validated parse errors needed to explain excluded invalid-date rows.

**Regression tests:**

- two-month analysis, category edit, and reoptimization retain latest-month primary count/period and all-month full count/period;
- a real browser/store flow verifies the persisted metadata after reoptimization;
- `_v = -1_000_000_000`, `-1`, `1.5`, `"1"`, and a future version are rejected without running migrations;
- v0 and v1 payloads run each declared migration exactly once;
- a missing migration step fails closed;
- current-version data round-trips;
- existing finite-number, truncation, corruption, and amount-parser tests remain green.

**Acceptance:**

- Reoptimization cannot collapse the two metadata scopes.
- Migration work is bounded by a small compile-time version count, independent of attacker-controlled values.
- Invalid/future persisted versions are removed safely.
- The original dirty `store.svelte.ts` validation changes remain present.

### 8. Run the full contract migration and close the loop

**Findings:** all C1-001 through C1-016

1. Run the migration in check mode, review every manual override, then run write mode once.
2. Run strict catalog validation before generation.
3. Regenerate all catalog artifacts.
4. Re-run check mode and require no YAML changes, no semantic warnings, and no generated drift.
5. Run focused tests, workspace gates, build, and finally the owned E2E wrapper.
6. If any command fails, capture the command, exit code, and first actionable error; continue with independent commands and the outer cycle. Do not deploy.

## Verification commands

Run from `/Users/hletrd/flash-shared/cherrypicker`.

### Focused domain tests

```sh
bun test packages/rules/__tests__/schema.test.ts packages/rules/__tests__/category-contract.test.ts packages/rules/__tests__/catalog-validation.test.ts
bun test packages/core/__tests__/categorizer.test.ts packages/core/__tests__/calculator.test.ts packages/core/__tests__/optimizer.test.ts packages/core/__tests__/reward-cap-rollback.test.ts
bun test tools/scraper/__tests__/validators.test.ts tools/scraper/__tests__/schema-contract.test.ts tools/scraper/__tests__/extractor-calculator.test.ts
```

### Focused state tests

```sh
bun test apps/web/__tests__/amount.test.ts
bun test apps/web/__tests__/analysis-context.test.ts apps/web/__tests__/analyzer-adapter.test.ts apps/web/__tests__/tx-validation.test.ts apps/web/__tests__/store-persistence.test.ts
```

### Migration and generated-artifact checks

```sh
bun scripts/migrations/domain-contract-v2.ts --check
bun run catalog:check
git diff --check
git status --short
```

`catalog:check` must be non-mutating. If generation is intentionally rerun during implementation, follow it with another `catalog:check` and inspect only the expected generated files.

### Workspace gates

Run every gate even if an earlier independent gate fails:

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

### Browser/E2E gate

Run only after the C1-064 owned-process wrapper is available:

```sh
bun run test:e2e:owned
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

The second command must print no listener. The wrapper must also report that its recorded Playwright/Chromium/preview PIDs exited. If the wrapper is unavailable or cleanup verification fails, record the E2E gate as blocked/failed and continue the outer cycle; do not substitute a broad Chrome kill.

### Protected-diff confirmation

```sh
git diff -- apps/web/src/lib/parser/amount.ts apps/web/__tests__/amount.test.ts apps/web/src/lib/store.svelte.ts
git diff --check
```

Confirm the pre-existing amount-parser tests and finite-number store guards remain alongside the planned store changes.

## Definition of done

- All 16 assigned findings satisfy their acceptance criteria.
- All 683 card YAML files pass the one strict structural and semantic contract.
- No category/reward/catalog warning is allowed during publication.
- Unsupported benefits are disclosed and excluded from exact optimization; none are silently treated as unconditional or fabricated.
- Initial analysis, reoptimization, and persisted state share the same calendar and previous-spending provenance logic.
- Generated artifacts are current and reproducible.
- Focused tests, lint, typecheck, workspace tests, build, and owned E2E are green, or any remaining failure is explicitly recorded while the outer cycle continues.
- Port 4173 and repository-owned Playwright/Chromium/preview processes are clean after E2E.
- No deployment occurred.

## Finding coverage

| Finding | Severity | Scheduled steps | Primary regression/acceptance proof |
|---|---|---:|---|
| C1-001 | Critical | 1, 2 | Canonical resolver and conflict-aware keyword merge; every matcher output has a valid parent/child shape |
| C1-002 | High | 2 | Child transaction falls back to parent, child overrides parent, wildcard is last |
| C1-003 | High | 1, 2, 8 | Full-catalog reachability/exclusion validation is fatal and generated catalog is complete |
| C1-004 | High | 2, 8 | Audited general-spend rules use `*`; lint rejects general-spend prose on `uncategorized` |
| C1-005 | High | 4, 8 | Typed conditions, stable IDs, explicit stacking/priority/cap groups, N/N+1 and overlap tests |
| C1-006 | High | 3, 8 | Discriminated reward values reject impossible percentages, mixed meanings, and unknown units |
| C1-007 | High | 3, 8 | Per-liter reward requires volume provenance or is explicitly unsupported and unranked |
| C1-008 | High | 4, 5 | Typed overseas payment predicate has domestic/overseas/missing-fact tests; scraper cannot pass inert fields |
| C1-009 | Medium | 4 | Rate and fixed per-transaction clips emit `capsHit` records with correct actual/applied values |
| C1-010 | High | 5 | Offline scraper-to-validator-to-calculator fixture proves 5% of 10,000 is 500 |
| C1-011 | High | 5, 8 | Scraper schema derives from taxonomy/rule contract and rejects stale categories/conditions |
| C1-012 | High | 6, 7 | User override precedence and transaction-derived per-card exclusion totals remain identical after reoptimization |
| C1-013 | High | 6 | January/March gap and December/January rollover use the exact calendar predecessor |
| C1-014 | Medium | 7 | Store/browser reoptimization keeps latest and full period/count metadata separate |
| C1-015 | High | 6, 7 | Strict calendar predicate excludes invalid dates from month, optimization, period, and persisted metadata while retaining errors |
| C1-016 | High | 7 | Arbitrary negative/fractional/future storage versions fail before a bounded migration path |
