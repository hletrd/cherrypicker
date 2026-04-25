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

### D-28: `parseInt` for previousMonthSpending without NaN validation — PROMOTED

- **Original finding:** C3-08 (code-reviewer), re-evaluated as C4-12
- **Severity:** LOW (input validation)
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:200`
- **Status:** PROMOTED to Plan 09 Task 1 (C4-12). `parseInt("1e5", 10)` returns 1 on iOS Safari; fix is trivial.

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

---

## Deferred Findings (Cycle 4)

### D-40: Annual savings projection (monthly * 12) is misleading

- **Original finding:** C4-06 (designer)
- **Severity:** LOW (UX clarity)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:172-173`
- **Reason for deferral:** The projection is labeled with "약" (approximately), making it clear it's an estimate. Changing the label or removing the projection entirely is a UX design decision, not a bug. Multiplying by 12 is the simplest and most commonly-understood annualization approach.
- **Exit criterion:** If users report confusion about annual savings numbers, change the label to "월 기준 연간 추정" or remove the annual projection.

### D-41: localStorage vs sessionStorage inconsistency for dismissed warning

- **Original finding:** C4-07 (designer)
- **Severity:** LOW (state consistency)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:10-12,107`
- **Reason for deferral:** The warning dismissal is intentionally persisted across sessions to avoid annoying repeat users. The data-loss warning is most important for first-time users, and returning users likely understand the data lifecycle. Moving to sessionStorage would cause the warning to reappear every new tab, which is unnecessarily intrusive.
- **Exit criterion:** If users report data loss after dismissing the warning, move the dismissed state to sessionStorage or tie it to the analysis lifecycle.

### D-42: CategoryBreakdown hardcoded CATEGORY_COLORS not sourced from taxonomy

- **Original finding:** C4-09 (code-quality)
- **Severity:** LOW (data freshness)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Reason for deferral:** Same class as C3-03 (hardcoded CATEGORY_NAMES_KO). New categories fall through to `uncategorized` color which is visually distinct (gray). The hardcoded map covers all current categories. Adding a dynamic color generator requires design work to ensure colors are distinguishable and accessible.
- **Exit criterion:** When new categories are added to the taxonomy, update the color map. If categories are frequently added, implement a hash-based color function.

### D-43: Small-percentage bars nearly invisible in CategoryBreakdown

- **Original finding:** C4-13 (designer)
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:114`
- **Reason for deferral:** The current "other" grouping (< 2% threshold) already mitigates this for very small categories. Categories at exactly 2-3% have thin but visible bars. Adding a minimum bar width would distort the visual proportions. A logarithmic scale would add complexity and reduce readability.
- **Exit criterion:** If users report difficulty seeing category bars, add a minimum width of 4px or increase the "other" threshold to 5%.

### D-44: Stale fallback values in Layout footer when cards.json read fails

- **Original finding:** C4-14 (code-quality)
- **Severity:** LOW (data accuracy)
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro:15-24`
- **Reason for deferral:** The fallback values (683, 24, 45) are only shown if `cards.json` can't be read at build time, which means the build is broken anyway. Making the build fail would add friction to the development workflow. The values will be correct on the next successful build.
- **Exit criterion:** If stale numbers are seen in production, remove fallback values and show "—" instead, or make the build fail on missing cards.json.

---

## Deferred Findings (Cycle 5)

### D-45: FileDropzone success navigation uses full page reload

- **Original finding:** C5-04
- **Severity:** LOW (perf/UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:205-207`
- **Reason for deferral:** The full page reload works correctly and sessionStorage restores data. Switching to Astro's `navigate()` requires testing that the Svelte island hydration works correctly with client-side navigation. The performance gain is marginal (1-2 seconds saved on a typical analysis flow that takes 3+ seconds).
- **Exit criterion:** If client-side navigation is needed for other features (e.g., instant page transitions), replace `window.location.href` with Astro's `navigate()`.

### D-46: CategoryBreakdown hardcoded colors missing `traditional_market`

- **Original finding:** C5-05 (extends C4-09/D-42)
- **Severity:** LOW (data freshness)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Reason for deferral:** Same class as D-42. The `traditional_market` category falls through to `uncategorized` gray, making it indistinguishable from truly uncategorized items. The fix is either adding the missing entry or implementing a dynamic color generator (per D-42 exit criterion).
- **Exit criterion:** When D-42 is resolved (dynamic color generation), this will be automatically fixed.

### D-47: FileDropzone duplicate file detection by name only

- **Original finding:** C5-06
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:129`
- **Reason for deferral:** Comparing only filenames is a simplification that works for most use cases. Two different CSV files with the same name from different banks is an edge case. Adding file size comparison (`existing.size === f.size`) could cause false negatives when the same file is re-uploaded (same name, same size). A confirmation dialog would be a better UX but adds complexity.
- **Exit criterion:** If users report issues with duplicate file handling, add a size+name comparison with a confirmation dialog for same-name different-size files.

### D-48: SessionStorage quota exceeded — no user feedback

- **Original finding:** C5-07 (partially addressed by C6-02/Plan 10 Task 3)
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:96-113`
- **Reason for deferral:** C6-02 adds a `persistWarning` indicator for when transactions are truncated. The full quota exceeded scenario (where even the truncated payload fails) is already handled by the catch block, which silently removes corrupted data. The `persistWarning` flag from C6-02 will cover this case too.
- **Exit criterion:** After C6-02 is implemented, verify that `persistWarning` is set in the catch block as well. If not, add it.

### D-49: `inferYear` uses `new Date()` — non-deterministic in tests

- **Original finding:** C5-08
- **Severity:** LOW (testability)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/csv.ts:30-36`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Reason for deferral:** The `new Date()` call makes short-date parsing non-deterministic in tests. Adding an optional `now` parameter would fix this, but it requires changing the function signature and all callers. The current tests pass because they use full-date formats.
- **Exit criterion:** If tests become flaky due to date-dependent parsing, add an optional `now` parameter with a default of `Date.now()`.

---

## Deferred Findings (Cycle 6)

### D-50: `findRule` wildcard exemption from subcategory blocking is undocumented

- **Original finding:** C6-04
- **Severity:** LOW (documentation)
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:81`
- **Reason for deferral:** The behavior is correct for Korean card terms — wildcard rules should match all transactions including subcategorized ones. The existing TODO comment at line 79-80 already mentions the `includeSubcategories` schema extension. Adding a comment at line 81 about the wildcard exemption would help future developers but is not urgent.
- **Exit criterion:** When the `includeSubcategories` schema field is added, update the comment to reference it.

### D-51: `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction

- **Original finding:** C6-05 (extends D-09)
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Reason for deferral:** Same class as D-09. For typical use cases (< 1000 transactions, < 10 cards), this is fast enough. Caching the previous `calculateCardOutput` result per card would halve the calls but adds complexity due to cache invalidation.
- **Exit criterion:** If performance becomes an issue for large statement sets, implement incremental reward tracking with per-card caching.

### D-52: XLSX HTML detection decodes buffer twice for HTML-as-XLS files

- **Original finding:** C6-06
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:272-273, 290-291`
- **Reason for deferral:** The double decode only affects HTML-as-XLS files (a small minority of uploads). For binary XLSX files, only the 512-byte check is done. The performance impact is negligible for files under 10MB.
- **Exit criterion:** If HTML-as-XLS parsing becomes a performance bottleneck, cache the decoded HTML string from `isHTMLContent` and reuse it.

### D-53: `cardBreakdown` derivation source should be documented

- **Original finding:** C6-08
- **Severity:** LOW (documentation)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:24-46`
- **Reason for deferral:** The current implementation is correct — `cardBreakdown` derives from `assignments` which only includes categories with spending. A comment would help future maintainers but is not urgent.
- **Exit criterion:** When C6-01 is implemented (removing the redundant `rate` field), add a comment clarifying the derivation source.

### D-54: `loadCategories` fetch deduplication gap

- **Original finding:** C6-09 (same as D-07)
- **Severity:** LOW (reliability)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:159-173`
- **Reason for deferral:** Same as D-07. JavaScript's single-threaded execution makes concurrent duplicate fetches extremely unlikely. The `categoriesPromise` cache already handles the common case.
- **Exit criterion:** If users report stale/failed data loading issues, replace with a proper caching library.

### D-55: `inferYear` duplicated across csv.ts and xlsx.ts — divergence risk

- **Original finding:** C6-10 (extends D-35)
- **Severity:** LOW (DRY)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts:29-37`, `apps/web/src/lib/parser/xlsx.ts:183-190`
- **Reason for deferral:** Same as D-35. The functions are identical but could diverge over time. Extracting them requires a shared import that adds a dependency. The duplication is across two files in the same module.
- **Exit criterion:** If more parser files are added that need these functions, extract to `date-utils.ts`.

---

## Deferred Findings (Cycle 7)

### D-56: `_persistWarning` module-level mutable variable creates fragile coupling

- **Original finding:** C7-05
- **Severity:** LOW (code quality)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:102`
- **Reason for deferral:** The current pattern works correctly — `persistToStorage` is always called before `persistWarning = _persistWarning` is read. The fragile coupling would only become a problem if the code is significantly refactored. The fix (returning a boolean from `persistToStorage`) is a minor improvement but not urgent.
- **Exit criterion:** If `persistToStorage` is ever called asynchronously or from a different code path, refactor to return the warning status instead of using a shared mutable.

### D-57: `BANK_SIGNATURES` duplicated between packages/parser and apps/web

- **Original finding:** C7-07 (extends D-01)
- **Severity:** LOW (DRY)
- **Confidence:** High
- **File+line:** `packages/parser/src/detect.ts:10-107`, `apps/web/src/lib/parser/detect.ts:8-105`
- **Reason for deferral:** Same class as D-01 (duplicate parser implementations). Extracting bank signatures requires the broader architectural refactor of unifying web and packages parser code.
- **Exit criterion:** When D-01 is resolved (shared parser module), bank signatures will be unified as part of that refactor.

### D-58: `formatDateKo`/`formatDateShort` use `parseInt` without NaN guard

- **Original finding:** C7-09
- **Severity:** LOW (robustness)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:151,162`
- **Reason for deferral:** The `parseInt` calls are on date components that have already been validated by the `split('-')` parsing. A malformed date like "2026-ab-15" would fail the `parts.length !== 3` check at line 149 and return '-' before reaching `parseInt`. The NaN scenario is extremely unlikely in practice.
- **Exit criterion:** If date formatting produces "NaN" output, add explicit NaN guards.

