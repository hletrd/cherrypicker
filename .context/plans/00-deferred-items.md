# Deferred Items — 2026-04-19 (Cycle 3)

Every finding from the reviews must be either (a) scheduled for implementation in a plan, or (b) explicitly recorded here as a deferred item. No finding may be silently dropped.

---

## Deferred Findings (Cycle 1)

### D-01: Duplicate parser implementations (web vs packages)
- **Original finding:** 00-summary #3, deep-code-quality P1-01
- **Severity:** HIGH (architectural)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Reason for deferral:** Major architectural refactor requiring extraction of shared parser logic into a platform-agnostic module. The web parser runs in the browser (no Bun/Node APIs) while the packages parser runs on Bun.
- **Exit criterion:** Create a dedicated refactor cycle with a design doc first, then implement incrementally with dual-path testing.

### D-02: README says MIT, LICENSE is Apache 2.0
- **Original finding:** 00-summary #7
- **Severity:** MEDIUM (legal metadata)
- **Confidence:** High
- **File+line:** `README.md:169-171` vs `LICENSE:1-15`
- **Reason for deferral:** Legal metadata fix requires confirming the intended license with the project owner.
- **Exit criterion:** Confirm intended license with project owner, then update README or LICENSE accordingly.

### D-03: `cards-compact.json` stale relative to `cards.json`
- **Original finding:** 00-summary #7
- **Severity:** MEDIUM (build artifact drift)
- **Confidence:** High
- **File+line:** `packages/rules/data/cards-compact.json`
- **Reason for deferral:** Build pipeline issue. Fixing requires understanding whether `cards-compact.json` is still needed.
- **Exit criterion:** Determine if `cards-compact.json` is consumed anywhere; if so, add it to the build pipeline; if not, delete it.

### D-04: No workspace-level `lint` script
- **Original finding:** 00-summary #6
- **Severity:** MEDIUM (tooling gap)
- **Confidence:** High
- **File+line:** Root `package.json:9-19`
- **Reason for deferral:** Adding a meaningful lint configuration across all workspaces is a non-trivial setup task.
- **Exit criterion:** Add ESLint or Biome to the monorepo with appropriate rules.

### D-05: No CI quality gate
- **Original finding:** 00-summary #6
- **Severity:** HIGH (release discipline)
- **Confidence:** High
- **File+line:** `.github/workflows/deploy.yml:17-40`
- **Reason for deferral:** CI configuration changes affect the deployment pipeline. Depends on D-04 for lint.
- **Exit criterion:** Add test, lint, and typecheck steps to the deploy workflow after all quality checks pass locally.

### D-06: Browser CSV support overstated (24 banks advertised, 10 have dedicated adapters)
- **Original finding:** 00-summary #11
- **Severity:** MEDIUM (documentation accuracy)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/detect.ts`
- **Reason for deferral:** The generic CSV parser handles most bank formats reasonably well. Adding dedicated adapters requires real statement samples for testing.
- **Exit criterion:** Either add dedicated adapters for remaining banks, or update documentation to clarify support levels.

### D-07: Fetch caching race condition in `loadCardsData`
- **Original finding:** M-04 (cycle 1)
- **Severity:** MEDIUM
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/cards.ts:144-157`
- **Reason for deferral:** The race condition is theoretical and would only manifest under very specific network failure timing.
- **Exit criterion:** If users report stale/failed data loading issues, replace with a proper caching library.

### D-08: `cu` bank ID is ambiguous
- **Original finding:** L-02 (cycle 1)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/parser/src/detect.ts:95-96`, `apps/web/src/lib/parser/detect.ts:95-96`
- **Reason for deferral:** Renaming the bank ID would be a breaking change. The current code works correctly.
- **Exit criterion:** If the bank ID is ever exposed in user-facing URLs or APIs, rename with a migration path.

### D-09: `scoreCardsForTransaction` is O(n*m) per transaction (performance)
- **Original finding:** Final sweep (cycle 1), C2-P01, C3-P01
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Reason for deferral:** For typical use cases (< 1000 transactions, < 10 cards), this is fast enough. Optimization would require incremental reward tracking.
- **Exit criterion:** If performance becomes an issue for large statement sets, implement incremental scoring.

### D-10: Browser AI categorizer is disabled but still imported
- **Original finding:** Final sweep (cycle 1)
- **Severity:** LOW (dead code)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`
- **Reason for deferral:** The import adds minimal bundle weight. Removing it would require also removing AI-related UI code. Cleaner to leave as feature flag.
- **Exit criterion:** When the self-hosted AI runtime is implemented, either re-enable or remove.

