# Deferred Items — 2026-04-19 (Cycle 1)

Every finding from the reviews must be either (a) scheduled for implementation in a plan, or (b) explicitly recorded here as a deferred item. No finding may be silently dropped.

---

## Deferred Findings

### D-01: Duplicate parser implementations (web vs packages)

- **Original finding:** 00-summary #3, deep-code-quality P1-01
- **Severity:** HIGH (architectural)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Reason for deferral:** This is a major architectural refactor requiring extraction of shared parser logic into a platform-agnostic module. The web parser runs in the browser (no Bun/Node APIs) while the packages parser runs on Bun. This requires careful design of a shared core with platform-specific I/O layers. Doing this in a single cycle risks breaking both parser paths simultaneously.
- **Exit criterion:** Create a dedicated refactor cycle with a design doc first, then implement incrementally with dual-path testing.

### D-02: README says MIT, LICENSE is Apache 2.0

- **Original finding:** 00-summary #7
- **Severity:** MEDIUM (legal metadata)
- **Confidence:** High
- **File+line:** `README.md:169-171` vs `LICENSE:1-15`
- **Reason for deferral:** Legal metadata fix requires confirming the intended license with the project owner. Changing the README without confirmation could be incorrect.
- **Exit criterion:** Confirm intended license with project owner, then update README or LICENSE accordingly.

### D-03: `cards-compact.json` stale relative to `cards.json`

- **Original finding:** 00-summary #7
- **Severity:** MEDIUM (build artifact drift)
- **Confidence:** High
- **File+line:** `packages/rules/data/cards-compact.json`
- **Reason for deferral:** This is a build pipeline issue. The compact JSON should be regenerated as part of the build process. Fixing it requires understanding whether `cards-compact.json` is still needed or can be removed entirely.
- **Exit criterion:** Determine if `cards-compact.json` is consumed anywhere; if so, add it to the build pipeline; if not, delete it.

### D-04: No workspace-level `lint` script

- **Original finding:** 00-summary #6
- **Severity:** MEDIUM (tooling gap)
- **Confidence:** High
- **File+line:** Root `package.json:9-19`
- **Reason for deferral:** Adding a meaningful lint configuration (ESLint, Biome, etc.) across all workspaces is a non-trivial setup task. It should be done as a dedicated tooling improvement cycle.
- **Exit criterion:** Add ESLint or Biome to the monorepo with appropriate rules, add `lint` scripts to all workspaces.

### D-05: No CI quality gate (no test/lint/typecheck in deploy workflow)

- **Original finding:** 00-summary #6
- **Severity:** HIGH (release discipline)
- **Confidence:** High
- **File+line:** `.github/workflows/deploy.yml:17-40`
- **Reason for deferral:** CI configuration changes affect the deployment pipeline. Adding quality gates requires ensuring they pass reliably first (which depends on D-04 for lint). This should be done after lint and typecheck are green.
- **Exit criterion:** Add test, lint, and typecheck steps to the deploy workflow after all quality checks pass locally.

### D-06: Browser CSV support overstated (24 banks advertised, 10 have dedicated adapters)

- **Original finding:** 00-summary #11 (comprehensive review)
- **Severity:** MEDIUM (documentation accuracy)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/csv.ts` (10 bank adapters), `apps/web/src/lib/parser/detect.ts` (24 bank signatures)
- **Reason for deferral:** The generic CSV parser handles most bank formats reasonably well. Adding dedicated adapters for the remaining 14 banks requires access to real statement samples for testing. The generic parser is a functional fallback.
- **Exit criterion:** Either add dedicated adapters for remaining banks (with test data), or update documentation to clarify which banks have dedicated vs generic support.

### D-07: Fetch caching race condition in `loadCardsData`

- **Original finding:** M-04 (this cycle)
- **Severity:** MEDIUM
- **Confidence:** Low
- **File+line:** `apps/web/src/lib/cards.ts:144-157`
- **Reason for deferral:** The race condition is theoretical and would only manifest under very specific network failure timing. The current `.catch(() => { cardsPromise = null })` handling is adequate for most scenarios. Fixing this properly would require a more sophisticated caching strategy.
- **Exit criterion:** If users report stale/failed data loading issues, replace with a proper caching library or add timestamp-based staleness checks.

### D-08: `cu` bank ID is ambiguous

- **Original finding:** L-02 (this cycle)
- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/parser/src/detect.ts:95-96`, `apps/web/src/lib/parser/detect.ts:95-96`
- **Reason for deferral:** Renaming the bank ID would be a breaking change for any persisted data or URLs that reference `cu`. The current code works correctly (pattern `/신협/` matches the right bank). The ID is only ambiguous to humans reading the code.
- **Exit criterion:** If the bank ID is ever exposed in user-facing URLs or APIs, rename to `shinhyup` or `credit_union` with a migration path.