### D-59: CategoryBreakdown percentage rounding can cause total > 100%

- **Original finding:** C7-10
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:78,94-95`
- **Reason for deferral:** This is a common rounding artifact. The difference is typically 0.1-0.2% and most users won't notice. Fixing it requires a rounding adjustment algorithm that adds complexity for minimal benefit.
- **Exit criterion:** If users report confusion about percentages not summing to 100%, implement a rounding adjustment.

### D-60: `CardDetail.svelte` uses full page reload for navigation

- **Original finding:** C7-12 (extends D-45)
- **Severity:** LOW (perf/UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/cards/CardDetail.svelte:252`
- **Reason for deferral:** Same class as D-45. Switching to Astro's `navigate()` requires testing that Svelte island hydration works correctly with client-side navigation. The performance gain is marginal for a secondary navigation action.
- **Exit criterion:** When client-side navigation is needed for other features (per D-45 exit criterion), update both CardDetail and FileDropzone together.

### D-61: `toCoreCardRuleSets` cache never hits due to reference equality on always-new array

- **Original finding:** C7-13
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/analyzer.ts:191-194`
- **Reason for deferral:** The `toCoreCardRuleSets` transformation is O(n) where n is the number of cards (~683). This takes < 1ms on modern hardware. The cache was intended to avoid re-computation but the reference check makes it ineffective. The fix is simple (content-based check or higher-level cache) but not urgent.
- **Exit criterion:** If card count grows significantly (> 2000) or `optimizeFromTransactions` is called in tight loops, implement a proper cache.

---

## Deferred Findings (Cycle 8)

### D-62: `CardDetail.svelte` fetch has no cleanup on component destroy

- **Original finding:** C8-04
- **Severity:** LOW (robustness)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/cards/CardDetail.svelte:57-72`
- **Reason for deferral:** The stale-response guard (`fetchGeneration` counter) correctly prevents out-of-order responses from corrupting state. The lack of cleanup on component destroy means a pending fetch may complete after destruction, but this only sets local state that is discarded — no memory leak. Adding an AbortController would be a nice improvement but is not urgent.
- **Exit criterion:** If `CardDetail` fetches cause noticeable performance issues (e.g., large data downloads continuing after navigation), add AbortController cleanup.

### D-63: `savingsPct` divides by zero (NaN path) when `bestSingleCard.totalReward` is 0

- **Original finding:** C8-05
- **Severity:** LOW (robustness)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:71-75`
- **Reason for deferral:** The `Number.isFinite(raw)` check at line 74 correctly handles the NaN result from `0 / 0`, clamping `savingsPct` to 0. The behavior is correct; the NaN computation is misleading for debugging but has no visible impact.
- **Exit criterion:** If `savingsPct` computation needs to handle the zero-reward case more explicitly, add a guard before the division.

### D-64: CategoryBreakdown CATEGORY_COLORS missing many categories from taxonomy

- **Original finding:** C8-06 (extends D-42/D-46)
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:7-49`
- **Reason for deferral:** Same class as D-42/D-46. Missing categories fall through to `uncategorized` gray. The hardcoded map covers all current top-level categories but not all subcategories from the core taxonomy. The long-term fix is a dynamic color generator.
- **Exit criterion:** When D-42 is resolved (dynamic color generation), this will be automatically fixed.

### D-65: `detectBank` confidence score misleading with single-pattern banks

- **Original finding:** C8-07
- **Severity:** LOW (logic)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/detect.ts:114-137`
- **Reason for deferral:** The current confidence scoring (ratio of matched patterns) works correctly for the common case. Single-pattern banks getting 1.0 confidence is misleading but doesn't cause wrong bank detection in practice because the pattern matching is specific enough. Changing the scoring algorithm could break existing behavior.
- **Exit criterion:** If users report incorrect bank detection due to confidence scoring, implement absolute-score weighting or a minimum pattern threshold.

### D-66: CardGrid issuer filter shows issuers with 0 cards after type filter

- **Original finding:** C8-08
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/cards/CardGrid.svelte:22`
- **Reason for deferral:** Showing all issuers even when they have no cards in the current filter set is a minor UX issue. The user sees "검색 결과가 없어요" when they click an issuer with no matching cards, which is clear feedback. Deriving `availableIssuers` from the filtered list would improve this but is not urgent.
- **Exit criterion:** If users report confusion about empty issuer filter results, derive `availableIssuers` from the type-filtered card list.

### D-67: PDF `parseAmount` uses `parseInt` which truncates instead of rounding

- **Original finding:** C8-10
- **Severity:** LOW (robustness)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/pdf.ts:177-180`
- **Reason for deferral:** Korean Won amounts are always integers. The `parseInt` truncation is effectively the same as rounding for integer values. Foreign-currency-converted amounts with decimal remainders are extremely rare in Korean credit card statements. The same pattern is used in csv.ts and xlsx.ts.
- **Exit criterion:** If foreign-currency-converted amounts with decimal remainders appear in PDF statements, switch to `Math.round(parseFloat(...))`.

### D-68: AI categorizer import is dead code

- **Original finding:** C8-12 (extends D-10)
- **Severity:** LOW (dead-code)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`
- **Reason for deferral:** Same as D-10. The import adds minimal bundle weight. Removing it would require also removing AI-related UI code. Cleaner to leave as feature flag until the self-hosted AI runtime is implemented.
- **Exit criterion:** When the self-hosted AI runtime is implemented, either re-enable or remove.

### D-69: `buildConstraints` shallow-copies transactions — latent mutation risk

- **Original finding:** C8-13
- **Severity:** LOW (latent-risk)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/constraints.ts:17`
- **Reason for deferral:** The optimizer does not currently mutate transaction objects. The shallow copy protects against array-level mutations (push, splice) but not against object-level mutations. Deep-copying would add a performance cost for large transaction sets. Adding a documentation comment is a sufficient safeguard for now.
- **Exit criterion:** If the optimizer or calculator is refactored to mutate transaction objects, deep-copy transactions in `buildConstraints` or add a runtime freeze.

---

## Deferred Findings (Cycle 9)

### D-70: `savingsPct` is 0 when optimization is identical — redundant comparison UI

- **Original finding:** C9-02
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:71-75,176-180`
- **Reason for deferral:** When cherry-picking gives the same reward as the best single card, the comparison section shows redundant data. The "+0원" value is correct but the bar comparison is visually unhelpful. Adding a special "동일" message is a UX enhancement, not a bug fix.
- **Exit criterion:** If users find the identical-reward comparison confusing, replace the comparison section with a "카드 한 장과 동일해요" message.

### D-71: PDF fallback date regex is complex and hard to maintain

- **Original finding:** C9-04
- **Severity:** LOW (maintainability)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/pdf.ts:312-331`
- **Reason for deferral:** The mega-regex works correctly but is difficult to read and extend. Refactoring to use separate pattern tests (like `findDateCell`) would improve maintainability but is a refactor with no functional change.
- **Exit criterion:** If the fallback date pattern needs to support additional formats, refactor to use separate pattern tests.

### D-72: CategoryBreakdown percentage rounding can shift the "other" threshold by 0.05%

- **Original finding:** C9-06 (extends D-59/C7-10)
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:78-79`
- **Reason for deferral:** Same class as D-59/C7-10 (percentage rounding). The threshold-shifting is a visual artifact — categories at 1.95% are included while 1.94% goes to "other". The difference is imperceptible to users.
- **Exit criterion:** When D-59 is resolved (rounding adjustment), verify the threshold comparison uses the un-rounded value.

### D-73: `Math.max(...array)` stack overflow risk for very large arrays in OptimalCardMap

- **Original finding:** C9-07
- **Severity:** LOW (edge-case)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:18-19`
- **Reason for deferral:** `Math.max(...array)` can cause a stack overflow for arrays > ~100K entries. Typical usage has < 50 assignments, so this is not a realistic concern.
- **Exit criterion:** If assignments ever exceed 10,000 entries, replace with `array.reduce((a, b) => Math.max(a, b), 0)`.

### D-74: SavingsComparison bars misleading when both rewards are 0

- **Original finding:** C9-08
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:78-82`
- **Reason for deferral:** When `totalReward` is 0 (all transactions uncategorized), the comparison shows a misleading bar chart. This is an edge case — most uploads have at least some categorized transactions. Hiding the section or showing a message is a UX enhancement.
- **Exit criterion:** If users are confused by the zero-reward comparison, hide the section or show "혜택이 없어요" instead.

### D-75: HTML-as-XLS double-decode and unnecessary re-encode in xlsx parser

- **Original finding:** C9-10 (extends D-52/C6-06)
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:290-294`
- **Reason for deferral:** Same class as D-52/C6-06. The double decode only affects HTML-as-XLS files. The performance impact is negligible for files under 10MB. Passing `{ type: 'string' }` to XLSX.read would avoid the re-encode.
- **Exit criterion:** If HTML-as-XLS parsing becomes a performance bottleneck, pass the HTML string directly to XLSX.read with `{ type: 'string' }`.

### D-76: Module-level `cachedCoreRules` persists across store resets

- **Original finding:** C9-12
- **Severity:** LOW (consistency)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/analyzer.ts:43-44`
- **Reason for deferral:** `cachedCoreRules` is never cleared even when the store's `reset()` method is called. This is inconsistent with `cachedCategoryLabels` being cleared on reset. However, the underlying `cards.json` data never changes within a session, so stale cache is not a practical concern.
- **Exit criterion:** If the card data source ever changes dynamically within a session, add a `clearAnalyzerCaches()` function and call it from `store.reset()`.

