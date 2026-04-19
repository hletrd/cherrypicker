# Cycle 13 — Comprehensive Multi-Angle Code Review

**Date:** 2026-04-19
**Reviewer:** All specialist angles (code quality, performance, security, architecture, debugger, test, UI/UX, documentation)
**Scope:** Full repository — all packages/core, apps/web, packages/rules, tools

---

## Verification of Prior Cycle Findings

### Previously Fixed (Confirmed)

| Finding | Status | Evidence |
|---------|--------|----------|
| C12-14 | FIXED | `xlsx.ts:245` now uses `Math.round(raw)` for numeric amounts |
| C12-10 | FIXED | `analyzer-adapter.test.ts:208-296` now has multi-month handling tests |
| C12-11 | FIXED | `analyzer-adapter.test.ts:298-371` now has subcategory handling tests |
| C11-10 | FIXED | `reward.ts:201` now uses `rewardType: 'none'` for no-rule categories |
| C11-13 | FIXED | `categorizer.test.ts:249-306` has length guard tests |
| C12-16 | FIXED | `store.svelte.ts:147` now checks `Number.isFinite(tx.amount)` |

### Previously Deferred (Still Deferred)

C11-01 through C11-11, C11-15, C11-18 through C11-20, C12-01 through C12-09, C12-12, C12-13 — all LOW severity, unchanged.

---

## Code Quality Review

### C13-01: CSV `parseDateToISO` short-year output missing zero-padding
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:54`
- **Description:** When parsing a short-year date (YY-MM-DD), the CSV parser outputs `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[3]}` without padding the month/day. The XLSX version correctly uses `padStart(2, '0')` on lines 219-220. This means a date like "24.1.5" would produce "2024-1-5" instead of "2024-01-05" from the CSV parser. The inconsistency could cause issues downstream where ISO 8601 dates are expected (e.g., `tx.date.slice(0, 7)` for month extraction in `analyzer.ts:261` would produce "2024-1" instead of "2024-01").
- **Concrete failure scenario:** A CSV file with short-year dates like "24/1/5" would produce "2024-1-5" which would break month-based grouping in `analyzeMultipleFiles` where `tx.date.slice(0, 7)` is used to extract the month. "2024-1-" would be the result, not "2024-01".
- **Fix:** Add `.padStart(2, '0')` to the month and day parts in the CSV short-year branch:
  ```ts
  return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
  ```

### C13-02: PDF `parseDateToISO` short-year output also missing zero-padding
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:150`
- **Description:** Same issue as C13-01 but in the PDF parser. The short-year branch outputs `${fullYear}-${shortMatch[2]}-${shortMatch[3]}` without padding. The XLSX version is correct.
- **Concrete failure scenario:** Same as C13-01 — short-year dates in PDF statements would produce non-ISO dates.
- **Fix:** Add `.padStart(2, '0')` to month and day parts, same as the XLSX parser.

### C13-03: CSV `parseAmount` returns NaN instead of null — inconsistent with XLSX
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:82-91`
- **Description:** The CSV `parseAmount` function returns `NaN` when parsing fails (line 89), while the XLSX version returns `null` (line 246/254). The callers handle this differently — CSV uses `Number.isNaN(amount)` check while XLSX uses `amount === null`. This is a code consistency issue rather than a bug since both callers handle the failure correctly. However, the inconsistency makes the API surface harder to use correctly if new callers are added.
- **Concrete failure scenario:** A developer assumes all `parseAmount` functions return `null` on failure and writes `if (amount) ...` which would incorrectly skip `0` but not `NaN`.
- **Fix:** Unify the return type. Prefer `null` consistently across all parsers, or document the difference.

---

## Performance Review

### C13-04: Greedy optimizer recalculates full card output for every transaction — O(n*m*k) where k = number of transactions per card
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:84-109`
- **Description:** `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction (before and after adding the transaction). For N transactions, M cards, and K transactions already assigned to a card, this means each `calculateCardOutput` call iterates over all K assigned transactions plus the new one. The total work is O(N * M * K_avg) where K_avg is the average number of assigned transactions per card. For typical usage (dozens of transactions, 5-10 cards), this is acceptable. For large statements (1000+ transactions), this could be slow.
- **Concrete failure scenario:** A user uploads a statement with 2000 transactions. The optimizer runs for several seconds. This is an edge case — Korean card statements rarely exceed a few hundred transactions per month.
- **Fix:** Consider incremental reward tracking instead of full recalculation. This is a future optimization, not urgent.

### C13-05: `ALL_KEYWORDS` object is rebuilt from 4 spreads on every module load — minor startup cost
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/categorizer/matcher.ts:8-13`
- **Description:** The `ALL_KEYWORDS` object is built by spreading 4 import objects. This is a one-time cost at module load. For the typical keyword set (~500 entries), this is negligible. No action needed.
- **Concrete failure scenario:** No measurable impact.
- **Fix:** No action needed.

