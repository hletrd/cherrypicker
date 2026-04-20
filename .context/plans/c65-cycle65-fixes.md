# Cycle 65 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle65-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### Task 1: C65-01 (LOW, HIGH): Align PDF `isValidShortDate` pre-filter with production `isValidDayForMonth`

**File:** `apps/web/src/lib/parser/pdf.ts:32-38`
**Problem:** `isValidShortDate()` uses `day >= 1 && day <= 31` for its pre-filter check, while the production `parseDateStringToISO()` now uses `isValidDayForMonth(year, month, day)`. This is the same class of inconsistency that was C64-01. A cell like "2/31" passes `isValidShortDate` (allowing the row to be identified as containing a date) but `parseDateStringToISO("2/31")` correctly rejects it and returns the raw input "2/31". No incorrect date output is produced, but:
1. The pre-filter may cause a row with an invalid date cell to be processed as a transaction row when it should be skipped
2. The resulting transaction gets a raw "2/31" date string instead of being skipped

**Fix:** Import `isValidDayForMonth` from `date-utils.ts` and use it in `isValidShortDate()`. Since `isValidDayForMonth` requires a `year` parameter, we need to call `inferYear(month, day)` first for the year-inferred short dates. However, for the pre-filter purpose, a simpler approach is to replace `day <= 31` with a month-aware check using the `daysInMonth` function. Since `isValidShortDate` doesn't have a year context, we should use a conservative approach: check against the maximum days for each month in a non-leap year (which rejects Feb 29-31, Apr 31, Jun 31, etc.). This is stricter than necessary for leap years (Feb 29 would be rejected in the pre-filter but accepted by `parseDateStringToISO`), which is acceptable since the pre-filter is only used for row detection -- if a Feb 29 date is rejected by the pre-filter, the row won't be identified as a date row, but in practice Feb 29 dates in Korean credit card statements always appear in full-year format (2024-02-29 or 2024년 2월 29일) which matches other patterns (STRICT_DATE_PATTERN, KOREAN_FULL_DATE_PATTERN) before `isValidShortDate` is checked.

Actually, let me reconsider. The function `isValidShortDate` is used in `findDateCell` as one of several date-pattern checks. The other patterns (STRICT_DATE_PATTERN, SHORT_YEAR_DATE_PATTERN, KOREAN_FULL_DATE_PATTERN, KOREAN_SHORT_DATE_PATTERN) are checked first. `isValidShortDate` is only checked if none of those match. So making it slightly stricter won't cause valid dates to be missed -- they'd be caught by other patterns.

The simplest fix: replace `day >= 1 && day <= 31` with a month-aware check using a local `maxDaysInMonth` lookup table (non-leap year, since we don't have a year context). This ensures that short dates like "2/31" are rejected at the pre-filter level, matching the behavior of the production parser.

**Steps:**
1. [ ] Add a `MAX_DAYS_PER_MONTH` constant array in pdf.ts for non-leap year month lengths
2. [ ] Update `isValidShortDate` to use the month-aware check instead of `day <= 31`
3. [ ] Run all gates to confirm no regressions
4. [ ] Commit with appropriate message

---

### Task 2: C65-02 (LOW, MEDIUM): Remove redundant `day <= 31` pre-check in date-utils.ts MM/DD and Korean short date branches

**File:** `apps/web/src/lib/parser/date-utils.ts:100,124`
**Problem:** The MM/DD and Korean short date branches have a `day >= 1 && day <= 31` pre-check before calling `isValidDayForMonth(year, month, day)`. The `day <= 31` check is redundant because `isValidDayForMonth` performs the correct month-aware validation immediately after. Other branches (full date, YYYYMMDD, short-year) only use `isValidDayForMonth` without the `day <= 31` guard. The inconsistent style could confuse future maintainers into thinking `day <= 31` is sufficient validation.

**Fix:** Remove the `day <= 31` portion of the pre-check, keeping only `day >= 1` (which is still useful as a quick rejection of day=0 before computing `isValidDayForMonth`). The month check (`month >= 1 && month <= 12`) remains unchanged since it's needed to construct a valid date for `isValidDayForMonth`.

Actually, looking more carefully: `isValidDayForMonth(year, month, day)` already checks `day >= 1 && day <= daysInMonth(year, month)`. The `daysInMonth` function uses `new Date(year, month, 0).getDate()` which handles month=0 gracefully (returns Dec of previous year). So the `month >= 1 && month <= 12` guard is also technically redundant for the `isValidDayForMonth` call, but it IS needed to construct the correct date for `inferYear` -- `inferYear(0, 15)` or `inferYear(13, 15)` would produce incorrect results.

So the fix is: replace `day >= 1 && day <= 31` with just `day >= 1` in the pre-checks at lines 100 and 124, since `isValidDayForMonth` handles the upper bound correctly.

**Steps:**
1. [ ] Replace `day >= 1 && day <= 31` with `day >= 1` at line 100 (MM/DD branch)
2. [ ] Replace `day >= 1 && day <= 31` with `day >= 1` at line 124 (Korean short date branch)
3. [ ] Run all gates to confirm no regressions
4. [ ] Commit with appropriate message

---

### Task 3: Run all quality gates

**Gates:** eslint, tsc --noEmit, vitest, bun test

**Steps:**
1. [ ] Run eslint across the codebase
2. [ ] Run `tsc --noEmit` for type checking
3. [ ] Run vitest for web app tests
4. [ ] Run bun test for parser tests
5. [ ] Fix any gate failures

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C33-01/C62-01 | MEDIUM | HIGH | MerchantMatcher/taxonomy O(n) scan. Already deferred as D-100. Building a trie-based prefix index is disproportionate to the current scale. |
| C33-02/C62-04 | MEDIUM | HIGH | cachedCategoryLabels stale across redeployments. Cache is invalidated on explicit `reset()`. Staleness across deployments is a theoretical concern. |
| C56-04 | LOW | HIGH | date-utils.ts returns raw input for unparseable dates. Already deferred across 5 cycles. Passthrough is pragmatic -- the alternative (throwing) would crash the entire parse. |
| C56-05 | LOW | HIGH | Zero savings shows "0원" without plus sign. Already deferred across 5 cycles. The `formatWon` function normalizes -0 to +0, and the SavingsComparison template handles the display. The "+0원" case is handled by the `Math.abs(displayedSavings) >= 1` guard. |
| C62-11 | LOW | HIGH | persistToStorage returns 'corrupted' for non-quota errors. Already deferred across 4 cycles. The misleading label doesn't cause functional issues -- the warning is correctly shown to the user regardless of the internal label. |
| C64-03 | LOW | MEDIUM | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy. TODO comment added in C64. Full fix requires core package to import from rules package. |
| C4-10 | MEDIUM | HIGH | E2E test stale dist/ dependency. Already deferred. Requires CI/CD changes. |
| C4-11 | MEDIUM | HIGH | No regression test for findCategory fuzzy match. Already deferred. Requires test infrastructure for the categorizer. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.