---

## Deferred Findings (Cycle 10)

### D-77: Global cap over-count correction in `calculateRewards` is subtle and needs documentation

- **Original finding:** C10-01
- **Severity:** LOW (maintainability)
- **Confidence:** High
- **File+line:** `packages/core/src/calculator/reward.ts:265-268`
- **Reason for deferral:** The behavior is correct — when the global cap clips a reward, the rule-level tracker must be rolled back to reflect only the actually-applied amount. Adding a documentation comment would help but is not urgent. This is addressed in Plan 19 Task 2 but marked LOW priority.
- **Exit criterion:** If the over-count correction logic is modified or a developer is confused by it, add the documentation comment.

### D-78: Subcategory color fallback goes to gray instead of parent category color

- **Original finding:** C10-04 (extends D-42/D-46/D-64)
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:87`
- **Reason for deferral:** Same class as D-42/D-46/D-64. Missing subcategories fall through to `uncategorized` gray. The fix requires either adding all subcategories to the hardcoded map (brittle) or implementing a dynamic color generator (requires design work).
- **Exit criterion:** When D-42 is resolved (dynamic color generation), this will be automatically fixed.

### D-79: `bestSingleCard` computation is O(n*m) — acceptable at current scale

- **Original finding:** C10-05 (extends D-09/D-51)
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:256-268`
- **Reason for deferral:** Same class as D-09/D-51. With 683 cards and typical transaction counts (< 1000), the bestSingleCard computation takes < 1ms. Pre-filtering cards would add complexity without measurable benefit.
- **Exit criterion:** If card count exceeds 5000 or optimization latency becomes noticeable, pre-filter cards by matching reward rules before computing bestSingleCard.

### D-80: `as const` type assertion in `OptimalCardMap` sort buttons is fragile

- **Original finding:** C10-07
- **Severity:** LOW (maintainability)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:62`
- **Reason for deferral:** The pattern is idiomatic Svelte 5 and works correctly. TypeScript would catch a type mismatch at compile time. The fragility is theoretical — adding a new sort key requires updating both the `SortKey` type and the button array, which is a normal development task.
- **Exit criterion:** No action needed unless a sort key mismatch causes a runtime error.

### D-81: AI categorizer import is dead code

- **Original finding:** C10-08 (same as D-10/D-68)
- **Severity:** LOW (dead-code)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:6`
- **Reason for deferral:** Same as D-10/D-68. The import adds minimal bundle weight. Removing it would require also removing AI-related UI code. Cleaner to leave as feature flag until the self-hosted AI runtime is implemented.
- **Exit criterion:** When the self-hosted AI runtime is implemented, either re-enable or remove.

### D-82: Annual savings projection multiplies by 12 regardless of data span

- **Original finding:** C10-10 (same as D-40)
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:174`
- **Reason for deferral:** Same as D-40. The "약" label makes it clear this is an estimate. Multiplying by 12 is the simplest annualization.
- **Exit criterion:** If users report confusion about annual savings numbers, change the label or remove the projection.

### D-83: BANK_SIGNATURES patterns should not use `g` flag — latent risk

- **Original finding:** C10-11
- **Severity:** LOW (latent-risk)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/detect.ts:8-105`
- **Reason for deferral:** No current patterns use the `g` flag. The risk is theoretical — a developer adding a new pattern might add `g` out of habit. Adding a comment to the BANK_SIGNATURES declaration would help but is not urgent.
- **Exit criterion:** If a developer adds a `g` flag pattern and `detectBank` produces wrong results on repeated calls, remove the `g` flag and add a comment.

### D-84: Empty merchant name matches first keyword with 0.8 confidence

- **Original finding:** C10-13
- **Severity:** LOW (edge-case)
- **Confidence:** Medium
- **File+line:** `packages/core/src/categorizer/matcher.ts:32-79`
- **Reason for deferral:** This is addressed by Plan 18 Task 3 (adding `lower.length < 2` guard). If that fix is implemented, empty and single-character merchant names will return `uncategorized` with 0.0 confidence. Deferring this separately in case Plan 18 Task 3 is not implemented.
- **Exit criterion:** If Plan 18 Task 3 is implemented, this is automatically fixed. If not, add the empty-string guard directly.

### D-85: SessionStorage truncation only omits transactions but optimization object can also be large

- **Original finding:** C10-12 (extends D-48)
- **Severity:** LOW (robustness)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:124-127`
- **Reason for deferral:** The optimization object is typically < 100KB. The 4MB budget leaves ample headroom even with a large optimization object. The scenario where optimization alone exceeds 4MB requires extreme inputs (> 50 cards with > 30 categories each). The current truncation strategy handles the common case (large transaction lists) correctly.
- **Exit criterion:** If users report `persistWarning = 'corrupted'` with normal-sized uploads, also truncate `optimization.cardResults` when the payload is still too large after omitting transactions.

---

## Deferred Findings (Cycle 11)

### D-86: Redundant recalculation in `scoreCardsForTransaction`

- **Original finding:** C11-01 (extends D-09/D-51)
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:96-97`
- **Reason for deferral:** Same class as D-09/D-51. `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction (before and after). Caching the `before` result would halve the calls but adds complexity due to cache invalidation when a new transaction is assigned. For typical use cases (< 1000 transactions, < 10 cards), this is fast enough.
- **Exit criterion:** If optimization latency becomes noticeable (> 5s), implement per-card result caching.

### D-87: Bucket object pattern in `calculateRewards` is fragile

- **Original finding:** C11-02
- **Severity:** LOW (code quality)
- **Confidence:** Low
- **File+line:** `packages/core/src/calculator/reward.ts:193-203`
- **Reason for deferral:** The inline bucket creation with `?? { ... }` works correctly in the current code flow. The Map.get/set pattern ensures each categoryKey has exactly one bucket. The theoretical risk of cross-category contamination requires two transactions with the same categoryKey where the second get returns undefined despite the first having set it, which is impossible in JavaScript's single-threaded execution.
- **Exit criterion:** If the bucket creation logic is refactored, add an explicit null check after `categoryRewards.get`.

### D-88: Bank adapter code duplication in CSV parser

- **Original finding:** C11-03 (extends D-01)
- **Severity:** LOW (DRY)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts:247-901`
- **Reason for deferral:** Same class as D-01. All 10 bank adapters follow the same pattern with only column name differences. The duplication makes maintenance harder but the code works correctly. Creating a generic `parseBankCSV(config)` function is a refactor that doesn't change behavior.
- **Exit criterion:** When D-01 is resolved (shared parser module), bank adapters will be unified as part of that refactor.

### D-89: `Math.max(...array)` stack overflow risk in OptimalCardMap

- **Original finding:** C11-04 (extends D-73)
- **Severity:** LOW (edge-case)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:19`
- **Reason for deferral:** Same class as D-73. `Math.max(...array)` can cause a stack overflow for arrays > ~100K entries. Typical usage has < 50 assignments, so this is not a realistic concern.
- **Exit criterion:** If assignments ever exceed 10,000 entries, replace with `array.reduce((a, b) => Math.max(a, b.rate), 0.001)`.

### D-90: PDF table parser `detectColumnBoundaries` iterates all lines

- **Original finding:** C11-05
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/pdf.ts:23-58`
- **Reason for deferral:** The column detection is O(n*m) where n is line count and m is max line length. For typical PDFs (< 50 pages), this completes in < 100ms. For very large PDFs, the performance impact is still acceptable because the rest of the parsing is also O(n).
- **Exit criterion:** If PDF parsing of large files (> 100 pages) is noticeably slow, limit `detectColumnBoundaries` to the first 50 lines.

### D-91: Shallow validation of nested optimization data in `loadFromStorage`

- **Original finding:** C11-06
- **Severity:** LOW (defense-in-depth)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:163-203`
- **Reason for deferral:** sessionStorage is same-origin and not accessible to other websites. The shallow validation of the optimization object (checking assignments array, totalReward/totalSpending/effectiveRate as numbers) is sufficient for the current use case. Adding deep validation of `cardResults` and `alternatives` would add complexity with minimal security benefit.
- **Exit criterion:** If malformed sessionStorage data causes UI rendering errors, add deeper validation for `cardResults` entries.

### D-92: Redundant Map creation from `constraints.cards` in `greedyOptimize`

- **Original finding:** C11-08
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:211-213`
- **Reason for deferral:** The Map creation from `constraints.cards.map()` is O(n) where n is the number of cards (< 700). The allocation cost is negligible. Changing the `OptimizationConstraints` type would be a breaking change to the core package's public API.
- **Exit criterion:** If `greedyOptimize` is called in tight loops or the card count exceeds 5000, accept `Map<string, number>` directly in `OptimizationConstraints`.

### D-93: Redundant array copy in `buildConstraints`