### D-09: `scoreCardsForTransaction` is O(n*m) per transaction (performance)

- **Original finding:** Final sweep (this cycle)
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `packages/core/src/optimizer/greedy.ts:84-110`
- **Reason for deferral:** The greedy optimizer recalculates `calculateCardOutput` for each card before and after adding each transaction. For typical use cases (< 1000 transactions, < 10 cards), this is fast enough. Optimization would require incremental reward tracking, which is a significant refactor.
- **Exit criterion:** If performance becomes an issue for large statement sets, implement incremental scoring that tracks running totals instead of recalculating from scratch.

### D-10: Browser AI categorizer is disabled but still imported

- **Original finding:** Final sweep (cycle 1)
- **Severity:** LOW (dead code)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:6` — `import * as aiCategorizer from '../../lib/categorizer-ai.js'`
- **Reason for deferral:** The import adds minimal bundle weight since the module is tiny (just throws errors). Removing it now would require also removing the AI-related UI code (buttons, progress indicators). It's cleaner to leave it in place as a feature flag until the self-hosted runtime is ready.
- **Exit criterion:** When the self-hosted AI runtime is implemented, either re-enable the feature or remove the dead code entirely.

---

## Deferred Findings (Cycle 2)

### D-11: O(n) substring scan in `CategoryTaxonomy.findCategory`

- **Original finding:** C2-02 (code-reviewer)
- **Severity:** MEDIUM (performance)
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/taxonomy.ts:68-74`
- **Reason for deferral:** The current keyword count (~500) makes the linear scan acceptable for typical use cases. Optimization (trie, Aho-Corasick) would require significant implementation effort for marginal gain.
- **Exit criterion:** If keyword count grows past 2000 or if categorization latency becomes noticeable, implement a trie-based lookup.

### D-12: No runtime validation of fetched JSON shape in `loadCardsData`/`loadCategories`

- **Original finding:** C2-03 (code-reviewer)
- **Severity:** MEDIUM (reliability)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/cards.ts:144-173`
- **Reason for deferral:** The JSON is generated by the build pipeline and validated by Zod schemas at generation time. Runtime validation adds overhead for every page load. A bad deploy would be caught by the build pipeline before reaching production.
- **Exit criterion:** If a bad deploy causes runtime errors from invalid JSON shape, add Zod validation at fetch time.

### D-13: `labelEn: ''` in `toRulesCategoryNodes` is semantically misleading

- **Original finding:** C2-05 (code-reviewer)
- **Severity:** LOW (semantic)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/analyzer.ts:25`
- **Reason for deferral:** The empty string satisfies the type and is unused by the matcher. Adding `labelEn` to the web CategoryNode type would require changes to the categories.json format and the cards.ts type definition for minimal benefit.
- **Exit criterion:** If `labelEn` becomes meaningful for matching or display, add it to the web type properly.

### D-14: E2E tests use CJS `require()` style

- **Original finding:** C2-06 (code-reviewer)
- **Severity:** LOW (style)
- **Confidence:** High
- **File+line:** `e2e/ui-ux-review.spec.js:6-9`
- **Reason for deferral:** Playwright's test runner supports both CJS and ESM. Converting to ESM would require renaming to `.mjs` or adding `"type": "module"` to a config. The current code works correctly and the style difference has no functional impact.
- **Exit criterion:** If the project standardizes on ESM for all test files, convert the E2E tests as well.

### D-15: XLSX has 24 bank configs, CSV only 10 adapters (asymmetry)

- **Original finding:** C2-07 (code-reviewer), also D-06 (cycle 1)
- **Severity:** LOW (documentation/coverage gap)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:18-170`, `apps/web/src/lib/parser/csv.ts`
- **Reason for deferral:** Duplicate of D-06. The generic CSV parser handles most bank formats. Adding dedicated CSV adapters for the remaining 14 banks requires access to real statement samples.
- **Exit criterion:** Add dedicated CSV adapters for remaining banks, or document the coverage gap.

### D-16: PDF text extraction string concatenation

- **Original finding:** C2-P02 (perf-reviewer)
- **Severity:** LOW (performance)
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/pdf.ts:236-244`
- **Reason for deferral:** Most PDF statements are < 20 pages, making the O(n^2) concatenation negligible. The fix (array + join) is trivial but low priority.
- **Exit criterion:** If PDFs with 100+ pages are commonly processed, switch to array-based concatenation.

