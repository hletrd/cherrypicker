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
