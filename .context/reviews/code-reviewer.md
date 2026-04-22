# Code Review — cherrypicker monorepo

**Date:** 2026-04-22
**Reviewer:** code-reviewer (Opus 4.6)
**Scope:** All source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper (excluding node_modules, build output, data YAML)

## Review Summary

**Files Reviewed:** ~55 source files
**Total Issues:** 14

### By Severity
- CRITICAL: 1 (must fix)
- HIGH: 3 (should fix)
- MEDIUM: 6 (consider fixing)
- LOW: 4 (optional)

---

## Issues

### [CRITICAL] Greedy optimizer O(n*m) re-calculation per transaction causes quadratic blowup on large card sets

**File:** `packages/core/src/optimizer/greedy.ts:132-139`
**Confidence:** High

**Issue:** In `scoreCardsForTransaction`, for every transaction, the optimizer calls `calculateCardOutput` twice per card (before and after push) to compute the marginal reward. `calculateCardOutput` runs the full reward calculation across all assigned transactions for that card. With N transactions and M cards, this is O(N * M * T) where T is the average number of transactions already assigned per card — yielding O(N^2 * M) total. For a user with 500 transactions and 10 cards, this means ~50,000 full reward recalculations.

**Concrete failure scenario:** A user uploads a 12-month statement with 1000+ transactions and selects 10 cards. The optimization takes multiple seconds on the main thread, freezing the web UI. With the web app running in the browser, this directly impacts UX.

**Fix:** Instead of full recalculation, implement incremental reward tracking per card. Maintain running totals per rule-key (for cap tracking) and compute only the marginal reward for the new transaction against existing state. This reduces per-transaction scoring from O(T) to O(1) for the common case (no cap hit). Alternatively, consider running the optimizer in a Web Worker.

---

### [HIGH] Duplicate `applyMonthlyCap` function diverges from `calculatePercentageReward`

**File:** `packages/core/src/calculator/reward.ts:123-139` vs `packages/core/src/calculator/types.ts:46-67`
**Confidence:** High

**Issue:** There are two implementations of monthly cap logic. `calculatePercentageReward` in `types.ts` computes `raw = Math.floor(amount * rate)` and then applies the cap. `applyMonthlyCap` in `reward.ts` takes a pre-computed `rawReward` and applies the cap. While the cap logic is structurally identical, having two implementations creates a maintenance hazard: a bug fix applied to one will likely be missed in the other. Additionally, `calculateDiscount`, `calculatePoints`, and `calculateCashback` are all aliases for `calculatePercentageReward`, but `reward.ts` calls `applyMonthlyCap` instead of using the `calcFn` with its built-in cap logic — meaning the `calcFn` call at line 270/276 always passes `monthlyCap: null, currentMonthUsed: 0` and then re-applies the cap separately.

**Concrete failure scenario:** A developer fixes an edge case in `calculatePercentageReward` (e.g., handling negative remaining cap), but the fix does not propagate to `applyMonthlyCap` because they are separate functions. Reward calculations silently diverge.

**Fix:** Remove `applyMonthlyCap` from `reward.ts`. Instead, pass the real `monthlyCap` and `currentMonthUsed` directly to the `calcFn` (which is already `calculatePercentageReward`). This eliminates the duplicate cap logic and ensures all cap-handling code paths go through a single function.

---

### [HIGH] Server-side bank detection signature order differs from web-side, causing different detection results

**File:** `packages/parser/src/detect.ts:10-107` vs `apps/web/src/lib/parser/detect.ts:8-105`
**Confidence:** High

**Issue:** The `BANK_SIGNATURES` arrays in the server-side and web-side detection modules are identical in content but duplicated — they are two separate arrays that must be maintained in lockstep. The server-side `detectCSVDelimiter` processes ALL lines in the file, while the web-side version (at `apps/web/src/lib/parser/detect.ts:175`) correctly limits to the first 30 lines for performance. This means the same file can produce different delimiter detection results on the server vs the browser for large files.

**Concrete failure scenario:** A large CSV file with a comma-heavy header section but tab-delimited data section is parsed differently on the CLI (server-side, counts all commas) vs the web app (browser-side, counts only first 30 lines). The CLI selects comma as delimiter, producing garbled rows; the web app correctly selects tab.

**Fix:** (1) Unify the `BANK_SIGNATURES` constant into a shared module (as noted in the C70-04 TODO in `csv.ts`). (2) Apply the 30-line limit to the server-side `detectCSVDelimiter` as well, matching the web-side optimization. The server-side version at `packages/parser/src/detect.ts:149` currently processes the entire file content.

---

### [HIGH] Server-side CSV parsers lack BOM stripping, silently failing on Windows-generated exports