### D-17: No HTTP cache control for cards.json

- **Original finding:** C2-P05 (perf-reviewer)
- **Severity:** LOW (performance/infra)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/cards.ts:144-157`
- **Reason for deferral:** Cache control is set by the hosting server (GitHub Pages / CDN), not by the application code. GitHub Pages sets reasonable cache headers by default.
- **Exit criterion:** If the cards.json fetch is slow on repeat visits, configure the hosting server or add a service worker.

### D-18: Duplicate bank detection logic across 3 files

- **Original finding:** C2-A02 (architect), also D-01 (cycle 1)
- **Severity:** MEDIUM (architectural)
- **Confidence:** High
- **File+line:** `packages/parser/src/detect.ts`, `apps/web/src/lib/parser/detect.ts`, `apps/web/src/lib/parser/csv.ts`
- **Reason for deferral:** Duplicate of D-01. This is a major architectural refactor requiring extraction of shared logic into a platform-agnostic module.
- **Exit criterion:** Create a dedicated refactor cycle with a design doc first, then implement incrementally.

### D-19: ILP optimizer stub adds console noise

- **Original finding:** C2-A03 (architect)
- **Severity:** LOW (noise)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/ilp.ts:48`
- **Reason for deferral:** The ILP optimizer is only called if explicitly selected. The default path uses greedy. Removing the export would be a breaking API change.
- **Exit criterion:** Either implement the ILP optimizer or remove it from the public API in a major version bump.

### D-20: Overlapping CardRuleSet types in core and rules packages

- **Original finding:** C2-A04 (architect)
- **Severity:** LOW (maintenance)
- **Confidence:** Medium
- **File+line:** `packages/core/src/models/card.ts`, `packages/rules/src/schema.ts`
- **Reason for deferral:** The two types serve different purposes (core uses a runtime type, rules uses a Zod-inferred type). Unifying them requires careful consideration of the dependency graph to avoid circular imports.
- **Exit criterion:** If the divergence causes actual bugs, unify by having core re-export from rules.

### D-21: Subcategories use spaces instead of optgroup in dropdown

- **Original finding:** C2-U02 (designer)
- **Severity:** LOW (accessibility)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:267-270`
- **Reason for deferral:** The current approach works visually. Using `<optgroup>` would prevent selecting the parent category, which may not be desired (users might want to assign a transaction to the broad category). A CSS-based indentation would be a better approach but is low priority.
- **Exit criterion:** If users report difficulty navigating the category dropdown, implement CSS-based indentation with ARIA grouping.

### D-22: Dark mode doesn't respect prefers-color-scheme on first visit

- **Original finding:** C2-U04 (designer)
- **Severity:** LOW (UX)
- **Confidence:** Medium
- **File+line:** `apps/web/src/layouts/Layout.astro`
- **Reason for deferral:** The flash of wrong theme only occurs if JS fails to load, which is rare. Adding an inline script adds complexity and conflicts with the CSP discussion.
- **Exit criterion:** If users report theme flicker, add the inline detection script.

### D-23: Select dropdowns lack aria-live for category changes

- **Original finding:** C2-U06 (designer)
- **Severity:** LOW (accessibility)
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:260-270`
- **Reason for deferral:** Native HTML `<select>` elements have reasonable built-in accessibility. Adding `aria-live` for every category change could be noisy for screen reader users.
- **Exit criterion:** If accessibility testing reveals issues with the select dropdowns, add targeted ARIA improvements.

### D-24: E2E test temp file not cleaned up

- **Original finding:** C2-T06 (test-engineer)
- **Severity:** LOW (hygiene)
- **Confidence:** High
- **File+line:** `e2e/ui-ux-review.spec.js:194-197`
- **Reason for deferral:** `/tmp` is periodically cleaned by the OS. The file is tiny and doesn't contain sensitive data.
- **Exit criterion:** If temp file accumulation becomes an issue, add cleanup in `afterEach`.

### D-25: No virtualization for large transaction lists

- **Original finding:** C2-U01 (designer)
- **Severity:** MEDIUM (UX/performance)
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/TransactionReview.svelte:236-295`
- **Reason for deferral:** Typical card statements have < 200 transactions, which renders fine. Virtual scrolling adds significant complexity for a marginal benefit in most cases. The `max-h-[400px] overflow-y-auto` handles the visual scrolling.
- **Exit criterion:** If users with 500+ transactions report sluggish scrolling, implement virtual scrolling.