---

## Security Review

### C13-06: CSP meta tag allows `'unsafe-inline'` in script-src — reduces XSS protection
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/layouts/Layout.astro` (CSP meta tag)
- **Description:** The CSP policy includes `script-src 'self' 'strict-dynamic' 'unsafe-inline'`. The `'unsafe-inline'` directive effectively negates much of the CSP's XSS protection — any inline script injection would be allowed. The `'strict-dynamic'` is intended to make `'unsafe-inline'` a no-op in CSP2+ browsers, but older browsers that don't support `'strict-dynamic'` would honor `'unsafe-inline'` directly. This is a known compromise for backward compatibility and is documented with a TODO comment.
- **Concrete failure scenario:** On a browser that doesn't support CSP2's `'strict-dynamic'`, an XSS vulnerability in a third-party dependency would allow arbitrary script execution.
- **Fix:** Migrate to hash-based or nonce-based CSP as the TODO suggests. Remove `'unsafe-inline'` once all scripts use proper nonces/hashes.

### C13-07: No Subresource Integrity (SRI) for external resources
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/astro.config.ts` / `apps/web/src/layouts/Layout.astro`
- **Description:** The app is a static site that loads all resources from the same origin (GitHub Pages). There are no CDN-hosted external scripts or stylesheets. SRI is not needed for same-origin resources. The `categorizer-ai.ts` is disabled and doesn't load any external code.
- **Concrete failure scenario:** No impact — no external resources to protect.
- **Fix:** No action needed. If external CDN resources are added in the future, add SRI hashes.

---

## Architecture Review

### C13-08: `buildConstraints` creates `categorySpending` map that is never used by the optimizer
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/constraints.ts:20-24, 32`
- **Description:** `buildConstraints` computes a `categorySpending` map (total spending per category) and includes it in the returned `OptimizationConstraints`. However, `greedyOptimize` in `greedy.ts` never reads `constraints.categorySpending`. The map is only used for "reporting and UI summaries" according to the comment, but no consumer actually uses it. This is dead code.
- **Concrete failure scenario:** A developer sees `categorySpending` in the `OptimizationConstraints` type and assumes the optimizer uses it for decisions, leading to incorrect reasoning about the optimization logic.
- **Fix:** Either remove `categorySpending` from `OptimizationConstraints` (breaking type change) or document that it's unused by the optimizer and exists for future use / external consumers.

### C13-09: `CATEGORY_NAMES_KO` in greedy.ts duplicates the category label lookup from `categoryLabels`
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/optimizer/greedy.ts:7-50`
- **Description:** The `CATEGORY_NAMES_KO` hardcoded map in `greedy.ts` duplicates the category label data that is also provided via `constraints.categoryLabels` (loaded dynamically from `categories.yaml`). The `buildAssignments` function uses `categoryLabels` first and falls back to `CATEGORY_NAMES_KO`, which means the hardcoded map is only used when `categoryLabels` is not provided. This creates a maintenance burden — new categories must be added to both the YAML file and the hardcoded map.
- **Concrete failure scenario:** A new category is added to `categories.yaml` but not to `CATEGORY_NAMES_KO`. When `categoryLabels` is unavailable, the category would display as its English ID instead of its Korean label.
- **Fix:** Consider removing `CATEGORY_NAMES_KO` and requiring `categoryLabels` to always be provided, or generating the map from the YAML data at build time.

---

## Debugger Review

### C13-10: `findRule` specificity tie-breaking is undefined when two rules have the same score
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `packages/core/src/calculator/reward.ts:53-61, 87`
- **Description:** When two rules have the same `ruleSpecificity` score, `Array.sort()` is not guaranteed to be stable across JavaScript engines (though V8 uses stable sort since 2019). If two rules for the same category have the same specificity (e.g., two `dining` rules with different `conditions` that score the same), the one that wins is implementation-dependent. This is unlikely in practice because card rules rarely have exact specificity ties.
- **Concrete failure scenario:** Two dining rules both score 155 (category=100 + subcategory=50 + excludeOnline=10 -5...). Wait, that's impossible since both would have the same condition flags. More realistically, two wildcard rules (`category: '*'`) with different `conditions` could tie. The impact would be that the wrong rate is used for reward calculation.
- **Fix:** Add a secondary sort key (e.g., rule index or reward rate) to ensure deterministic tie-breaking.