- **Original finding:** C11-09
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/constraints.ts:17`, `packages/core/src/optimizer/greedy.ts:219-221`
- **Reason for deferral:** `buildConstraints` creates a shallow copy `[...transactions]`, and then `greedyOptimize` creates another copy with `[...constraints.transactions].filter().sort()`. The first copy is unnecessary since the optimizer always creates its own working copy. However, removing the copy in `buildConstraints` changes the documented behavior that "the original transactions are preserved." For typical transaction counts (< 1000), the extra allocation is negligible.
- **Exit criterion:** If memory usage is a concern for large transaction sets (> 10,000), remove the spread copy in `buildConstraints` and update the documentation comment.

### D-94: Default `rewardType: 'discount'` misleading for no-rule categories

- **Original finding:** C11-10 (partially addressed in Plan 21 Task 4)
- **Severity:** LOW (UX clarity)
- **Confidence:** High
- **File+line:** `packages/core/src/calculator/reward.ts:200-203`
- **Reason for deferral:** Plan 21 Task 4 proposes changing the default from `'discount'` to `'none'`, but this is a behavioral API change that requires updating all downstream consumers. The current `'discount'` default is misleading but doesn't cause incorrect calculations. The UI only displays `rewardType` in limited contexts (card detail breakdown), where the 0 reward amount makes it clear no discount is applied.
- **Exit criterion:** If Plan 21 Task 4 is implemented, this is automatically resolved. Otherwise, if users report confusion about "할인" labels on categories with 0 reward, change the default.

### D-95: Confidence score of 0 when no bank detection is confusing (internal only)

- **Original finding:** C11-11
- **Severity:** LOW (internal clarity)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/detect.ts:127-150`
- **Reason for deferral:** The `confidence: 0` value when no bank is detected is never surfaced to the user. It's only used internally for bank detection logic. The value is technically correct (0% confidence in any detection) and changing it would add no functional benefit.
- **Exit criterion:** If `confidence` is ever displayed to users, change to `null` when no detection is made.

### D-96: "Other" group color is hardcoded gray in CategoryBreakdown

- **Original finding:** C11-15 (extends D-42/D-64/D-78)
- **Severity:** LOW (UX)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:51`
- **Reason for deferral:** Same class as D-42/D-64/D-78. The hardcoded `OTHER_COLOR = '#cbd5e1'` makes the subcategory items within the "other" expansion hard to visually distinguish. Adding a palette of muted colors for subcategory items is a UX enhancement.
- **Exit criterion:** When D-42 is resolved (dynamic color generation), implement subcategory color differentiation within the "other" group.

### D-97: `normalizeRate` percentage-form assumption not validated at schema level

- **Original finding:** C11-18
- **Severity:** LOW (data integrity)
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:113-117`
- **Reason for deferral:** The assumption that all YAML rates are in percentage form (e.g., 1.5 means 1.5%) is documented in code comments but not enforced by the Zod schema. If a YAML file is created with decimal rates (e.g., 0.015 for 1.5%), the division by 100 would produce 0.015% instead of 1.5%. This is a data contract issue that should be validated at schema level. However, all existing YAML files use percentage form consistently.
- **Exit criterion:** If a new YAML file is created with decimal-form rates, add a Zod schema validation that rejects rates < 0.01.

### D-98: `parseInt` vs raw number inconsistency between CSV and XLSX parsers

- **Original finding:** C11-19 (extends D-67)
- **Severity:** LOW (consistency)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts:82` vs `apps/web/src/lib/parser/xlsx.ts:241-255`
- **Reason for deferral:** Same class as D-67. CSV `parseAmount` uses `parseInt` (truncates to integer). XLSX `parseAmount` returns raw number for numeric input (can be float). For Korean Won, amounts are always integers, so both approaches produce correct results. Adding `Math.round()` in the XLSX numeric path would add consistency but no functional improvement.
- **Exit criterion:** If foreign-currency-converted amounts with decimal remainders appear in XLSX statements, add `Math.round()` in the XLSX numeric path.

### D-99: `isValidTx` doesn't check amount for NaN or negative values

- **Original finding:** C11-20
- **Severity:** LOW (validation)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:139-149`
- **Reason for deferral:** `isValidTx` checks that `amount` is of type `number` but doesn't validate that it's finite or positive. A restored transaction with `amount: NaN` would pass validation and potentially display "NaN원" in the UI. However, `loadFromStorage` validates the broader structure before reaching `isValidTx`, and the parsing code already guards against NaN amounts. The risk of NaN reaching `isValidTx` is very low.
- **Exit criterion:** If `NaN원` is ever displayed in the UI after sessionStorage restoration, add `Number.isFinite(tx.amount)` to the validation check.

---

## Deferred Findings (Cycle 16)

### D-100: `Taxonomy.findCategory` iterates all keywords for every substring/fuzzy search

- **Original finding:** C16-05
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/taxonomy.ts:68-74, 90-98`
- **Reason for deferral:** Same class as D-09. With ~2000 keywords and typical transaction counts, the O(n*m) per-merchant cost is acceptable. A trie-based prefix index would optimize this but adds significant complexity.
- **Exit criterion:** If keyword count exceeds 10,000 or categorization latency becomes noticeable, implement a trie-based prefix index.

### D-101: `SavingsComparison` count-up animation can flicker on rapid re-renders

- **Original finding:** C16-07
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-69`
- **Reason for deferral:** The `$effect` cleanup correctly cancels the previous animation frame. The flicker is only noticeable during rapid reoptimize cycles, which are user-initiated and infrequent. The animation restart from the current displayed value is correct behavior.
- **Exit criterion:** If users report janky animation during reoptimize, add a debounce or transition smoothing.

### D-102: `buildCategoryKey` not re-exported from `@cherrypicker/core` index

- **Original finding:** C16-08
- **Severity:** LOW (API gap)
- **Confidence:** High
- **File+line:** `packages/core/src/index.ts`
- **Reason for deferral:** Scheduled for implementation in Plan 27 Task 2. Deferring in case that plan is not completed this cycle.
- **Exit criterion:** When Plan 27 Task 2 is implemented, this is automatically resolved.

### D-103: `conditions` typed as `Record<string, unknown>` in web but `RewardConditions` in core

- **Original finding:** C16-09
- **Severity:** LOW (typing)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:35`
- **Reason for deferral:** Scheduled for implementation in Plan 27 Task 3. The loose typing is safe because `cards.json` is validated by the Zod schema at build time. Deferring in case that plan is not completed this cycle.
- **Exit criterion:** When Plan 27 Task 3 is implemented, this is automatically resolved.

---

## Deferred Findings (Cycle 19)

### D-104: Dashboard renders both empty state and data content divs — unnecessary hydration

- **Original finding:** C19-05 (extends D-38)
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/pages/dashboard.astro:31-119`
- **Reason for deferral:** Same as D-38. The fix requires restructuring the dashboard page to conditionally render the data content section. Using `client:visible` would avoid unnecessary hydration but requires testing that Svelte island hydration works correctly with lazy loading. The performance impact is minimal (one extra `loadCategories()` fetch) and the user experience is not affected.
- **Exit criterion:** If the dashboard page has noticeable load time issues or unnecessary network requests, switch to `client:visible` or conditional rendering.

### D-105: CardDetail fetch has no AbortController cleanup

- **Original finding:** C19-06 (extends D-62)
- **Severity:** LOW (robustness)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/cards/CardDetail.svelte:55-70`
- **Reason for deferral:** Same as D-62. The `fetchGeneration` counter correctly prevents stale responses. Adding AbortController would be a nice improvement but the network waste is minimal (one fetch per card navigation).
- **Exit criterion:** If CardDetail fetches cause noticeable performance issues, add AbortController cleanup.

---

## Deferred Findings (Cycle 42)

### D-106: Web-side PDF `tryStructuredParse` catches all exceptions with bare `catch {}`

- **Original finding:** C42-L01 (carry-over from C41 sweep item 17)
- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/pdf.ts:284`
- **Reason for deferral:** The web-side `tryStructuredParse` uses `catch {}` which swallows all errors including programming errors (ReferenceError, etc.). The server-side equivalent at `packages/parser/src/pdf/index.ts:181-186` only catches `SyntaxError | TypeError | RangeError` and re-throws everything else. This inconsistency could mask bugs on the web side, but the parser is a best-effort component where silent failure is acceptable behavior. The risk of a programming error being silently swallowed is low because the parser is well-tested and the code paths are simple.
- **Exit criterion:** If a programming error in the web-side PDF parser is silently caught and causes user confusion (showing "no transactions" with no diagnostic), narrow the catch to specific error types matching the server-side implementation.

### D-107: Server-side CSV `parseCSV` silently swallows adapter errors during content-signature detection

- **Original finding:** C42-L02 (carry-over from C41 sweep item 19)
- **Severity:** LOW (diagnostics)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/index.ts:56-65`
- **Reason for deferral:** The content-signature detection loop uses `catch { continue; }` which silently drops errors from bank-specific adapters. The web-side equivalent at `apps/web/src/lib/parser/csv.ts:974-980` logs the error with `console.warn`. If all adapters fail, the user gets no feedback about why bank-specific parsing failed, but the generic parser provides a reasonable fallback. Adding diagnostic logging is a minor improvement with no functional impact.
- **Exit criterion:** If users report confusion about why bank-specific parsing failed with no diagnostic output, add `console.warn` or error collection in the catch block to match the web-side behavior.

---

## Deferred Findings (Cycle 43)

### D-108: `calculateRewards` applies `perTxCap` to rate-based reward when both rate and fixedAmount are present

- **Original finding:** C43-L01
- **Severity:** LOW (edge case)
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:259-273`
- **Reason for deferral:** When a rule has both `normalizedRate > 0` AND `hasFixedReward`, the code logs a warning and uses rate-based reward only. The `perTxCap` is applied to the rate-based reward, but may have been calibrated for a fixed-amount reward. In practice, none of the 81 YAML files have both `rate` and `fixedAmount` on the same tier, so this is a theoretical concern. The existing warning at line 265-269 already flags this case.
- **Exit criterion:** If a YAML file is created with both rate and fixedAmount on the same tier, either add both rewards before applying perTxCap, or make the Zod schema enforce mutual exclusivity.

### D-109: Web-side encoding detection silently swallows errors with `catch { continue; }`

