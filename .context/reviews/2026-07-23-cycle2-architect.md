# Architecture Review — Cycle 2

## Coverage

I traced the current boundaries across web upload/state, browser and server parsers, core calculation/optimization, canonical rules/schema publication, generated browser artifacts, CLI, scraper, build scripts, and tests. The inventory included every tracked production/config/test/doc/data-source file; all 683 YAML cards were parsed through the current canonical loader. Cycle 1 findings were used as a regression baseline rather than re-reported.

## Findings

### C2-ARCH-01 — The browser catalog boundary validates a transformed value, then returns the untransformed graph

**Severity:** High
**Confidence:** High
**Status:** Confirmed with executable reproduction

**Locations:** `apps/web/src/lib/card-catalog-reader.ts:31-57`, `packages/rules/src/schema.ts:80-164`, `packages/core/src/calculator/reward.ts:455-500`

`cardRuleSetSchema.safeParse` normalizes omitted caps/units/fixed amounts and derives `value`. `readCardRuleArray` discards `result.data` and casts the original JSON graph to `CardRuleSet[]`. Therefore the boundary can accept migration-shaped input while returning an object that does not satisfy the inferred runtime type.

I cloned a current supported catalog card, removed `fixedAmount`, `unit`, `monthlyCap`, `perTransactionCap`, `annualCap`, and `value` from one percentage tier, and passed it through the production reader. The reader accepted and returned the same object. `calculateRewards` then produced `totalReward: NaN` because `undefined !== null` sends an undefined cap into `Math.min`.

**Failure scenario:** a stale, partially generated, or independently supplied optimizer artifact passes “canonical validation” but poisons all totals for an affected rule.

**Suggested fix:** either return `result.data`, or define a strict published-artifact schema that requires every normalized field, rejects legacy inputs, and proves parsing is identity-preserving. If avoiding a second graph is mandatory, compare/validate the raw serialized representation rather than discarding transforms.

**Cross-role clue:** the test suite currently asserts this unsafe identity behavior; see `C2-TE-01`.

### C2-ARCH-02 — Split catalog artifacts have no common generation identity

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `scripts/catalog-publication.ts:4-44,89-140`, `scripts/build-json.ts:282-300,402-420`, `apps/web/src/lib/cards.ts:35-42,87-96,285-400`

Only the summary carries metadata, and its declared `sourceHash` is optional and absent. The optimizer is a bare array; issuer details and categories have no version/hash. Independent caches never check that artifacts came from one publication.

**Failure scenario:** an open tab loads a summary, a deployment occurs, and the tab later loads a detail shard or optimizer under the same unversioned URL. The UI can combine old list metadata with new details/rules and cannot distinguish that state from a valid catalog.

**Suggested fix:** compute one deterministic publication/content hash, make it mandatory in summary, optimizer, details, and categories, and reject/reset on mismatch. Alternatively publish artifacts beneath a content-addressed version directory referenced by one manifest.

**Cross-role clue:** same-checkout parity tests cannot simulate a mixed-generation session; see `C2-TE-05`.

### C2-ARCH-03 — Analyze and reoptimize do not share one async operation-ownership model

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/src/lib/store.svelte.ts:230-264,333-389,391-485`, `apps/web/src/components/dashboard/TransactionReview.svelte:204-217`

`analyze` has a monotonic request ID and conditional commit. `reoptimize` snapshots the old result, but has no request ID, abort signal, or compare-and-commit check; its unconditional `result = {...snapshot}` and `loading = false` can outlive reset or a newer analysis. TransactionReview also does not cancel it on unmount.

This is reachable after restoring a result from session storage: the first reoptimization must fetch categories/catalog modules. During that real async gap, reset/navigation plus a new analysis can win, after which the old reoptimization resurrects its snapshot and can also clear the newer operation’s loading state.

**Suggested fix:** use one store-wide operation generation/AbortController for analyze, reoptimize, cancel, and reset. Every state mutation, persistence write, error, and final loading transition must be conditional on ownership. Snapshot consistency is not commit freshness.

**Cross-role clue:** no runtime store-overlap test covers this lifecycle; see `C2-TE-03`.

### C2-ARCH-04 — The parser package’s default entry conflates dispatch, all adapters, and optional remote infrastructure

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `packages/parser/package.json:6-22`, `packages/parser/src/index.ts:1-25`, `packages/parser/src/pdf/index.ts:1-7`, `packages/parser/src/pdf/llm-fallback.ts:1`, `tools/cli/src/parse-statement.ts:1-2`

The default package boundary is simultaneously the dispatcher, broad convenience export, every concrete adapter, and the Anthropic-backed fallback. This prevents a consumer from depending on local statement dispatch without also coupling to every optional format and remote SDK.

**Suggested fix:** establish explicit entrypoints: a lightweight statement dispatcher, browser-safe kernels, concrete format adapters, and an opt-in remote-PDF fallback. Keep types in a dependency-light entry. Add import-graph rules for each boundary.

## Final architecture sweep

I checked dependency direction, schema/type ownership, generated/runtime boundaries, state ownership, cache invalidation, parser duplication, CLI/scraper composition, and deployment artifact flow. Cycle 1’s category, support, provenance, publication, and browser lazy-load repairs are present. The known full optimizer and matcher redesigns remain deliberately deferred and are not duplicated here.