**File:** `packages/parser/src/csv/index.ts:29` (the `parseCSV` function)
**Confidence:** High

**Issue:** The web-side `parseCSV` (at `apps/web/src/lib/parser/csv.ts:969`) strips the UTF-8 BOM character (`﻿`) before processing. The server-side `parseCSV` does NOT strip the BOM. When a Windows-generated CSV file starts with a BOM, the first header cell becomes `﻿이용일` instead of `이용일`, causing `headers.indexOf('이용일')` to return -1. The parser falls through to the generic parser or fails entirely.

**Concrete failure scenario:** A Korean user downloads a CSV statement from their bank on Windows, where the export includes a BOM. The CLI tool (`tools/cli`) parses it with the server-side parser and either returns 0 transactions or falls back to the generic parser with misaligned columns. The same file works fine when uploaded to the web app because the browser-side parser strips the BOM.

**Fix:** Add BOM stripping at the top of the server-side `parseCSV` function: `const cleanContent = content.replace(/^﻿/, '');` and use `cleanContent` throughout. This matches the web-side fix already present in `apps/web/src/lib/parser/csv.ts:969`.

---

### [MEDIUM] `RewardConditions` index signature `[key: string]: unknown` weakens type safety

**File:** `packages/rules/src/types.ts:28`
**Confidence:** High

**Issue:** The `RewardConditions` interface has `[key: string]: unknown` which allows arbitrary properties. This means `rule.conditions.anyTypo` compiles without error and silently returns `undefined` at runtime. The `rewardConditionsSchema` uses `.passthrough()` which also allows unknown keys through Zod validation. Together, these create a gap where typos in condition property names are not caught at compile time or validation time.

**Concrete failure scenario:** A YAML file contains `excludeOnlie: true` (typo for `excludeOnline`). The Zod schema passes it through via passthrough. The `ruleConditionsMatch` function in `reward.ts` checks `rule.conditions?.excludeOnline` which is `undefined`, so the rule incorrectly applies to online transactions.

**Fix:** (1) Remove `[key: string]: unknown` from the `RewardConditions` interface and list all known condition properties explicitly. (2) Change `.passthrough()` to `.strict()` in `rewardConditionsSchema` to reject unknown keys at validation time, forcing YAML authors to fix typos. (3) Add a Zod `refine` that warns on unrecognized keys if strict mode is too aggressive for forward compatibility.

---

### [MEDIUM] `inferYear` uses wall-clock time, producing inconsistent results across timezones

**File:** `packages/parser/src/date-utils.ts:24-31` and `apps/web/src/lib/parser/date-utils.ts:35-43`
**Confidence:** Medium

**Issue:** `inferYear` uses `new Date()` which is timezone-dependent. The function determines whether a short date (MM/DD) belongs to the current or previous year based on whether it is more than 90 days in the future. On 2026-01-01 at 00:30 KST (UTC+9), `new Date()` in a UTC context returns 2025-12-31, causing the function to assign the date to 2025 instead of 2026.

**Concrete failure scenario:** A user in Korea uploads a January statement late at night. The server runs in UTC. The `inferYear` function incorrectly assigns January transactions to the previous year, causing them to be excluded from the latest-month optimization.

**Fix:** Use `Date.now()` with an explicit timezone offset, or pass a reference date as a parameter with a default of `new Date()`. For the server-side, consider using the file's metadata (e.g., the statement period) to infer the year rather than wall-clock time.

---

### [MEDIUM] `loadCardsData` retry-after-abort can produce a pending Promise that never resolves

**File:** `apps/web/src/lib/cards.ts:237-240`
**Confidence:** Medium

**Issue:** After an AbortError, `loadCardsData` checks `if (result === undefined && cardsPromise)` and returns `cardsPromise`. However, if the new fetch also aborts before resolving, `cardsPromise` may have been reset to `null` inside the catch handler. The returned promise then resolves to `undefined` on the next await, and the caller gets `undefined` instead of the expected `CardsJson`.

**Concrete failure scenario:** A component calls `loadCardsData()` during a rapid mount/unmount cycle. The first fetch aborts, a second fetch starts, but also aborts before resolving. The second call returns the second promise, which resolves to `undefined`. `getAllCardRules()` then returns `[]`, and the optimizer produces 0 rewards. The user sees "no card data available" despite valid data being on the server.

**Fix:** Add a loop with a maximum retry count (e.g., 2) inside `loadCardsData` so that consecutive aborts do not silently return `undefined`. Alternatively, propagate the abort error to the caller so they can decide whether to retry.

---

### [MEDIUM] `CategoryTaxonomy.findCategory` iterates all keywords on every call — O(K) per match where K is total keyword count