- **Original finding:** C43-L04 (same class as D-107/C42-L02)
- **Severity:** LOW (diagnostics)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/index.ts:34`
- **Reason for deferral:** The web-side `parseFile` tries multiple encodings (utf-8, euc-kr, cp949) in a loop with `catch { continue; }`. If all decodings fail, the fallback at line 37 uses utf-8 which may produce garbled text. The user gets no feedback that encoding detection failed. Same class as D-107 (silent error swallowing).
- **Exit criterion:** If users report garbled transaction data with no error message after uploading, add a warning error to the ParseResult when `bestReplacements` is still very high after all encoding attempts.

---

## Deferred Findings (Cycle 44)

### D-110: Edits to non-latest month transactions have no visible optimization effect

- **Original finding:** C44-L04
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:340-411`
- **Reason for deferral:** When the user edits a transaction from a non-latest month in `TransactionReview.svelte`, the `reoptimize` method correctly recalculates `previousMonthSpending` from all edited transactions (including non-latest). However, the optimization result only reflects the latest month's transactions. If the user changes a category on a non-latest month transaction, the optimization doesn't visibly change, which could be confusing. This is correct behavior from a reward calculation perspective -- the optimizer only assigns the latest month's transactions. Adding a message or visual indicator for non-latest-month edits is a UX enhancement, not a bug fix.
- **Exit criterion:** If users report confusion about why editing non-latest month transactions has no visible effect on the optimization, add a UI message explaining that only the latest month is optimized.

---

## Deferred Findings (Cycle 3)

### D-111: `getCardById` performs O(n) linear scan of all issuers and cards

- **Original finding:** C3-L02
- **Severity:** LOW (performance)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/cards.ts:214-240`
- **Reason for deferral:** Same class as D-09/D-51 (performance at scale). With 683 cards across 10 issuers, the linear scan takes < 1ms and is not a bottleneck. The function is called once per CardDetail mount and once per card in the grid. A Map index would be O(1) but adds complexity for minimal benefit at current scale.
- **Exit criterion:** If the card count exceeds 5000 or `getCardById` is called in tight loops, build a `Map<string, CardRuleSet>` index when `loadCardsData()` is first called.

---

## Cycle 7 resolutions and newly deferred items

### Resolved (previously deferred)

- **D6-01 — upload → dashboard waitForURL timeout** — RESOLVED by C7-E01 (`parsePreviousSpending` now accepts `unknown` and coerces correctly; Svelte 5 `bind:value` on `<input type="number">` no longer crashes the upload flow). Root cause was a runtime type mismatch, NOT parallel contention as cycle-6 suspected. Parallel-contention tail mitigated by C7-E02 (`mode: 'serial'`).
- **D6-02 — `feature cards render` strict-mode violation** — RESOLVED by C7-E03 (`data-testid="feature-card-{analysis,recommend,savings}"` added + spec updated).

### Newly deferred (cycle 7)

#### D7-M1: dead `_loadPersistWarningKind = null` in reset()
- **Severity:** LOW / High confidence
- **File+line:** `apps/web/src/lib/store.svelte.ts:601-602`
- **Reason:** maintenance-only; no runtime effect (module-level vars are already cleared at store construction).
- **Exit criterion:** refactor together with D7-M6 when persistence is extracted.

#### D7-M2: `setResult` footgun with no callers
- **Severity:** MEDIUM / Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:452-459`
- **Reason:** method has no current callers; deleting or guarding during a busy cycle adds churn without value.
- **Exit criterion:** first caller appears, or the method is deleted in a dedicated store-cleanup cycle.

#### D7-M3: timer leak on rapid re-upload within 1.2s
- **Severity:** MEDIUM / Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:266-277`
- **Reason:** requires a specific double-click race; no user report.
- **Exit criterion:** reproducer test added.

#### D7-M4: `parsePreviousSpending` accepts `-0`
- **Severity:** LOW / Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:228-234`
- **Reason:** `-0` is numerically equivalent to `0`.
- **Exit criterion:** a test asserts strict sign behaviour.

#### D7-M5: silent drop of malformed-date rows from monthlyBreakdown
- **Severity:** LOW / Medium
- **File+line:** `apps/web/src/lib/analyzer.ts:322-333`
- **Reason:** documented as C6-01 convention; all-malformed already throws (C96-01).
- **Exit criterion:** user reports "some transactions missing" from the breakdown.

#### D7-M6: module-level mutable `_loadPersistWarningKind`
- **Severity:** MEDIUM / High
- **File+line:** `apps/web/src/lib/store.svelte.ts:216-220, :379`
- **Reason:** testability concern; no runtime failure mode in the app singleton path.
- **Exit criterion:** persistence module extracted to its own file (tied to A7-02).

#### D7-M7: `reuseExistingServer` masks stale builds
- **Severity:** MEDIUM / Medium
- **File+line:** `playwright.config.ts:19`
- **Reason:** paired with C7-E07 (build-scope fix). When CI pipeline lands, re-evaluate.
- **Exit criterion:** CI pipeline enforces fresh builds.

#### D7-M8: no axe-core WCAG regression gate
- **Severity:** MEDIUM / Medium
- **File+line:** repo-wide (no integration).
- **Reason:** introducing axe is a feature; outside this cycle's scope.
- **Exit criterion:** dedicated a11y cycle adds `@axe-core/playwright` + one gate test.

#### D7-M9: `ui-ux-screenshots.spec.js` has no assertions
- **Severity:** LOW / Low
- **File+line:** `e2e/ui-ux-screenshots.spec.js` (all tests).
- **Reason:** intentional manual-review smoke harness.
- **Exit criterion:** migrate to `toMatchSnapshot` with tolerance.

