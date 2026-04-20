# Cycle 65 Comprehensive Review -- 2026-04-21

**Reviewer**: comprehensive (all specialist angles)
**Scope**: Full repository re-read with focus on verifying prior fixes, cross-file consistency, and finding new issues missed by 64 prior cycles

---

## Verification of Prior Cycle Fixes (C64)

| Finding | Status | Evidence |
|---|---|---|
| C64-01 (test duplicates pre-C63-04 date logic) | **FIXED** | `parser-date.test.ts:9-10` now imports `parseDateStringToISO` and `inferYear` directly from `date-utils.ts`. Lines 247-320 add comprehensive month-aware day validation tests (Feb 29 leap/non-leap, Apr 31, Jun 31, century boundary 1900/2000). The C63-04 fix now has proper test coverage. |
| C64-02 (EUC-KR redundant vs CP949) | **FIXED** | `parser/index.ts:20-23` encoding list is now `['utf-8', 'cp949']` with a comment explaining why EUC-KR was removed. |
| C64-03 (CATEGORY_NAMES_KO drift risk) | OPEN (LOW) | `greedy.ts:7-86` still has the hardcoded map with a TODO comment. No new taxonomy entries have been added, so no drift has occurred yet. |

---

## Verification of Other Recently Fixed Findings

| Finding | Status | Evidence |
|---|---|---|
| D-76 (cachedCoreRules persists across resets) | **FIXED** | `analyzer.ts:77-79` exports `invalidateAnalyzerCaches()` which clears `cachedCoreRules = null`. Called from `store.svelte.ts:525` in `reset()`. |
| C62-11 (persistToStorage bare catch) | PARTIALLY FIXED | `store.svelte.ts:154-165` catches QuotaExceededError specifically and logs non-quota errors, but still returns `{ kind: 'corrupted' }` for ALL non-quota errors including serialization errors. The 'corrupted' label is misleading for a JSON.stringify circular reference error vs quota exceeded. |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C65-01 | LOW | HIGH | `apps/web/src/lib/parser/pdf.ts:32-38` | `isValidShortDate()` uses `day >= 1 && day <= 31` for its pre-filter check, while the production `parseDateStringToISO()` now uses `isValidDayForMonth(year, month, day)`. This is the same class of inconsistency that was C64-01 (test-code/production-code divergence). In this case, the pre-filter is slightly more permissive than the actual parser: a cell like "2/31" passes `isValidShortDate` (allowing the row to be identified as containing a date) but `parseDateStringToISO("2/31")` then correctly rejects it (via `isValidDayForMonth`) and returns the raw input "2/31". No incorrect date output is produced -- the final validation in `parseDateStringToISO` catches the invalid date. However, the inconsistency means: (1) the pre-filter may cause a row with an invalid date cell to be processed as a transaction row when it should be skipped; (2) the resulting transaction gets a raw "2/31" date string instead of a proper ISO date. Not a data-loss issue since the unparseable date passthrough behavior (C56-04) applies, but the pre-filter should ideally match the production validation for consistency. |
| C65-02 | LOW | MEDIUM | `apps/web/src/lib/parser/date-utils.ts:100,124` | The MM/DD and Korean short date branches in `parseDateStringToISO` have a `day >= 1 && day <= 31` pre-check before calling `isValidDayForMonth(year, month, day)`. The `day <= 31` check is redundant because `isValidDayForMonth` performs the correct month-aware validation immediately after. The pre-check adds a small inconsistency: the other branches (full date, YYYYMMDD, short-year) only use `isValidDayForMonth` without the `day <= 31` guard. Not a bug -- the final `isValidDayForMonth` call ensures correctness -- but the inconsistent style could confuse future maintainers into thinking `day <= 31` is sufficient validation. |

---

## Cross-Agent Convergence (Cumulative)

Findings flagged by 2+ cycles, indicating high signal (unchanged from C64):

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64 | OPEN (MEDIUM) -- 6 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64 | OPEN (MEDIUM) -- 8 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64 | OPEN (LOW) -- 5 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64 | OPEN (LOW) -- 4 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64 | OPEN (LOW) -- 4 cycles agree |
| persistToStorage bare catch | C62, C63, C64 | OPEN (LOW) -- 3 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64 | OPEN (LOW) -- 2 cycles agree |

---

## Final Sweep -- Commonly Missed Issues

1. **Test coverage for C63-04 is now adequate (C64-01 FIXED)**: The test file imports production code and has 12 test cases covering leap years, non-leap years, century boundaries (1900/2000), and month-specific day limits.
2. **No new security findings**: CSP unchanged, no secrets, no XSS vectors (Svelte auto-escapes), no SQL injection.
3. **No new race conditions**: All fetch operations use AbortController properly. Store mutations are synchronous.
4. **No new data-loss vectors**: sessionStorage persistence is well-guarded with truncation/corruption warnings.
5. **PDF pre-filter inconsistency (C65-01)**: Minor -- `isValidShortDate` is more permissive than the production parser, but the final validation in `parseDateStringToISO` catches any invalid dates. The inconsistency is the same class as the now-fixed C64-01.
6. **Redundant day <= 31 pre-check (C65-02)**: Trivial style inconsistency in `date-utils.ts`. The `isValidDayForMonth` call that follows makes the pre-check redundant.

---

## Summary

- **New findings this cycle**: 2 (0 CRITICAL, 0 MEDIUM, 2 LOW)
- **New genuinely novel findings**: 2 (C65-01, C65-02)
- **Convergence findings**: 0 (all carried forward)
- **Carried-forward findings**: 22 OPEN from prior cycles
- **Fixed this cycle (confirmed from C64)**: 2 (C64-01, C64-02)