### C13-11: `calculatePercentageReward` uses `Math.floor` instead of `Math.round` — systematically underestimates rewards
- **Severity:** LOW
- **Confidence:** High
- **File:** `packages/core/src/calculator/types.ts:52`
- **Description:** `calculatePercentageReward` computes `Math.floor(amount * rate)`. For example, 35,000 Won at 1.5% = 525.0 Won — `Math.floor` produces 525 (correct). But 35,001 Won at 1.5% = 525.015 — `Math.floor` produces 525 instead of 525 (effectively rounding down). This is the expected behavior for credit card reward calculations — Korean card companies always truncate (floor) partial Won amounts. So this is actually correct behavior, not a bug.
- **Concrete failure scenario:** No failure — this matches the business logic.
- **Fix:** No action needed. The behavior is correct for Korean credit card reward systems.

---

## Test Engineer Review

### C13-12: No tests for CSV short-year date parsing zero-padding
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/__tests__/` (missing)
- **Description:** The date parsing functions in CSV, XLSX, and PDF parsers handle many date formats. There are no unit tests for the `parseDateToISO` or `inferYear` functions. Given the C13-01/C13-02 finding that zero-padding is missing in CSV and PDF short-year branches, dedicated tests for date parsing would have caught this.
- **Concrete failure scenario:** A regression in date parsing goes undetected because there are no tests for the parser helpers.
- **Fix:** Add unit tests for `parseDateToISO` covering all supported formats: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYYMMDD, YY-MM-DD, MM/DD, Korean full date, Korean short date.

### C13-13: No test for `calculateRewards` global cap rollback behavior
- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/core/__tests__/` (missing)
- **Description:** The global cap rollback logic in `reward.ts:265-270` is subtle — when the global cap clips a reward, the rule-level tracker is rolled back to reflect only what was actually applied. This is a complex interaction between rule-level and global-level cap tracking. There are no unit tests verifying that the rollback produces correct results when multiple transactions compete for the same global cap.
- **Concrete failure scenario:** Two transactions in the same category both qualify for rewards, but the global cap only allows one of them. The rollback should correctly reduce the rule-level tracker for the second transaction. Without a test, a regression in this logic could cause over-counting or under-counting of rewards.
- **Fix:** Add a unit test that: (1) creates a card rule with both a rule-level cap and a global cap, (2) processes multiple transactions that exceed both caps, and (3) verifies the reward amounts and cap tracker values are correct.

---

## UI/UX Designer Review

### C13-14: SpendingSummary "전월실적" tooltip/helper text missing when only one month is uploaded
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:101-106`
- **Description:** When only one month of data is uploaded, the `monthlyBreakdown.length > 1` guard hides the "전월실적" line. This is correct behavior — there is no previous month. However, the user might not understand why performance tier data is based on a default value instead of their actual spending. A small helper text explaining "단일 월 데이터이므로 전월실적은 기본값을 사용합니다" would improve clarity.
- **Concrete failure scenario:** User uploads one month, sees optimization results, and wonders why the performance tier doesn't match their expected previous-month spending.
- **Fix:** Consider adding a subtle info line when `monthlyBreakdown.length === 1` explaining that previous-month spending defaults to the current month's total.

### C13-15: FileDropzone `addFiles` allows adding files that exceed total size but only warns after computation
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:118-155`
- **Description:** The total size check on line 137-142 happens after valid files are added to the candidate list. If the total exceeds 50MB, the function sets an error and returns without adding any files. However, the user's valid files are silently discarded — they need to re-add fewer files. The UX could be improved by adding as many files as fit within the budget instead of rejecting the entire batch.
- **Concrete failure scenario:** User adds 3 files (20MB, 20MB, 15MB). The first two fit within 50MB but the third pushes it to 55MB. The entire batch is rejected. The user expected at least the first two to be accepted.
- **Fix:** Consider adding files that fit within the budget and only rejecting those that would cause the total to exceed the limit.

---

## Final Sweep — Commonly Missed Issues