#### D7-M10: submit spinner lacks `aria-busy`
- **Severity:** LOW / Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:490-505`
- **Reason:** cosmetic a11y polish.
- **Exit criterion:** a11y cycle.

#### D7-M11: selector-string coupling / persistence refactor / type-package split
- **Severity:** MEDIUM / Medium
- **File+line:** `e2e/ui-ux-review.spec.js`, `apps/web/src/lib/store.svelte.ts`, `apps/web/src/lib/analyzer.ts:10`.
- **Reason:** architectural; cross-cycle.
- **Exit criterion:** dedicated refactor cycle.

#### D7-M12: `getAllCardRules` refetched per reoptimize
- **Severity:** LOW / High
- **File+line:** `apps/web/src/lib/analyzer.ts:186-201`
- **Reason:** 10-50ms per reoptimize; negligible for current UX.
- **Exit criterion:** reoptimize called frequently enough to profile.

#### D7-M13: `unsafe-inline` in script-src CSP
- **Severity:** MEDIUM / High
- **File+line:** Astro config (to locate); comments in test files reference this.
- **Reason:** Astro inline hydration; nonce migration requires Astro upstream support.
- **Exit criterion:** Astro CSP nonce integration lands.

#### D7-M14: test-selector polish (T7-05, T7-06, T7-07, T7-09, T7-11, T7-12, T7-13, T7-14, T7-15)
- **Severity:** LOW / Medium
- **File+line:** various in `e2e/ui-ux-review.spec.js`.
- **Reason:** current `.first()` + `or()` patterns work; narrowing selectors to testids is a polish cycle.
- **Exit criterion:** follow-up test-engineer cycle.

### Severity-preserved cycle-6 deferrals re-noted in cycle 7

- **C6UI-04, C6UI-05 (WCAG 1.4.11 non-text contrast, MEDIUM)** — remain deferred. Severity NOT downgraded to LOW (cycle-6 plan implied LOW; cycle 7 re-classifies to match WCAG AA). Exit criterion: axe-core gate cycle (same as D7-M8).
- **C6UI-23 (target size, LOW)** — remains deferred. Already meets SC 2.5.8 at 24×24; exit criterion is upgrade to 44×44 for WCAG AAA.

---

## Cycle 8 resolutions and status re-affirmation

### Resolved (previously deferred)

- **D7-M1 — dead `_loadPersistWarningKind` reset in `reset()`** — RESOLVED by C8-01 (commit `refactor(web): 🔥 remove dead _loadPersistWarningKind reset in store.reset()`). Verified module-level vars are already nullified during construction; singleton store makes reset path redundant.
- **D7-M3 — timer leak on rapid re-upload** — RESOLVED by C8-04 (commit `fix(web): 🐛 defensive clearTimeout before navigateTimeout reassignment`). Defense-in-depth 1-line guard; physical button-disable already blocks normal-flow double-invocation.
- **D7-M4 — `parsePreviousSpending` accepts `-0`** — RESOLVED by C8-02 (commit `fix(web): 🐛 coerce -0 to +0 in parsePreviousSpending`). `-0` now normalized to `+0` on both number and string branches; downstream consumers using `Object.is(x, 0)` or string-concat behave symmetrically.
- **D7-M10 — submit spinner lacks `aria-busy`** — RESOLVED by C8-03 (commit `feat(web): ♿ add aria-busy to upload form`). Screen readers now announce busy state during uploading.

### Remaining deferrals (severity preserved, exit criteria unchanged)

- **D7-M2 — `setResult` footgun with no callers** — MEDIUM / Medium — keep deferred. Cycle-8 re-audit confirmed zero callers across apps + e2e + tests; candidate for deletion next cycle. Exit criterion: first caller appears, or method is deleted.
- **D7-M5 — silent drop of malformed-date rows** — LOW / Medium — unchanged.
- **D7-M6 — module-level mutable `_loadPersistWarningKind`** — MEDIUM / High — unchanged (tied to A7-02 persistence extraction).
- **D7-M7 — `reuseExistingServer` masks stale builds** — MEDIUM / Medium — unchanged.
- **D7-M8 — no axe-core gate** — MEDIUM / Medium — unchanged.
- **D7-M9 — `ui-ux-screenshots.spec.js` has no assertions** — LOW / Low — unchanged (intentional).
- **D7-M11 — architectural refactors (A7-01/02/03)** — MEDIUM / Medium — unchanged.
- **D7-M12 — `getAllCardRules` refetched per reoptimize** — LOW / High — unchanged.
- **D7-M13 — `unsafe-inline` in script-src CSP** — MEDIUM / High — unchanged; Astro nonce upstream gate.
- **D7-M14 — test-selector polish** — LOW / Medium — unchanged.

### New findings during cycle 8 (not promoted, not regressed)

- **C8CR-01 — `setResult` would skip analyzer-cache invalidation** — LOW / Medium. If D7-M2 is resolved by deletion, this also resolves. Otherwise defer. Not shipping a fix this cycle.
- **C8CR-02 — `loadFromStorage` shallow-validates `cardResults[].byCategory` entries** — LOW / Low. Same-origin sessionStorage; zero real impact. Defer.
- **P8-01 — `reoptimize` rebuilds monthlyBreakdown fully** — LOW / Medium. Negligible at scale (<5ms on 10k transactions). Defer.
- **P8-02 — persist serializes entire result on every reoptimize** — LOW / High. User-paced edits make debouncing unnecessary. Defer.
- **D8-01 — no `prefers-reduced-motion` rule for spinner** — LOW / Low. Defer to a11y cycle (D7-M8 gate).
- **D8-02 — dashboard cards lack `role="region"` + `aria-labelledby`** — LOW / Low. Defer to a11y cycle.

### Severity-preserved cycle-6 deferrals, unchanged in cycle 8

- **C6UI-04, C6UI-05** — MEDIUM — axe-core cycle (same as D7-M8).
- **C6UI-23** — LOW — AAA 44×44 target-size upgrade.

---

## Cycle 9 resolutions and status re-affirmation

### Resolved (previously deferred)

- **D7-M2 — `setResult` footgun with no callers** — RESOLVED by C9-01 (commit `refactor(web): 🔥 remove dead setResult method from analysisStore`). Cycle-9 re-audit confirmed zero callers across `apps/`, `e2e/`, `packages/`, `tools/` (only `.context/**` documentation matches). Exit criterion "method is deleted" satisfied literally. Method deleted in full (8 lines).
- **C8CR-01 — `setResult` would skip analyzer-cache invalidation** — RESOLVED (subsumed by D7-M2 deletion). No path exists to inject an un-cached result; `analyze()` and `reoptimize()` are the only result-setters and both go through the cache-hygiene pipeline.

### Remaining deferrals (severity preserved, exit criteria unchanged)

- **D7-M5 — silent drop of malformed-date rows** — LOW / Medium — unchanged.
- **D7-M6 — module-level mutable `_loadPersistWarningKind`** — MEDIUM / High — unchanged (tied to A7-02 persistence extraction).
- **D7-M7 — `reuseExistingServer` masks stale builds** — MEDIUM / Medium — unchanged.
- **D7-M8 — no axe-core gate** — MEDIUM / Medium — unchanged.
- **D7-M9 — `ui-ux-screenshots.spec.js` has no assertions** — LOW / Low — unchanged (intentional).
- **D7-M11 — architectural refactors (A7-01/02/03)** — MEDIUM / Medium — unchanged.
- **D7-M12 — `getAllCardRules` refetched per reoptimize** — LOW / High — unchanged.
- **D7-M13 — `unsafe-inline` in script-src CSP** — MEDIUM / High — unchanged; Astro nonce upstream gate.
- **D7-M14 — test-selector polish** — LOW / Medium — unchanged.
- **C8CR-02, P8-01, P8-02, D8-01, D8-02** — all LOW — unchanged.
- **C6UI-04, C6UI-05** — MEDIUM — tied to D7-M8.
- **C6UI-23** — LOW — AAA upgrade.

### New findings during cycle 9

None. The single new finding (C9-01 / D7-M2 promotion) is resolved in-cycle.

No security, correctness, or data-loss finding is deferred this cycle.

---

## Cycle 10 resolutions and status re-affirmation

### Resolved (previously deferred)

None this cycle. Cycle 9 closed D7-M2 and C8CR-01. Cycle 10 fresh deep review found 1 new LOW item (C10-01: formatSavingsValue test gap), deferred below.

### Remaining deferrals (severity preserved, exit criteria unchanged)

- **D7-M5 — silent drop of malformed-date rows** — LOW / Medium — unchanged.
- **D7-M6 — module-level mutable `_loadPersistWarningKind`** — MEDIUM / High — unchanged (tied to A7-02 persistence extraction).
- **D7-M7 — `reuseExistingServer` masks stale builds** — MEDIUM / Medium — unchanged.
- **D7-M8 — no axe-core gate** — MEDIUM / Medium — unchanged.
- **D7-M9 — `ui-ux-screenshots.spec.js` has no assertions** — LOW / Low — unchanged (intentional).
- **D7-M11 — architectural refactors (A7-01/02/03)** — MEDIUM / Medium — unchanged.
- **D7-M12 — `getAllCardRules` refetched per reoptimize** — LOW / High — unchanged.
- **D7-M13 — `unsafe-inline` in script-src CSP** — MEDIUM / High — unchanged; Astro nonce upstream gate.
- **D7-M14 — test-selector polish** — LOW / Medium — unchanged.
- **C8CR-02, P8-01, P8-02, D8-01, D8-02** — all LOW — unchanged.
- **C6UI-04, C6UI-05** — MEDIUM — tied to D7-M8.
- **C6UI-23** — LOW — AAA upgrade.

### New findings during cycle 10 (fresh deep review)

#### C10-01: No unit test for `formatSavingsValue` helper
- **Original finding:** C10-TE01 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:224-227`
- **Reason for deferral:** The `formatSavingsValue` helper centralizes sign-prefix logic across 3 components (SavingsComparison, VisibilityToggle, ReportContent). It lacks dedicated unit tests for edge cases (negative values, zero, 99/100 boundary, `prefixValue` override). The function works correctly in production and is covered by E2E tests. Adding unit tests is a quality improvement, not a bug fix.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09).

### Gate evidence
- `npm run lint` — PASS (exit 0).
- `npm run typecheck` — PASS (exit 0).
- `bun run test` — PASS (FULL TURBO, 10/10 cached).
- `npm run verify` — PASS (10/10 turbo tasks cached).

No security, correctness, or data-loss finding is deferred this cycle.

## Cycle 4 (RPF) — 2026-04-24

### New deferred findings

#### C4-03: No test coverage for scope="col" accessibility attributes
- **Original finding:** C4-T01 (test-engineer)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte` and other tables
- **Reason for deferral:** Would require Playwright + axe-core accessibility audit infrastructure, which is a significant investment. All scope="col" attributes are now in place; the gap is in regression prevention, not in the code itself.
- **Exit criterion:** If accessibility audit infrastructure (Playwright + axe-core) is added to the e2e test suite, add scope="col" assertions for all table headers.

#### C4-04: No lint rule to enforce buildPageUrl() over raw BASE_URL in Svelte components
- **Original finding:** C4-T02 (test-engineer)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/formatters.ts` (buildPageUrl), Svelte components
- **Reason for deferral:** All current raw BASE_URL instances in Svelte files have been fixed. A lint rule would prevent future regressions but is lower priority given zero current violations.
- **Exit criterion:** If new raw BASE_URL usage appears in Svelte components after this fix, add a grep-based CI check or ESLint rule.

### Resolved findings (not deferred)

- C4-01 (incomplete C3 fixes — buildPageUrl): Fixed in commits 58b1273 (SavingsComparison, SpendingSummary, CardPage) and b1e7699 (TransactionReview scope="col").
- C4-02 (ReportContent summary table row headers): Fixed in commit 2d1c227 (th scope="row").

### Gate evidence
- `npm run lint` — PASS (0 errors, 0 warnings, 0 hints)
- `npm run typecheck` — PASS (0 errors)
- `bun run test` — PASS (197 tests, 0 fail, FULL TURBO)
- `npm run verify` — PASS (10/10 turbo tasks cached)

No security, correctness, or data-loss finding is deferred this cycle.

## Cycle 5 (RPF) — 2026-04-24

### New deferred findings

#### C5-02: Results page stat elements populated by DOM manipulation instead of reactive binding
- **Original finding:** C5-02 (code-reviewer C5-CR02, designer C5-D02)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/pages/results.astro:52-60`, `apps/web/src/components/ui/VisibilityToggle.svelte:89-103`
- **Reason for deferral:** Refactoring VisibilityToggle to extract stat population into a dedicated component is a UX architecture change. Current DOM manipulation works correctly. Moving to reactive binding is a quality improvement, not a bug fix.
- **Exit criterion:** When VisibilityToggle is refactored, move stat population into a dedicated ResultsStats component.

#### C5-03: VisibilityToggle has dual responsibilities (visibility + stat population)
- **Original finding:** C5-03 (code-reviewer C5-CR03, architect C5-A02)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:18-22,76-87`
- **Reason for deferral:** Same as C5-02. The dual responsibility is a code quality concern, not a bug.
- **Exit criterion:** When the results page is refactored, extract stat population into a dedicated component.

#### C5-04: No test for Astro page buildPageUrl migration
- **Original finding:** C5-04 (test-engineer C5-T01)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/__tests__/formatters.test.ts` (new or existing)
- **Reason for deferral:** The migration itself is simple and verifiable by grep. A unit test for `buildPageUrl()` would add regression protection but is LOW priority.
- **Exit criterion:** If new raw BASE_URL usage appears in future commits, add a grep-based CI check or ESLint rule.

#### C5-05: No test for VisibilityToggle stat population
- **Original finding:** C5-05 (test-engineer C5-T02)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:89-103`
- **Reason for deferral:** Depends on C5-02/C5-03 being resolved first.
- **Exit criterion:** When C5-02/C5-03 are resolved, add Playwright test for results page stats.

### Resolved findings (not deferred)

- C5-01 (Astro pages raw BASE_URL): Fixed in commit 9a642d1 (dashboard.astro, results.astro, report.astro migrated to `buildPageUrl()`). 6-agent convergence; 9 raw BASE_URL references eliminated across 3 Astro page templates.

### Gate evidence
- `npm run lint` — PASS (0 errors, 0 warnings, 0 hints)
- `npm run typecheck` — PASS (0 errors)
- `bun run test` — PASS (197 tests, 0 fail, FULL TURBO)
- `npm run verify` — PASS (10/10 turbo tasks cached)

No security, correctness, or data-loss finding is deferred this cycle.

---

## Cycle 7 (original review cycle) — new deferred items

### C7-01: CATEGORY_NAMES_KO hardcoded map can silently drift from YAML taxonomy
- **Original finding:** C7-CR01 (code-reviewer), C7-A01 (architect), C7-CT01 (critic), tracer
- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:11-90`
- **Reason for deferral:** The CLI entry point (`tools/cli/src/`) currently does not load category labels from the rules package. Fixing this requires modifying the CLI pipeline to load labels and pass them through to the optimizer — a multi-file change that affects the CLI's startup flow and the core package's public API. The TODO (C64-03) has existed since cycle 64 of the original review loop without causing a user-facing issue, because category labels are cosmetic (the optimizer's correctness depends on category IDs, not labels). The web app is unaffected because it passes `categoryLabels` dynamically.
- **Exit criterion:** When the CLI is refactored to load labels dynamically, or when a build-time generation step produces the fallback data from the YAML source.

### C7-02: FALLBACK_CATEGORY_LABELS is another hardcoded duplicate of the YAML taxonomy
- **Original finding:** C7-CR02 (code-reviewer), C7-A01 (architect), C7-CT01 (critic)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:32-110`
- **Reason for deferral:** Same class as C7-01. The fallback is only used when `loadCategories()` returns empty (AbortError during View Transition). The dynamic path is correct. Generating the fallback at build time would solve both C7-01 and C7-02 together.
- **Exit criterion:** When a build-time generation step produces fallback data from the YAML source, or when the fallback is removed entirely with a "categories unavailable" message.

### C7-04: `entertainment.subscription` key in FALLBACK_CATEGORY_LABELS inconsistent with taxonomy
- **Original finding:** C7-CR04 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:101`
- **Reason for deferral:** The duplicate key works correctly for backward compatibility. The comment acknowledges the inconsistency. Fixing it requires a STORAGE_VERSION migration that rewrites persisted data, which is a breaking change for users with existing sessionStorage data.
- **Exit criterion:** When STORAGE_VERSION is next incremented (for an unrelated schema change), add a migration that rewrites `entertainment.subscription` to `subscription` in persisted data, then remove the legacy key from the fallback map.

### C8-01: FALLBACK_GROUPS in TransactionReview is a third hardcoded duplicate of the YAML taxonomy

- **Original finding:** C8-CR02 (code-reviewer), C8-A01 (architect), C8-CT01 (critic)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:27-42`
- **Reason for deferral:** Same class as C7-01/C7-02. The FALLBACK_GROUPS array duplicates the category hierarchy from categories.yaml. When the taxonomy changes, this must be updated in lockstep. The critic notes this is the fifth recurrence of the hardcoded-duplicate pattern (C64-03, C6-02, C7-CR01, C7-CR02, C8-CR02). The recommended systemic fix (build-time generation from categories.yaml) would resolve C7-01, C7-02, and C8-01 together. No user-facing issue has been reported because the fallback is only used when loadCategories() fails (AbortError during View Transition).
- **Exit criterion:** When a build-time generation step produces fallback data from the YAML source (same as C7-01/C7-02 exit criterion).

---

## Deferred Findings (Cycle 9)

### C9-01: CATEGORY_COLORS in CategoryBreakdown is a fourth hardcoded duplicate of the YAML taxonomy

- **Original finding:** C9-CR01 (code-reviewer), C9-A01 (architect), C9-CT01 (critic), C9-T01 (tracer)
- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87`
- **Reason for deferral:** Same systemic pattern as C7-01/C7-02/C8-01. CATEGORY_COLORS is an 80-entry Record mapping category IDs to hex colors. When the taxonomy adds or renames a category, this map must be manually updated in lockstep or new categories silently render gray. The build-time generation fix would resolve all instances together.
- **Exit criterion:** When a build-time generation step produces color maps from the YAML source (same as C7-01/C7-02/C8-01 exit criterion).

### C9-02: ALL_BANKS in FileDropzone duplicates parser bank signatures

- **Original finding:** C9-CR02 (code-reviewer), C9-A02 (architect), C9-T02 (tracer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Reason for deferral:** The ALL_BANKS array duplicates the bank IDs in detect.ts. A build-time generation step could produce this list from the parser's bank signature data. Not user-facing unless a new bank is added to the parser but not the UI selector.
- **Exit criterion:** When a build-time generation step produces the bank list from the parser's data, or when the parser exports its bank list for reuse.

### C9-03: formatIssuerNameKo in formatters.ts duplicates issuer name data

- **Original finding:** C9-CR03 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:52-79`
- **Reason for deferral:** Same systemic pattern as C9-01. 23-entry Record mapping issuer IDs to Korean names. Must be updated in lockstep when issuers change. Build-time generation from cards.json issuer data would resolve this.
- **Exit criterion:** When a build-time generation step produces issuer name maps from the JSON source (same as C9-01 exit criterion).

### C9-04: getIssuerColor in formatters.ts duplicates issuer color data

- **Original finding:** C9-CR04 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:115-143`
- **Reason for deferral:** Same systemic pattern as C9-01. 23-entry Record mapping issuer IDs to hex colors. Must be updated in lockstep when issuers change.
- **Exit criterion:** When a build-time generation step produces issuer color maps from the JSON source (same as C9-01 exit criterion).

### C9-05: getCategoryIconName in formatters.ts duplicates taxonomy icon mapping

- **Original finding:** C9-CR06 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:85-110`
- **Reason for deferral:** Same systemic pattern as C9-01. Maps category IDs to icon names. New categories fall through to 'credit-card'. Build-time generation would resolve this.
- **Exit criterion:** When a build-time generation step produces icon maps from the YAML source (same as C9-01 exit criterion).

### C9-08: No test coverage for buildCategoryLabelMap edge cases

- **Original finding:** C9-TE01 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/category-labels.ts:7-26`
- **Reason for deferral:** Test coverage gap. The function works correctly in production. Adding tests is valuable but not blocking.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled.

### C9-09: No test coverage for sessionStorage persistence/recovery

- **Original finding:** C9-TE02 (test-engineer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/store.svelte.ts:146-330`
- **Reason for deferral:** Test coverage gap. The complex persistence logic works correctly in production. Adding tests requires mocking sessionStorage.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled.

### C9-10: build-stats.ts fallback values may become stale

- **Original finding:** C9-DS02 (document-specialist)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/build-stats.ts:16-18`
- **Reason for deferral:** The fallback values (683 cards, 24 issuers, 45 categories) are only used when cards.json is unavailable at build time. The values are read from the actual JSON when available.
- **Exit criterion:** When the build pipeline is updated to auto-generate fallback values, or when the fallback is removed in favor of a build-time error.

---

## Deferred Findings (Cycle 11)

### C11-CR01: getCategoryColor does 3-way fallback with `.split('.').pop()` per call

- **Original finding:** C11-CR01 (code-reviewer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98`
- **Reason for deferral:** Minor GC pressure from temporary string arrays. Not a correctness issue. Same exit criterion as C7-01 (build-time generation would produce a pre-computed reverse lookup Map).
- **Exit criterion:** When build-time generation from categories.yaml is implemented (same as C7-01).

### C11-CR02: formatIssuerNameKo is 7th hardcoded taxonomy duplicate

- **Original finding:** C11-CR02 (code-reviewer, architect)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/formatters.ts:52-78`
- **Reason for deferral:** Same class as C9-03. Issuer name data should derive from cards.json at build time.
- **Exit criterion:** When build-time generation from cards.json is implemented (same as C7-01).

### C11-CR03: FALLBACK_GROUPS is 3rd category hierarchy duplicate

- **Original finding:** C11-CR03 (code-reviewer, architect)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:26-42`
- **Reason for deferral:** Same class as C8-01. Fallback category data should derive from categories.yaml at build time.
- **Exit criterion:** When build-time generation from categories.yaml is implemented (same as C7-01).

### C11-CR04: ALL_BANKS is 2nd bank list duplicate

- **Original finding:** C11-CR04 (code-reviewer, architect)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Reason for deferral:** Same class as C9-02. Bank list should derive from cards.json data.
- **Exit criterion:** When build-time generation from cards.json is implemented (same as C7-01).

### C11-CR05: build-stats.ts fallback values may become stale (duplicate of C9-10)

- **Original finding:** C11-CR05 (code-reviewer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/build-stats.ts:16-18`
- **Reason for deferral:** Duplicate of C9-10. Hardcoded fallback values will silently become wrong.
- **Exit criterion:** Same as C9-10.

### C11-CR06: formatSavingsValue strips sign unconditionally — API footgun

- **Original finding:** C11-CR06 (critic)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/formatters.ts:226`
- **Reason for deferral:** The current API works correctly for all existing callers. The risk of future misuse is theoretical. Adding a direction parameter would be a minor improvement but not worth the churn across 3 consuming components.
- **Exit criterion:** If a new caller misuses the API and produces a user-visible bug, refactor to return a structured object.

### C11-CR07: persistToStorage uses misleading "corrupted" label for quota errors

- **Original finding:** C11-CR07 (critic)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/store.svelte.ts:176-190`
- **Reason for deferral:** The naming is technically incorrect but has no user-facing impact. The `kind` field is only consumed internally to set `persistWarningKind` state, which is only checked for `!== null` in the UI.
- **Exit criterion:** When the persistence module is refactored (tied to D7-M6/A7-02), rename `corrupted` to `quota_exceeded` for clarity.

---

## Deferred Findings (Cycle 12)

### C12-CR01: globalMonthUsed / ruleMonthUsed rollback inconsistency after global cap clip

- **Original finding:** C12-CR01 (code-reviewer)
- **Severity:** MEDIUM (latent inconsistency)
- **Confidence:** Low
- **File+line:** `packages/core/src/calculator/reward.ts:311-331`
- **Reason for deferral:** Latent inconsistency in cap tracking that has no visible effect in practice. The global cap check is applied independently per transaction, so the rule-level tracker over-reporting remaining capacity never causes a user-visible incorrect reward. Fixing would require refactoring the cap tracking to use a single source of truth, which is out of scope for a latent issue.
- **Exit criterion:** If the optimizer ever produces incorrect rewards due to cap tracking, consolidate rule-level and global cap tracking into a single tracking mechanism.

### C12-DB03: PDF fallback dateMatch[1] is undefined (no capture groups in regex)

- **Original finding:** C12-DB03 (debugger)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/pdf.ts:383`
- **Reason for deferral:** Latent bug in the fallback line scanner — `dateMatch[1]!` is undefined because `fallbackDatePattern` has no capture groups. The resulting "undefined" string is passed to `parseDateToISO`, which returns an invalid date that gets filtered downstream. No user-visible effect because the transaction is excluded from optimization. Fixing requires adding a capture group to the regex or using `dateMatch[0]` instead.
- **Exit criterion:** When the PDF parser is refactored (tied to D-01), fix the regex to use `dateMatch[0]` or add proper capture groups.

### C12-UX01: CategoryBreakdown no visual affordance for expandable rows on mobile

- **Original finding:** C12-UX01 (designer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:203-275`
- **Reason for deferral:** Minor UX polish. The `onclick` handler works on touch devices, but there is no visual indicator (chevron, arrow) that rows are expandable. Adding a subtle chevron would improve discoverability but is low priority.
- **Exit criterion:** When a UX polish cycle is scheduled, add a subtle expand/collapse chevron to category rows.

### C12-UX02: SpendingSummary warning banner dismiss button lacks focus ring

- **Original finding:** C12-UX02 (designer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:158`
- **Reason for deferral:** Minor accessibility polish. The dismiss button has no explicit focus ring, making it hard for keyboard-only users to see when the button has focus. Adding `focus:ring-2 focus:ring-[var(--color-primary)]` would fix this.
- **Exit criterion:** When an accessibility polish cycle is scheduled, add focus ring styles to the dismiss button.

### C12-UX04: TransactionReview table horizontal scroll without visual indicator

- **Original finding:** C12-UX04 (designer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:272`
- **Reason for deferral:** Minor UX polish. The table has `overflow-x-auto` for narrow viewports, but no visual indicator (fade gradient, scrollbar hint) that horizontal scrolling is available. Adding a subtle shadow or fade on the right edge would improve discoverability.
- **Exit criterion:** When a UX polish cycle is scheduled, add a scroll indicator to the transaction table.

### C12-TE03: No test coverage for XLSX isHTMLContent function

- **Original finding:** C12-TE03 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:266-275`
- **Reason for deferral:** Test coverage gap. The `isHTMLContent` function detects HTML disguised as XLS (common in Korean card exports). Edge cases (BOM + HTML, mixed encoding) are untested. The function works correctly in production.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09).

### C12-TE04: No test coverage for getCategoryLabels caching behavior

- **Original finding:** C12-TE04 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:383-398`
- **Reason for deferral:** Test coverage gap. The "don't cache empty Map" guard (line 394-397) prevents an AbortError from poisoning all subsequent reoptimize calls. This guard has no test coverage. A regression could cause English keys instead of Korean labels.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09).

### Cycle 12 re-affirmation of existing deferred items

All previously deferred items remain unchanged. No severity downgrades. The following items saw renewed cross-agent agreement this cycle:
- C7-01 (CATEGORY_NAMES_KO drift) — confirmed by code-reviewer, architect, critic
- D-01 (duplicate parsers) — confirmed by architect, code-reviewer (C12-CR04)
- D-02 (license mismatch) — confirmed by document-specialist

---

## Deferred Findings (Cycle 13)

### C13-CR01: Wildcard rule exemption from subcategory blocking is undocumented

- **Original finding:** C13-CR01 (code-reviewer)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/core/src/calculator/reward.ts:81`
- **Reason for deferral:** Minor documentation gap. The guard `if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;` correctly skips broad-category rules for subcategorized transactions, while wildcard rules (`category: '*'`) bypass the guard. The behavior is correct for Korean card terms but the wildcard exemption's intent is not documented. The existing TODO at line 79-80 covers the `includeSubcategories` schema extension.
- **Exit criterion:** When the `includeSubcategories` schema field is added, update the comment at line 81 to reference it. A standalone documentation comment can be added sooner if a comment-focused cycle is scheduled.

### C13-CR02: formatSavingsValue '+' prefix can appear/disappear during count-up animation

- **Original finding:** C13-CR02 (code-reviewer)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/formatters.ts:224-227`
- **Reason for deferral:** Known intentional behavior. The `prefixValue >= 100` threshold for showing '+' prefix is stable once animation completes. The brief appearance/disappearance during count-up when crossing 100 won is a minor visual artifact that has been noted before (C82-03). The current behavior is acceptable.
- **Exit criterion:** If users report confusion about the '+' prefix flickering during animation, consider deferring the prefix decision until after animation completes.

### C13-A01: buildCategoryLabelMap bare sub-ID exclusion should be documented in module JSDoc

- **Original finding:** C13-A01 (architect)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/category-labels.ts:16-20`
- **Reason for deferral:** Correct architectural decision documented only in inline comments. The module's JSDoc should explain why bare subcategory IDs are intentionally excluded from the label map. Currently all code paths use `buildCategoryKey()` which produces dot-notation keys, so this is not a runtime issue. The comment at lines 16-20 is sufficient for inline reference but the module-level JSDoc should mention this design choice.
- **Exit criterion:** When the category-labels module is refactored (tied to C7-01/C7-02 build-time generation), add a JSDoc explaining the bare sub-ID exclusion policy.

### C13-TE01: No unit test for getCategoryColor 3-way fallback logic

- **Original finding:** C13-TE01 (test-engineer)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98`
- **Reason for deferral:** Test coverage gap. `getCategoryColor` tries full key, then `split('.').pop()` leaf ID, then `uncategorized`, then `OTHER_COLOR`. This 4-level fallback has no unit test. The component works correctly in E2E tests but the fallback chain could regress silently.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09/C12-TE03/C12-TE04).

### Cycle 13 re-affirmation of existing deferred items

All previously deferred items remain unchanged. No severity downgrades. The following items saw renewed cross-agent agreement this cycle:
- C7-01/C7-02/C9-01 (hardcoded taxonomy duplicates) — confirmed by code-reviewer, architect, critic across 7 cycles
- D-01 (duplicate parsers) — confirmed by architect, code-reviewer
- D-02 (license mismatch) — confirmed by document-specialist

---

## Deferred Findings (Cycle 14)

### C14-CR01: findRule sort uses O(n) `rules.indexOf` tiebreak

- **Original finding:** C14-CR01 (code-reviewer)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/core/src/calculator/reward.ts:65-90`
- **Reason for deferral:** Informational only. Sort comparator chains by specificity then by `rules.indexOf(a)` for deterministic ordering (rationale documented inline at C1-12). Theoretical worst case is O(n^2 log n), but typical cards define <30 rules — well below any realistic perf cliff. Not a real problem at current scale.
- **Exit criterion:** If a card definition ever exceeds ~200 rules, precompute an index map keyed by rule reference to make tiebreak O(1).

### C14-CR02: FALLBACK_CATEGORY_LABELS re-confirmation

- **Original finding:** C14-CR02 (code-reviewer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/category-labels.ts:32-110`
- **Reason for deferral:** Re-confirmation of existing deferred item C7-02 (hardcoded fallback duplicates `categories.yaml`). No new manifestation. Already covered by the build-time codegen exit criterion.
- **Exit criterion:** Same as C7-02 — build-time generation from `categories.yaml` that produces all fallback data automatically.

### C14-CRT01: Source-comment cycle citations lack a central glossary

- **Original finding:** C14-CRT01 (critic)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** repo-wide source comments referencing `Cn-mm` cycle tags (70+ files)
- **Reason for deferral:** Optional documentation polish. Cycle tags (e.g. `C82-03`, `C92-01`) anchor archaeology but a future contributor without context cannot decode them without grepping `.context/`. A one-line README/AGENTS pointer to `.context/reviews/_aggregate.md` would resolve this. Not blocking; not a correctness or security issue.
- **Exit criterion:** When a documentation polish cycle is scheduled, add a one-line note in `README.md` or `AGENTS.md` pointing to `.context/reviews/_aggregate.md` as the cycle-citation index.

### C14-TE01: getCategoryColor 3-way fallback still has no direct unit test

- **Original finding:** C14-TE01 (test-engineer)
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:94-98`
- **Reason for deferral:** Test coverage gap. Same as C13-TE01 / C9-08. The function lives inside a Svelte component and would require an export refactor (move `getCategoryColor` + `CATEGORY_COLORS` to `apps/web/src/lib/category-colors.ts`) to enable isolated unit testing. The function works correctly in E2E.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09/C12-TE03/C12-TE04/C13-TE01).

### Cycle 14 re-affirmation of existing deferred items

All previously deferred items remain unchanged. No severity downgrades. The following items saw renewed cross-agent agreement this cycle:
- C7-01/C7-02/C9-01 (hardcoded taxonomy duplicates) — confirmed by code-reviewer, architect, critic across 8 cycles
- D-01 (duplicate parsers) — confirmed by architect across 14 cycles
- D-02 (license mismatch) — confirmed by document-specialist
- D-09 (scoreCardsForTransaction O(n*m)) — re-affirmed by perf-reviewer
- D-31, D-32 (security carry-forward) — re-affirmed by security-reviewer

