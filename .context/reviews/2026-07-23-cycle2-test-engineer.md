# Test Engineering Review — Cycle 2

## Inventory and validation

I inventoried all 73 Bun `*.test.ts` modules, all 7 Playwright specifications (including the separately configured screenshot suite), test helpers/fixtures, package scripts, bundle/data/document gates, and deployment workflow. I read every test’s production imports and test names, then traced the uncovered paths rather than inferring coverage from green totals.

Executed checks:

- focused catalog/queue/persistence/publication/bundle tests: 42 pass, 0 fail;
- core and rules tests: 206 pass, 0 fail;
- `data:check`/`docs:check`: pass for 683 cards and 24 issuers;
- `migrations:check`: pass;
- `toolchain:check`: correctly blocked because the local Bun is 1.3.12 and the repository requires 1.2.6.

## Findings

### C2-TE-01 — Catalog tests lock in unsafe raw identity and omit normalization-shaped input

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/__tests__/cards-loader.test.ts:193-251`, `apps/web/src/lib/card-catalog-reader.ts:31-57`, `packages/rules/src/schema.ts:80-164`

The positive test explicitly requires the optimizer reader to return the original object graph. Its malformed case is only an obviously incomplete card. There is no case where canonical parsing succeeds by adding normalized fields.

A production-reader reproduction with omitted optional tier fields was accepted and produced `NaN` in the calculator.

**Required regression:** feed a tier with omitted normalized caps/unit/value or legacy `fixedAmountPerLiter`; assert either rejection by a strict publication schema or a normalized returned graph, then calculate a finite reward.

### C2-TE-02 — Queue cancellation tests do not exercise active parser cancellation or PDF cleanup

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/__tests__/file-parse-queue.test.ts:150-188,226-244`, `apps/web/src/lib/analyzer.ts:282-298`, `apps/web/src/lib/parser/pdf.ts:8-45`

The fake-worker test cancels between items and then manually resolves already active workers. The production-wiring assertion is source-string inspection. Neither test proves that the worker signal reaches a parser, that active work rejects promptly, or that a PDF loading task/document is destroyed.

**Required regression:** inject a controllable parser/PDF loading task, abort while two lanes are active, and assert prompt `AbortError`, no next dequeue, one cleanup/destroy per active document, and no stale progress/commit.

### C2-TE-03 — There is no runtime store test for analyze/reoptimize/reset overlap

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/__tests__/store-persistence.test.ts:1-235`, `apps/web/src/lib/store.svelte.ts:333-485`, `apps/web/src/components/dashboard/TransactionReview.svelte:204-217`

The only store-adjacent unit suite tests the side-effect-free persistence module. No test instantiates the runtime store with deferred category/analyzer dependencies and races reoptimization against reset or a newer analyze.

**Required regression:** restore result A, defer the first reoptimization dependency, start reset/analyze B, resolve A last, and assert B remains authoritative, A is not persisted, and loading/error belong only to B. Also cover unmount/cancel.

### C2-TE-04 — Upload contract tests omit aggregate bytes and file-count admission

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/__tests__/upload-contract.test.ts:1-47`, `apps/web/src/components/upload/FileDropzone.svelte:158-165,202-253`

The suite covers extensions and previous-spending validation only. It never tests per-file size, aggregate size, file count, or repeated additions. Consequently the warning-only 50 MB behavior has no executable product contract.

**Required regression:** move admission into a pure production helper and test exact boundary bytes, a single oversized file, aggregate overflow across multiple additions, file-count overflow, duplicates, and stable accepted/rejected order.

### C2-TE-05 — Catalog parity tests cannot detect mixed publication generations

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/__tests__/cards-loader.test.ts:193-226`, `scripts/__tests__/catalog-publication.test.ts:181-224`, `scripts/build-json.ts:402-420`

Tests compare artifacts generated in the same checkout and prove byte-stable ordering. Because optimizer/details/categories contain no common identity, no test can assert runtime generation compatibility.

**Required regression:** add a mandatory publication hash to every artifact, serve intentionally mixed hashes through loader mocks, and assert fail-closed cache invalidation/retry. Keep the current same-generation parity test.

### C2-TE-06 — Performance gates cover browser chunks, not the server parser entry or duplicate reads

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `scripts/check-web-bundles.ts:54-167,290-420`, `scripts/__tests__/check-web-bundles.test.ts:57-123`, `packages/parser/src/detect.ts:196-289`, `packages/parser/src/index.ts:55-95`

The blocking import-graph test is intentionally browser-only. No gate prevents the CLI dispatcher from statically reaching XLSX/PDF/Anthropic, and no orchestration test counts filesystem reads for a normal CSV.

**Required regression:** add a server entrypoint reachability/cold-start budget and inject or wrap file reading so a CSV parse proves one full read. Test unknown-extension sniffing separately with a bounded prefix.

## Final missed-issue sweep

I checked edge/boundary values, async ownership, cancellation, cleanup, data/artifact drift, copied implementations, fixture coverage, E2E ownership, workflow inclusion, and negative-path assertions. Cycle 1’s previously missing Playwright deployment gate, generated-data drift gate, non-finite calculator cases, scraper timeout/refetch cases, cap reporting, and screenshot separation are now covered and were not re-reported.