### D-11 through D-25: (unchanged from cycle 2 — see prior deferred items file for D-11 through D-25)

---

## Deferred Findings (Cycle 3)

### D-26: LLM fallback JSON regex can match nested arrays incorrectly

- **Original finding:** C3-05 (code-reviewer)
- **Severity:** LOW (edge case)
- **Confidence:** Medium
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:75`
- **Reason for deferral:** The LLM rarely produces nested JSON arrays in transaction output. The current regex handles the common case (flat array of objects). Fixing this requires a more complex JSON extraction approach (bracket matching or streaming parser).
- **Exit criterion:** If LLM responses with nested arrays become common, implement a bracket-matching JSON extractor.

### D-27: Transaction IDs use array index — duplicates across multi-file uploads

- **Original finding:** C3-06 (code-reviewer)
- **Severity:** LOW (data quality)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/analyzer.ts:98`
- **Reason for deferral:** The `changeCategory` function in `TransactionReview.svelte` uses `tx.id` to find transactions, but the current upload flow doesn't allow uploading a second file while the first is being edited. The duplicate ID issue only manifests if the user uploads multiple files in a single batch AND the per-file transaction indices happen to collide AND the user edits categories. The `editedTxs` array is a flat merge from all files, so IDs are actually unique within the merged array (each file's `tx-${idx}` is unique because idx is relative to the merged array). The only risk is if `analyzeMultipleFiles` creates separate `parseAndCategorize` calls that each start from `tx-0`, but the current implementation merges all transactions into a single array before assigning IDs.
- **Exit criterion:** If multi-file upload with category editing causes ID collisions, use `crypto.randomUUID()` or a file-scoped prefix.

### D-28: `parseInt` for previousMonthSpending without NaN validation

- **Original finding:** C3-08 (code-reviewer)
- **Severity:** LOW (input validation)
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:176-177`
- **Reason for deferral:** The HTML `<input type="number">` already prevents non-numeric input in most browsers. The `parseInt` call only receives strings from this input element, so NaN is extremely unlikely. The worst case (NaN → no tier matches → 0 rewards) is recoverable by re-entering a valid number.
- **Exit criterion:** If users report 0-reward results after entering spending amounts, add `Number.isFinite` validation.

### D-29: Marginal reward is 0 when cap hit — misleading assignment

- **Original finding:** C3-D02 (debugger)
- **Severity:** MEDIUM (UX clarity)
- **Confidence:** Medium
- **File+line:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Reason for deferral:** This is correct behavior from a reward perspective — the card really does give 0 additional reward. The "misleading" aspect is that the user might not understand why a category is assigned to a card with 0% rate. Adding an annotation ("cap reached") would require changing the `CardAssignment` type and updating the UI, which is a feature enhancement rather than a bug fix.
- **Exit criterion:** If users report confusion about 0% rate assignments, add a `capReached` annotation to `CardAssignment`.

### D-30: `reoptimize` can set result to stale state after navigation

- **Original finding:** C3-D06 (debugger)
- **Severity:** MEDIUM (state consistency)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:229-243`
- **Reason for deferral:** This requires a version tracking mechanism across the store and the edited transactions. It's a real concern but the scenario (user navigates away, comes back, and applies stale edits) is uncommon. The simpler fix (Task 1 in Plan 07 — reset editedTxs on new result) would also prevent this scenario.
- **Exit criterion:** After Plan 07 Task 1 is implemented, verify if the stale reoptimize scenario is still possible. If so, add version tracking.

### D-31: sessionStorage parse errors silently swallowed