### C13-16: `analyzeMultipleFiles` uses `previousMonthSpending` from the *second-to-last* month, but the UI help text says "전전월"
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/analyzer.ts:269-276`, `apps/web/src/components/upload/FileDropzone.svelte:401`
- **Description:** In `analyzeMultipleFiles`, the "previous month" is `months[months.length - 2]` which is the second-to-last month in the uploaded data. The FileDropzone help text says "여러 달 업로드 시 전전월 실적이 자동으로 사용돼요" (two months ago). If a user uploads January and February statements, the previous month is January (the earlier month), which is the *전월* (previous month) relative to the optimization month (February). The Korean text "전전월" literally means "two months ago" which is incorrect — it should be "전월" (previous month).
- **Concrete failure scenario:** User reads the help text "전전월 실적이 자동으로 사용돼요" and thinks the app uses the month before their earliest upload as the performance tier input, when it actually uses the month before the latest upload.
- **Fix:** Change the help text from "전전월" to "전월": "여러 달 업로드 시 전월 실적이 자동으로 사용돼요."

### C13-17: `isValidTx` in store.svelte.ts doesn't validate `date` format
- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:144`
- **Description:** `isValidTx` checks `typeof tx.date === 'string' && tx.date.length > 0` but doesn't verify the date is in ISO 8601 format. A transaction with `date: "not-a-date"` would pass validation but would break downstream code that uses `tx.date.slice(0, 7)` for month extraction. The `analyzer.ts:261` code `tx.date.slice(0, 7)` would produce "not-a-" instead of a month key.
- **Concrete failure scenario:** After sessionStorage corruption, a transaction with `date: "invalid"` is restored and passes validation. The `monthlyBreakdown` calculation produces garbage month keys like "invalid".
- **Fix:** Add a basic date format check: `tx.date.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(tx.date)`. Or at minimum, check `tx.date.length >= 7` (enough for month extraction).

---

## Summary of New Findings

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C13-01 | MEDIUM | High | `csv.ts:54` | CSV short-year date missing zero-padding — produces non-ISO dates |
| C13-02 | MEDIUM | High | `pdf.ts:150` | PDF short-year date missing zero-padding — same as C13-01 |
| C13-03 | LOW | High | `csv.ts:82-91` | CSV parseAmount returns NaN vs XLSX returns null — inconsistent API |
| C13-04 | LOW | High | `greedy.ts:84-109` | Greedy optimizer O(n*m*k) — acceptable for typical use |
| C13-05 | LOW | Medium | `matcher.ts:8-13` | ALL_KEYWORDS spread at module load — negligible cost |
| C13-06 | MEDIUM | High | Layout.astro CSP | CSP allows 'unsafe-inline' in script-src — reduces XSS protection |
| C13-07 | LOW | Medium | astro.config.ts | No SRI for external resources — none exist, not needed |
| C13-08 | LOW | High | `constraints.ts:20-24` | `categorySpending` map is dead code — never read by optimizer |
| C13-09 | LOW | High | `greedy.ts:7-50` | `CATEGORY_NAMES_KO` duplicates `categoryLabels` — maintenance burden |
| C13-10 | LOW | Medium | `reward.ts:87` | findRule specificity tie-breaking undefined — unlikely in practice |
| C13-11 | LOW | High | `types.ts:52` | Math.floor in calculatePercentageReward — correct for Korean card terms |
| C13-12 | MEDIUM | High | `__tests__/` | No tests for parseDateToISO — would have caught C13-01/C13-02 |
| C13-13 | MEDIUM | High | `__tests__/` | No tests for global cap rollback in calculateRewards |
| C13-14 | LOW | Medium | SpendingSummary.svelte | Missing helper text for single-month upload |
| C13-15 | LOW | Medium | FileDropzone.svelte | Total size check rejects entire batch instead of partial |
| C13-16 | LOW | Medium | FileDropzone.svelte:401 | "전전월" should be "전월" in help text |
| C13-17 | LOW | Medium | store.svelte.ts:144 | isValidTx doesn't validate date format |

---

## Actionable High-Priority Findings

1. **C13-01** (MEDIUM): CSV short-year date missing zero-padding — add `padStart(2, '0')`
2. **C13-02** (MEDIUM): PDF short-year date missing zero-padding — add `padStart(2, '0')`
3. **C13-12** (MEDIUM): Add unit tests for `parseDateToISO` across all formats
4. **C13-13** (MEDIUM): Add test for `calculateRewards` global cap rollback
5. **C13-06** (MEDIUM): CSP 'unsafe-inline' — same as C11-07/C12-06, deferred
6. **C13-16** (LOW): Fix "전전월" → "전월" in FileDropzone help text