**File:** `packages/core/src/categorizer/taxonomy.ts:58-111`
**Confidence:** Medium

**Issue:** The `findCategory` method performs three sequential full scans of `keywordMap`: exact match (O(1) via Map.get), then substring match (O(K*L) where K is keyword count and L is merchant name length), then fuzzy match (same). The substring and fuzzy scans iterate all entries. For the 394KB keywords file, this is potentially thousands of entries per transaction.

**Concrete failure scenario:** Categorizing 500 transactions from a statement, each with a merchant name that doesn't match exactly, triggers 1000+ full keyword map scans. On a mobile device, this adds measurable latency to the analysis step.

**Fix:** Pre-build a trie or Aho-Corasick automaton from the keyword map for efficient substring matching. Short term, cache the Map entries as an array at construction time (avoiding iterator overhead) and consider early termination when a high-confidence match is found.

---

### [MEDIUM] `buildStats.ts` hardcodes fallback card counts that silently drift from reality

**File:** `apps/web/src/lib/build-stats.ts:16-18`
**Confidence:** High

**Issue:** The `readCardStats` function hardcodes fallback values (`totalCards: 683`, `totalIssuers: 24`, `totalCategories: 45`). When `cards.json` is unavailable at build time, these stale numbers are shown to users. As cards are added or removed, these numbers silently diverge from the actual data.

**Concrete failure scenario:** After 20 new cards are added to the YAML files, the landing page still shows "683 cards" until someone manually updates the fallback values. Users see incorrect card counts.

**Fix:** Remove the hardcoded fallbacks. If `cards.json` is unavailable at build time, fail the build rather than showing incorrect numbers. Alternatively, read the count from the YAML file directory at build time (the build script has filesystem access).

---

### [MEDIUM] `CATEGORY_NAMES_KO` in greedy.ts is a manually maintained duplicate of the YAML taxonomy

**File:** `packages/core/src/optimizer/greedy.ts:11-86`
**Confidence:** High

**Issue:** The `CATEGORY_NAMES_KO` map duplicates the Korean labels from `packages/rules/data/categories.yaml`. The code has a TODO comment (C64-03) acknowledging this drift risk. When a new category is added to the YAML taxonomy, the optimizer's label map must be updated in lockstep or the new category will display as its English ID.

**Concrete failure scenario:** A new category `tax_payment` is added to `categories.yaml` with label `세금납부`. The optimizer displays "tax_payment" instead of "세금납부" in the CLI output because `CATEGORY_NAMES_KO` was not updated.

**Fix:** Import the category labels from the rules package at runtime (already done in the web app via `buildCategoryLabelMap`). For CLI usage, load the labels from the YAML taxonomy file at startup. This is acknowledged in the TODO comment — the fix is to prioritize it.

---

### [LOW] `formatWon` normalizes negative zero with a no-op

**File:** `packages/viz/src/terminal/summary.ts:8`, `packages/viz/src/terminal/comparison.ts:7`, `apps/web/src/lib/formatters.ts:8`
**Confidence:** High

**Issue:** The `formatWon` function contains `if (amount === 0) amount = 0;`. In JavaScript, `-0 === 0` is `true`, so this reassignment is a no-op — it does NOT convert `-0` to `0`. To normalize negative zero, you need `amount = amount + 0` or `Object.is(amount, -0) ? 0 : amount`. However, since `amount` arrives as a `number` (not from JSON parse which can produce -0), and all arithmetic in the codebase produces positive zero, this is not a functional bug — just a misleading comment/intent mismatch.

**Concrete failure scenario:** Unlikely in practice. If a calculation somehow produced `-0` (e.g., `0 * -1`), the current code would NOT normalize it, and `toLocaleString` would render "0원" anyway (most locales do not distinguish -0).

**Fix:** Either remove the comment and the no-op line (it does nothing), or change it to `if (Object.is(amount, -0)) amount = 0;` to correctly handle the edge case.

---

### [LOW] `getCalcFn` default case returns `calculateDiscount` for unknown reward types

**File:** `packages/core/src/calculator/reward.ts:108-110`
**Confidence:** Medium

**Issue:** The `default` case in `getCalcFn` returns `calculateDiscount` when an unknown reward type is encountered. This silently treats unrecognized types as discounts, which could produce incorrect reward calculations if a new type is added to the YAML schema but not to this switch statement.

**Concrete failure scenario:** A new reward type `"mileage_special"` is added to the YAML schema and processed by the optimizer. It falls through to the default case and is calculated as a discount, potentially producing incorrect amounts if the mileage valuation differs from the discount rate.