- **Original finding:** C3-S03 (security-reviewer)
- **Severity:** LOW (debugging)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:119-120`
- **Reason for deferral:** The catch block already removes the corrupted data from sessionStorage, which is the correct recovery behavior. Adding a console.warn would help developers debug but isn't critical for users.
- **Exit criterion:** If storage corruption is reported, add console.warn logging.

### D-32: No Subresource Integrity on external script

- **Original finding:** C3-S04 (security-reviewer)
- **Severity:** LOW (supply chain)
- **Confidence:** Medium
- **File+line:** `apps/web/src/layouts/Layout.astro:53`
- **Reason for deferral:** SRI requires computing hash at build time and adding it to the script tag. The `is:inline` attribute already ensures the script is embedded (not loaded from an external URL), so the supply chain risk is limited. If the hosting server is compromised, SRI wouldn't help since the script is served from the same origin.
- **Exit criterion:** If the script is ever loaded from a CDN or external origin, add SRI.

### D-33: `loadCategories` fetches data already in `cards.json`

- **Original finding:** C3-P04 (perf-reviewer), C3-A02 (architect)
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:159-173`
- **Reason for deferral:** The extra fetch is a single HTTP request that is cached by the browser. The `categories.json` file is small (~5KB). The data consistency risk is theoretical — both files are generated in the same build.
- **Exit criterion:** If the extra fetch causes noticeable latency on slow connections, extract categories from `cards.json`.

### D-34: Mixing parsing, categorization, and optimization in analyzer.ts

- **Original finding:** C3-A03 (architect)
- **Severity:** LOW (architectural)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/analyzer.ts`
- **Reason for deferral:** The current coupling works and the file is not excessively long (~270 lines). Splitting into separate services would add complexity without immediate benefit.
- **Exit criterion:** If the analyzer becomes hard to test or maintain, split into ParseService, CategorizationService, and OptimizationService.

### D-35: `inferYear` and `parseDateToISO` duplicated across parser files

- **Original finding:** C3-A04 (architect)
- **Severity:** LOW (DRY)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Reason for deferral:** The functions are small (~10 lines each) and the duplication is across two files in the same module. Extracting them would require a shared import that adds a dependency.
- **Exit criterion:** If more parser files are added that need these functions, extract to `date-utils.ts`.

### D-36: No unit tests for web-side XLSX parser

- **Original finding:** C3-T03 (test-engineer)
- **Severity:** MEDIUM (test gap)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts`
- **Reason for deferral:** The XLSX parser is well-covered by the E2E tests (upload flow). Adding unit tests requires mock XLSX data, which is time-consuming to create. The parser is relatively stable and rarely modified.
- **Exit criterion:** If the XLSX parser has regressions, add unit tests with mock data.

### D-37: E2E tests use `waitForTimeout` instead of condition-based waits

- **Original finding:** C3-T04 (test-engineer)
- **Severity:** MEDIUM (test reliability)
- **Confidence:** High
- **File+line:** `e2e/ui-ux-review.spec.js:374,381,393`
- **Reason for deferral:** The E2E tests currently pass reliably. Replacing `waitForTimeout` with condition-based waits requires identifying the right DOM conditions to wait for, which varies by page. This is a quality improvement, not a bug fix.
- **Exit criterion:** If E2E tests become flaky in CI, replace `waitForTimeout` with `waitForSelector`.

### D-38: Dashboard shows both empty state and data content divs

- **Original finding:** C3-U04 (designer)
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `apps/web/src/pages/dashboard.astro:31-119`
- **Reason for deferral:** The Svelte components handle empty state internally. The extra DOM nodes add minimal overhead. Using `client:visible` would require Astro configuration changes.
- **Exit criterion:** If the dashboard page has noticeable load time issues, switch to `client:visible`.

### D-39: No loading skeleton for card list page

- **Original finding:** C3-U05 (designer)
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/pages/cards/index.astro`, `apps/web/src/components/cards/CardGrid.svelte`
- **Reason for deferral:** The cards.json fetch typically completes in < 500ms. Adding a loading skeleton is a nice-to-have, not a critical UX issue.
- **Exit criterion:** If the cards page has noticeable blank time on slow connections, add a loading skeleton.