**Fix:** Change the default case to log a warning and return a no-op function (returning 0 reward), or throw an error for truly unknown types. This makes misconfiguration visible rather than silent.

---

### [LOW] Web-side CSV parser duplicates server-side bank adapter code

**File:** `apps/web/src/lib/parser/csv.ts:288-944` vs `packages/parser/src/csv/` (10 files)
**Confidence:** High

**Issue:** The web-side CSV parser contains full copies of all 10 bank adapters (hyundai, kb, samsung, etc.) within a single 1030-line file. The server-side versions are in separate files under `packages/parser/src/csv/`. The two codebases have already diverged in minor ways (the web side has BOM stripping, the server side does not; header scan limits differ). This is acknowledged in the C70-04 comment in `csv.ts`.

**Concrete failure scenario:** A bug fix applied to `packages/parser/src/csv/kb.ts` is not applied to the web-side `kbAdapter` in `apps/web/src/lib/parser/csv.ts`. The same KB card statement parses correctly on the CLI but fails in the web app.

**Fix:** As noted in the TODO, the long-term fix is a shared module that works in both Bun and browser environments. Short-term, add a comment at the top of each duplicated section pointing to the canonical server-side implementation, so maintainers know to update both.

---

### [LOW] `isValidISODate` does not validate the date is actually valid (e.g., accepts "2026-02-31")

**File:** `apps/web/src/lib/parser/date-utils.ts:148-150` and `packages/parser/src/date-utils.ts` (missing)
**Confidence:** Low

**Issue:** `isValidISODate` only checks the format `^\d{4}-\d{2}-\d{2}$` but does not validate that the date is actually valid (e.g., 2026-02-31 passes). The `parseDateStringToISO` function uses `isValidDayForMonth` to reject impossible dates during parsing, but if an impossible date somehow makes it into the data (e.g., from an XLSX serial number that bypasses validation), `isValidISODate` would not catch it.

**Concrete failure scenario:** An XLSX file contains a serial date number that SheetJS parses as Feb 31 in a non-leap year. The serial date validation path catches this, but if a future code change bypasses that validation, the invalid date would pass `isValidISODate` and be treated as a valid transaction date.

**Fix:** Extend `isValidISODate` to also check that the date is calendar-valid using `isValidDayForMonth`. This is a defense-in-depth measure.

---

## Positive Observations

1. **Excellent cap tracking and rollback logic** in `packages/core/src/calculator/reward.ts:314-319`. The code correctly rolls back the rule-level monthly-used tracker when the global cap clips a reward, preventing cap double-counting. This is a subtle correctness concern that was handled well.

2. **Robust sessionStorage persistence** in `apps/web/src/lib/store.svelte.ts`. The store handles quota errors, AbortError, schema migration, version tracking, and truncation with appropriate warnings. This is production-quality resilience.

3. **Defensive `console.debug` in ILP stub** at `packages/core/src/optimizer/ilp.ts:48`. Using `console.debug` (not `console.warn`) for the ILP fallback is the right choice — it is informational, not a problem.

4. **Consistent use of `Math.round(parseFloat(...))`** across all parsers for amount parsing. This correctly handles Korean Won's integer-only amounts and avoids the truncation bugs that `parseInt` would introduce.

5. **Well-structured Zod schemas** in `packages/rules/src/schema.ts`. The `.refine()` on `rewardTierRateSchema` enforcing mutual exclusivity of rate and fixedAmount is a good schema-level constraint that prevents misconfiguration.

6. **Comprehensive error propagation** in the CSV parser chain. Bank-specific adapter failures are caught and reported in the result, with fallback to the generic parser. This is the right approach — never silently lose data.

7. **BOM handling on the web side** at `apps/web/src/lib/parser/csv.ts:969`. The UTF-8 BOM strip is a real-world concern for Korean bank exports, and it was handled correctly on the web side.

---

## Recommendation

**REQUEST CHANGES**

The CRITICAL issue (quadratic optimizer performance) directly impacts the web app's usability for real-world statement sizes. The HIGH issues (duplicate cap logic, BOM stripping inconsistency, and server/web detection divergence) are correctness risks that should be addressed before the next release. The MEDIUM issues are maintainability concerns that will compound over time if not addressed.

### Priority order for fixes:
1. CRITICAL: Optimizer performance (consider Web Worker or incremental tracking)
2. HIGH: BOM stripping in server-side CSV parser (one-line fix)
3. HIGH: Unify `applyMonthlyCap` with `calculatePercentageReward`
4. HIGH: Unify server/web bank detection and delimiter detection
5. MEDIUM: Address `RewardConditions` type safety
6. MEDIUM: Replace `CATEGORY_NAMES_KO` with taxonomy-driven labels
